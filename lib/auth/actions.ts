"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import {
  LONGUEUR_MOT_DE_PASSE_MIN,
  hacherMotDePasse,
  verifierMotDePasse,
} from "@/lib/auth/password";
import {
  changerMotDePasse,
  demanderReinitialisation as demanderLienDeReinitialisation,
} from "@/lib/auth/reinitialisation";
import {
  COOKIE_DEFI,
  ouvrirDefi,
  releverDefi,
} from "@/lib/auth/deux-facteurs";
import { fermerSession, ouvrirSession } from "@/lib/auth/session";
import {
  CHAMP_LEURRE,
  CHAMP_OUVERTURE,
  evaluerUnGeste,
} from "@/lib/securite/antibot";
import {
  adresseCourante,
  premierBlocage,
} from "@/lib/securite/blocklist";
import { verifierLimiteAction } from "@/lib/securite/garde";
import { deposer } from "@/lib/email/outbox";

/**
 * Actions d'authentification.
 *
 * Règle qui gouverne les messages d'erreur : on ne dit **jamais** si c'est
 * l'adresse ou le mot de passe qui est faux. Le dire transformerait le
 * formulaire de connexion en outil pour savoir qui a un compte ici.
 */

/**
 * Le refus opposé à une identité bloquée.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL NE DIT PAS CE QUI A BLOQUÉ, ET C'EST VOULU
 *
 * « Votre adresse IP est bloquée » apprend à la personne qu'il suffit de
 * changer de réseau ; « votre courriel est bloqué » qu'il suffit d'en prendre
 * un autre. Le blocage a une valeur exactement tant qu'on ignore lequel des
 * deux a joué.
 *
 * Le journal, lui, le dit — c'est à l'écran d'administration qu'on a besoin de
 * le savoir, pas dans le formulaire.
 *
 * Message distinct de `MESSAGE_IDENTIFIANTS` : refuser un compte bloqué avec
 * « adresse ou mot de passe incorrect » enverrait la personne réinitialiser un
 * mot de passe qui fonctionne très bien, et le support chercherait un défaut
 * de connexion là où il y a une décision.
 */
const MESSAGE_BLOQUE =
  "Ce compte ne peut pas être utilisé. Écris-nous si tu penses que c'est une erreur.";

/**
 * Les identités de cette tentative qui pourraient être bloquées.
 *
 * L'adresse n'entre dans la liste que si on en a une : sans ce filtre, on
 * appellerait `estBloque("IP", "")`, et une ligne vide posée par accident dans
 * la table bloquerait alors **tout le monde**.
 */
/**
 * Le verdict anti-bot pour ce formulaire.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE MESSAGE EST CELUI D'UNE LIMITE, PAS D'UNE ACCUSATION
 *
 * Aucun des trois signaux n'est certain. Un remplisseur automatique un peu
 * zélé, un navigateur exotique, un score mal calibré : il y aura des refus
 * injustes, et la personne en face n'a alors rien fait de mal.
 *
 * « Réessaie dans un instant » est vrai pour elle et sans intérêt pour un
 * robot. « Nous pensons que vous êtes un robot » serait faux une fois sur dix
 * et vexant les dix fois.
 *
 * Le motif, lui, part au journal : c'est là qu'on a besoin de savoir lequel
 * des trois a joué.
 */
async function verdictAntiBot(
  donnees: FormData,
  action: string,
  /**
   * Le délai minimum ne vaut que là où quelqu'un tape vraiment.
   *
   * À l'inscription, on remplit six champs : deux secondes sont impossibles.
   * À la connexion, un gestionnaire de mots de passe remplit et valide en un
   * clin d'œil — appliquer le même plancher refuserait des connexions
   * parfaitement réelles, tous les jours, sans que personne ne fasse le lien.
   */
  avecDelai: boolean,
): Promise<EtatFormulaire | null> {
  const verdict = await evaluerUnGeste({
    action,
    leurre: String(donnees.get(CHAMP_LEURRE) ?? ""),
    ouvertLe: avecDelai ? String(donnees.get(CHAMP_OUVERTURE) ?? "") : null,
  });

  if (verdict.laisserPasser) return null;

  journal.info("geste refusé par l'anti-bot", {
    action,
    motif: verdict.motif,
    score: verdict.score,
  });

  return { erreur: "Quelque chose a coincé. Réessaie dans un instant." };
}

async function identitesDe(email: string) {
  const adresse = await adresseCourante();

  return [
    { type: "EMAIL" as const, valeur: email },
    ...(adresse ? [{ type: "IP" as const, valeur: adresse }] : []),
  ];
}

export interface EtatFormulaire {
  erreur?: string;
  champ?: "email" | "motDePasse" | "username" | "nom" | "conditions";
  /** Confirmation sans redirection : la demande d'oubli reste sur sa page. */
  succes?: string;
}

const MESSAGE_IDENTIFIANTS = "Adresse ou mot de passe incorrect.";

/**
 * Ce qu'on répond quand la limite est atteinte.
 *
 * Le même texte partout, et il ne dit **rien** de ce qui a été tenté : ni si
 * l'adresse existe, ni combien d'essais restent. Annoncer « il vous reste deux
 * essais » indiquerait à un attaquant qu'il est sur la bonne piste, et lui
 * donnerait le rythme exact auquel repartir.
 */
function tropDEssais(secondes: number): EtatFormulaire {
  const minutes = Math.max(1, Math.ceil(secondes / 60));
  return {
    erreur: `Trop de tentatives. Réessaie dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
  };
}

function normaliserEmail(valeur: string): string {
  return valeur.trim().toLowerCase();
}

function normaliserUsername(valeur: string): string {
  return valeur
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function connecter(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  // La borne AVANT de toucher à la base : un essai refusé ne doit rien coûter
  // de plus qu'une lecture de compteur. Vérifier le mot de passe d'abord ferait
  // payer un hachage scrypt à chaque tentative — c'est justement ce qu'un
  // attaquant cherche à nous faire faire un million de fois.
  const borne = await verifierLimiteAction("connexion");
  if (!borne.autorise) return tropDEssais(borne.dansSecondes);

  // Sans plancher de temps : un gestionnaire de mots de passe valide en une
  // seconde, et c'est une connexion parfaitement réelle.
  const robot = await verdictAntiBot(donnees, "connexion", false);
  if (robot) return robot;

  const email = normaliserEmail(String(donnees.get("email") ?? ""));
  const motDePasse = String(donnees.get("motDePasse") ?? "");

  if (!email || !motDePasse) {
    return { erreur: "Renseigne ton adresse et ton mot de passe." };
  }

  // La liste de blocage AVANT le hachage, pour la même raison que la borne :
  // une identité déjà jugée ne doit pas nous coûter un scrypt à chaque essai.
  const bloque = await premierBlocage(await identitesDe(email));
  if (bloque) {
    journal.info("connexion refusée : identité bloquée", { type: bloque });
    return { erreur: MESSAGE_BLOQUE };
  }

  const compte = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      suspendedAt: true,
      totpActiveLe: true,
    },
  });

  // On vérifie même quand le compte n'existe pas : sans ça, une réponse
  // immédiate trahirait les adresses inconnues par le simple temps de réponse.
  const valide = await verifierMotDePasse(
    motDePasse,
    compte?.passwordHash ?? null,
  );

  if (!compte || !valide) return { erreur: MESSAGE_IDENTIFIANTS };

  if (compte.suspendedAt) {
    return { erreur: "Ce compte est suspendu. Écris-nous pour en savoir plus." };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AVEC UNE 2FA ACTIVE, AUCUNE SESSION N'EST OUVERTE ICI
  //
  // Ni session « en attente », ni cookie provisoire qui vaudrait session : le
  // mot de passe seul n'ouvre rien. Ce qu'on pose est un jeton de défi, dans
  // un cookie distinct, qui ne sert qu'à retrouver la ligne `TotpChallenge`.
  //
  // Le raisonnement est celui du schéma : une session marquée « à vérifier »
  // répondrait oui à tout le code qui demande « y a-t-il une session ? », et
  // le premier appel qui oublie le drapeau ouvre le compte sans second
  // facteur — sans que rien ne plante.
  if (compte.totpActiveLe) {
    const jeton = await ouvrirDefi(compte.id);
    const magasin = await cookies();

    magasin.set(COOKIE_DEFI, jeton, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // Cinq minutes, comme le défi. Un cookie qui survivrait au défi ne
      // donnerait rien, mais laisserait croire à une session en cours.
      maxAge: 300,
    });

    redirect("/connexion/verification");
  }

  await ouvrirSession(compte.id, await adresseCourante());
  redirect("/dashboard");
}

/**
 * Le second facteur, après le mot de passe.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MESSAGE NE DISTINGUE PAS LE CODE FAUX DU DÉFI EXPIRÉ
 *
 * Il le distingue en fait — mais seulement pour dire quoi faire ensuite :
 * « recommence » quand le défi est perdu, « vérifie le code » quand il reste
 * des essais. Ce qu'il ne dit jamais, c'est si le compte existe ou si la 2FA
 * est active : ces deux-là sont déjà connus de qui est arrivé jusqu'ici, et
 * les répéter n'apprend rien à personne.
 */
export async function verifierDeuxFacteurs(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  // La même borne que la connexion : un défi laisse cinq essais, mais rien
  // n'empêche d'en ouvrir un nouveau à chaque fois. La borne par adresse est
  // ce qui ferme cette porte-là.
  const borne = await verifierLimiteAction("connexion");
  if (!borne.autorise) return tropDEssais(borne.dansSecondes);

  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_DEFI)?.value;

  if (!jeton) {
    return { erreur: "La vérification a expiré. Reprends la connexion." };
  }

  const code = String(donnees.get("code") ?? "").trim();
  if (!code) return { erreur: "Saisis le code de ton application." };

  const suite = await releverDefi(jeton, code);

  if (!suite.ok) {
    if (suite.motif === "CODE_FAUX") {
      return { erreur: "Ce code ne correspond pas. Vérifie ton application." };
    }

    // Défi inconnu, expiré, ou trop d'essais : dans les trois cas le cookie ne
    // vaut plus rien, et le laisser ferait réessayer dans le vide.
    magasin.delete(COOKIE_DEFI);

    return {
      erreur:
        suite.motif === "TROP_D_ESSAIS"
          ? "Trop d'essais. Reprends la connexion."
          : "La vérification a expiré. Reprends la connexion.",
    };
  }

  magasin.delete(COOKIE_DEFI);

  // `totpValideLe` posé à l'ouverture : la session naît avec son passage, et
  // les gardes d'actions sensibles n'ont pas à redemander un code dans la
  // foulée d'une connexion qui vient d'en exiger un.
  await ouvrirSession(suite.userId, await adresseCourante(), new Date());

  redirect("/dashboard");
}

export async function inscrire(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const borne = await verifierLimiteAction("inscription");
  if (!borne.autorise) return tropDEssais(borne.dansSecondes);

  // Avec plancher de temps : six champs ne se remplissent pas en deux
  // secondes.
  const robot = await verdictAntiBot(donnees, "inscription", true);
  if (robot) return robot;

  const prenom = String(donnees.get("prenom") ?? "").trim();
  const nom = String(donnees.get("nom") ?? "").trim();
  const username = normaliserUsername(String(donnees.get("username") ?? ""));
  const email = normaliserEmail(String(donnees.get("email") ?? ""));
  const motDePasse = String(donnees.get("motDePasse") ?? "");
  const conditions = donnees.get("conditions") === "on";

  // ───────────────────────────────────────────────────────────────────────
  // UNE INTENTION, PAS UN RÔLE
  //
  // `lib/auth/roles.ts` pose qu'il n'existe **aucune colonne de rôle** : on ne
  // devient pas créateur parce qu'on l'a déclaré, mais parce qu'on a publié.
  // Écrire ce choix en base créerait une seconde vérité, qui dériverait — un
  // compte marqué « créateur » sans un seul produit, ou l'inverse.
  //
  // Il ne sert donc qu'à une chose : décider où l'on atterrit. Rien n'est
  // accordé, rien n'est fermé, et publier suffit toujours à devenir créateur.
  const veutPublier = donnees.get("compte") === "createur";

  if (!prenom || !nom) {
    return { erreur: "Indique ton prénom et ton nom.", champ: "nom" };
  }
  if (username.length < 3) {
    return {
      erreur: "Le nom d'utilisateur doit faire au moins 3 caractères.",
      champ: "username",
    };
  }
  if (!email.includes("@")) {
    return { erreur: "Cette adresse ne ressemble pas à un e-mail.", champ: "email" };
  }
  if (motDePasse.length < LONGUEUR_MOT_DE_PASSE_MIN) {
    return {
      erreur: `Le mot de passe doit faire au moins ${LONGUEUR_MOT_DE_PASSE_MIN} caractères.`,
      champ: "motDePasse",
    };
  }
  if (!conditions) {
    return {
      erreur: "Il faut accepter les conditions pour créer un compte.",
      champ: "conditions",
    };
  }

  // Après les validations de forme, avant la moindre écriture : une identité
  // bloquée ne doit pas pouvoir se réinscrire sous un autre pseudo.
  const bloqueInscription = await premierBlocage(await identitesDe(email));
  if (bloqueInscription) {
    journal.info("inscription refusée : identité bloquée", {
      type: bloqueInscription,
    });
    return { erreur: MESSAGE_BLOQUE, champ: "email" };
  }

  const [emailPris, usernamePris] = await Promise.all([
    db.user.findUnique({ where: { email }, select: { id: true } }),
    db.profile.findUnique({ where: { username }, select: { id: true } }),
  ]);

  if (emailPris) {
    return {
      erreur: "Un compte existe déjà avec cette adresse.",
      champ: "email",
    };
  }
  if (usernamePris) {
    return { erreur: "Ce nom d'utilisateur est déjà pris.", champ: "username" };
  }

  const passwordHash = await hacherMotDePasse(motDePasse);

  const affichage = `${prenom} ${nom}`.trim();

  // Le compte et l'intention d'envoi s'écrivent ensemble. Si la création
  // échouait après coup, un message de bienvenue partirait pour un compte
  // inexistant ; si l'envoi échouait seul, l'inscription serait perdue pour un
  // courriel. La transaction supprime le choix.
  const compte = await db.$transaction(async (tx) => {
    const cree = await tx.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: { username, displayName: affichage },
        },
        // Le prénom et le nom servent aux factures, pas à la vitrine : ils vont
        // dans les informations de facturation, pas dans le profil public.
        billing: { create: { firstName: prenom, lastName: nom } },
      },
      select: { id: true },
    });

    await deposer(
      {
        // Une clé par compte : même rejouée, l'inscription n'enverra jamais
        // deux messages de bienvenue.
        cle: `bienvenue-${cree.id}`,
        destinataire: email,
        modele: "BIENVENUE",
        charge: { nom: affichage || username },
      },
      tx,
    );

    return cree;
  },
  {
    // Le défaut de Prisma est de cinq secondes. C'est court pour deux écritures
    // sur une connexion froide — première invocation d'une fonction serverless,
    // ou passage par un pooler. Un dépassement ici renvoie une erreur 500 à
    // quelqu'un qui s'inscrit, pour une lenteur passagère.
    timeout: 15_000,
    // Même raison côté attente : obtenir une connexion peut prendre plus de
    // deux secondes quand le pool vient d'être réveillé.
    maxWait: 10_000,
  });

  await ouvrirSession(compte.id, await adresseCourante());

  // La seule conséquence du choix : la première page. Celle-ci est ouverte à
  // tout le monde — c'est déjà la seule porte créateur que voit un acheteur.
  redirect(veutPublier ? "/dashboard/produits/nouveau" : "/dashboard");
}

export async function deconnecter(): Promise<void> {
  await fermerSession();
  redirect("/");
}

/**
 * Demande de réinitialisation.
 *
 * La réponse est **la même** que l'adresse existe ou non. Répondre « aucun
 * compte à cette adresse » ferait du formulaire un annuaire : on y essaie une
 * liste et on repart avec celles qui sont chez nous. Le raisonnement complet
 * est dans `lib/auth/reinitialisation.ts`.
 */
export async function demanderReinitialisation(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  // Il existe déjà un plafond PAR COMPTE dans `lib/auth/reinitialisation.ts`.
  // Celui-ci est par adresse, et il couvre autre chose : quelqu'un qui essaie
  // cent adresses différentes pour savoir lesquelles sont chez nous. Le silence
  // de la réponse ne suffit pas si l'on peut poser la question mille fois.
  const borne = await verifierLimiteAction("oubli");
  if (!borne.autorise) return tropDEssais(borne.dansSecondes);

  const email = normaliserEmail(String(donnees.get("email") ?? ""));

  if (!email.includes("@")) {
    return { erreur: "Cette adresse ne ressemble pas à un e-mail.", champ: "email" };
  }

  const suite = await demanderLienDeReinitialisation(email);

  if (!suite.fait) {
    // Panne d'exploitation, pas faute de l'utilisateur. Lui afficher
    // « vérifie ta boîte » l'enverrait attendre un courriel qui ne partira pas.
    return {
      erreur:
        "L'envoi des courriels n'est pas configuré sur ce serveur. Écris-nous en attendant.",
    };
  }

  return {
    succes:
      "Si un compte existe à cette adresse, un lien vient d'y partir. Il est valable une heure.",
  };
}

/**
 * Pose le nouveau mot de passe au bout d'un lien de réinitialisation.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PAS DE SESSION ICI, ET C'EST NORMAL
 *
 * Toutes les autres actions lisent l'acteur depuis la session. Celle-ci ne
 * peut pas : celui qui l'appelle a précisément perdu l'accès à son compte. Le
 * jeton **est** le justificatif, et c'est pourquoi il est tiré au hasard sur
 * trente-deux octets, à usage unique et valable une heure. Le recevoir dans sa
 * boîte prouve qu'on la contrôle — la même preuve qu'un mot de passe, en plus
 * périssable.
 *
 * Le jeton passe en premier paramètre : la page le lie à l'action avant de
 * l'envoyer au navigateur. Qu'il soit joignable directement ne change rien —
 * il faut le connaître, et le connaître c'est l'avoir reçu.
 */
export async function reinitialiserMotDePasse(
  jeton: string,
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const motDePasse = String(donnees.get("motDePasse") ?? "");
  const confirmation = String(donnees.get("confirmation") ?? "");

  if (donnees.get("conditions") !== "on") {
    return {
      erreur: "Coche la case : tes autres sessions vont être fermées.",
      champ: "conditions",
    };
  }

  if (motDePasse !== confirmation) {
    return { erreur: "Les deux mots de passe ne sont pas identiques.", champ: "motDePasse" };
  }

  const suite = await changerMotDePasse(jeton, motDePasse);

  if (!suite.fait) {
    if (suite.motif === "faible") {
      return { erreur: suite.detail ?? "Ce mot de passe est trop faible.", champ: "motDePasse" };
    }
    return {
      erreur:
        "Ce lien n'est plus valable. Demande-en un nouveau depuis la page d'oubli.",
    };
  }

  // On ne connecte pas : le mot de passe vient de changer, et le retaper une
  // fois confirme qu'il a bien été retenu — pas seulement collé dans un champ.
  redirect("/connexion?reinitialise=1");
}
