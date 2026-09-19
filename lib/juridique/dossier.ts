import "server-only";

import { consigner, ressource } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { notifier } from "@/lib/notifications/aiguilleur";
import { journal } from "@/lib/observabilite/journal";
import { urlDuSite } from "@/lib/config/site";

import {
  exigencesManquantes,
  validerNotification,
  type Manque,
  type NotificationValide,
  type Saisie,
} from "@/lib/juridique/article47";

/**
 * Le cycle d'un dossier juridique.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE LA LOI IMPOSE, ET CE QUE BAOBART CHOISIT
 *
 * La loi ivoirienne n° 2013-451 impose deux choses et une seule date :
 *
 *   — agir **promptement** une fois la connaissance acquise (article 46).
 *     « Promptement », sans chiffre ;
 *   — conserver **trois ans** les données d'identification (article 53).
 *
 * Tout le reste est un engagement de Baobart : les 48 heures d'examen, les dix
 * jours de réponse. Ils sont écrits ici pour être tenus et vérifiables, et la
 * page publique dit lesquels viennent de la loi et lesquels viennent de nous.
 *
 * Confondre les deux serait annoncer une conformité qu'on n'a pas — et sur une
 * page juridique, personne ne va vérifier.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE NOTIFICATION INCOMPLÈTE EST ENREGISTRÉE, PAS REJETÉE
 *
 * Tant qu'un élément de l'article 47 manque, la connaissance n'est pas
 * présumée : l'obligation d'agir ne court pas, et le contenu reste en ligne.
 *
 * Mais le dossier existe, avec sa référence. Refuser en bloc obligerait à tout
 * ressaisir, et ferait perdre la date de première tentative — celle qui compte
 * si l'affaire va devant un juge.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE RETRAIT EST PROVISOIRE, ET LE MOT EST TENU
 *
 * `RETRAIT_PROVISOIRE` ne supprime rien. C'est un état du dossier ; le contenu
 * lui-même est masqué par la modération, et revient si la notification ne
 * tient pas. Supprimer tout de suite ferait de « provisoire » un mensonge, et
 * rendrait la restauration impossible.
 */

// ════════════════════════════════════════════════════════════ les engagements ══

/**
 * Les délais que Baobart s'impose. Aucun ne vient de la loi.
 *
 * Ils sont ici, nommés et en un seul endroit, parce qu'ils sont affichés sur
 * la page publique : deux valeurs qui divergeraient feraient de cette page une
 * promesse fausse.
 */
export const ENGAGEMENTS = {
  /** Examen de complétude, puis retrait provisoire si la notification tient. */
  examenHeures: 48,
  /** Fenêtre laissée à l'auteur pour contester. */
  reponseJours: 10,
} as const;

export type Echec =
  | { motif: "INCOMPLETE"; manques: Manque[] }
  | { motif: "INTROUVABLE" }
  | { motif: "ETAT" };

export type Suite<T = object> = ({ ok: true } & T) | ({ ok: false } & Echec);

export const MESSAGES_ECHEC: Record<Echec["motif"], string> = {
  INCOMPLETE: "Il manque des éléments que la loi exige.",
  INTROUVABLE: "Ce dossier n'existe pas.",
  ETAT: "Ce dossier n'est plus dans un état qui permet ce geste.",
};

// ════════════════════════════════════════════════════════════════════ dépôt ══

/**
 * Déposer une notification.
 *
 * Elle est enregistrée dans les deux cas — complète ou non. Ce qui change est
 * l'état, et donc si l'horloge de l'article 46 se met à tourner.
 */
export async function deposer(input: {
  saisie: Saisie;
}): Promise<{ reference: string; complete: boolean; manques: Manque[] }> {
  const verdict = validerNotification(input.saisie);
  const reference = await referenceLibre();

  if (!verdict.complete) {
    await db.legalNotice.create({
      data: {
        ...colonnesDepuisSaisie(input.saisie),
        reference,
        state: "INCOMPLETE",
        missingElements: exigencesManquantes(verdict.manques).join(", "),
      },
    });

    journal.info("notification juridique incomplète", { reference });
    return { reference, complete: false, manques: verdict.manques };
  }

  await db.legalNotice.create({
    data: { ...colonnesDepuisValide(verdict.valeur), reference, state: "RECUE" },
  });

  // Pas d'`acteurId` : le notifiant n'a pas de compte, et la trace d'audit en
  // exige un. Le dossier lui-même EST la trace — il porte la date, l'auteur et
  // le contenu de la notification, et rien ne l'efface.
  journal.info("notification juridique reçue", { reference });

  return { reference, complete: true, manques: [] };
}

/**
 * Compléter un dossier incomplet.
 *
 * La référence et la **date d'origine** ne bougent pas. C'est le point : si
 * l'affaire va devant un juge, ce qui compte est le jour où la personne s'est
 * manifestée pour la première fois, pas celui où elle a fini de remplir les
 * cases.
 */
export async function completer(input: {
  reference: string;
  saisie: Saisie;
}): Promise<Suite<{ complete: boolean; manques: Manque[] }>> {
  const dossier = await db.legalNotice.findUnique({
    where: { reference: input.reference },
    select: { id: true, state: true },
  });

  if (!dossier) return { ok: false, motif: "INTROUVABLE" };
  if (dossier.state !== "INCOMPLETE") return { ok: false, motif: "ETAT" };

  const verdict = validerNotification(input.saisie);

  if (!verdict.complete) {
    await db.legalNotice.update({
      where: { id: dossier.id },
      data: {
        ...colonnesDepuisSaisie(input.saisie),
        missingElements: exigencesManquantes(verdict.manques).join(", "),
      },
    });
    return { ok: true, complete: false, manques: verdict.manques };
  }

  await db.legalNotice.update({
    where: { id: dossier.id },
    data: {
      ...colonnesDepuisValide(verdict.valeur),
      state: "RECUE",
      missingElements: null,
    },
  });

  return { ok: true, complete: true, manques: [] };
}

// ═══════════════════════════════════════════════════════════════ traitement ══

/**
 * Retirer le contenu à titre provisoire, et prévenir l'auteur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'AUTEUR EST PRÉVENU PAR COURRIEL, PAS SEULEMENT PAR LA CLOCHE
 *
 * C'est le seul avis de la plateforme qui ouvre un **délai** au terme duquel
 * quelque chose est perdu. Une cloche qu'on n'ouvre pas ferait courir ces dix
 * jours dans le vide, et le retrait deviendrait définitif par silence.
 *
 * L'avis reprend le motif du notifiant **tel qu'il l'a écrit**. Le résumer
 * ferait répondre l'auteur à notre reformulation plutôt qu'à ce qui lui est
 * reproché.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SANS COMPTE RAPPROCHÉ, PAS D'AVIS — ET LE DOSSIER LE DIT
 *
 * `targetUserId` reste nul tant qu'un humain n'a pas rapproché le nom déclaré
 * d'un compte réel. Deviner sur un nom retirerait le contenu d'un homonyme.
 * Le retrait a quand même lieu — la loi l'impose dès la connaissance acquise —
 * mais l'avis ne part pas, et `avisEnvoye` le dit franchement.
 */
export async function retirerProvisoirement(input: {
  reference: string;
  parId: string;
}): Promise<Suite<{ avisEnvoye: boolean }>> {
  const dossier = await db.legalNotice.findUnique({
    where: { reference: input.reference },
    select: {
      id: true,
      state: true,
      reference: true,
      legalGrounds: true,
      targetUserId: true,
    },
  });

  if (!dossier) return { ok: false, motif: "INTROUVABLE" };
  if (dossier.state !== "RECUE") return { ok: false, motif: "ETAT" };

  const maintenant = new Date();
  const echeance = new Date(
    maintenant.getTime() + ENGAGEMENTS.reponseJours * 86_400_000,
  );

  // L'état d'avant est dans le `WHERE` : deux modérateurs qui cliquent en même
  // temps ne doivent pas poser deux échéances différentes.
  const ecrit = await db.legalNotice.updateMany({
    where: { id: dossier.id, state: "RECUE" },
    data: {
      state: "RETRAIT_PROVISOIRE",
      suspendedAt: maintenant,
      replyDueAt: echeance,
    },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "ETAT" };

  await consigner({
    acteurId: input.parId,
    action: "contenu.retirer",
    ressource: ressource("dossier-juridique", dossier.id),
    details: { geste: "retrait provisoire", reference: dossier.reference },
  });

  if (!dossier.targetUserId) return { ok: true, avisEnvoye: false };

  const base = urlDuSite();
  await notifier({
    destinataireId: dossier.targetUserId,
    evenement: "RETRAIT_JURIDIQUE",
    cle: `juridique-${dossier.id}`,
    titre: `Un de tes contenus a été retiré — dossier ${dossier.reference}`,
    corps: `Tu peux répondre jusqu'au ${enFrancais(echeance)}.`,
    lien: "/dashboard/mes-dossiers",
    charge: {
      reference: dossier.reference,
      motif: dossier.legalGrounds,
      echeance: enFrancais(echeance),
      lien: base ? `${base}/dashboard/mes-dossiers` : undefined,
    },
  });

  return { ok: true, avisEnvoye: true };
}

/**
 * L'auteur répond.
 *
 * Il n'a pas à prouver quoi que ce soit ici : il expose sa version, et le
 * dossier repasse devant un humain. Exiger une déclaration sous serment — ce
 * que fait le DMCA — transformerait une réponse en engagement pénal, alors
 * même que l'article 49 punit déjà la mauvaise foi du côté du notifiant.
 */
export async function repondre(input: {
  reference: string;
  auteurId: string | null;
  corps: string;
  conteste?: boolean;
}): Promise<Suite> {
  const corps = input.corps.trim();
  if (corps.length < 12) return { ok: false, motif: "ETAT" };

  const dossier = await db.legalNotice.findUnique({
    where: { reference: input.reference },
    select: { id: true, state: true },
  });

  if (!dossier) return { ok: false, motif: "INTROUVABLE" };
  if (dossier.state !== "RETRAIT_PROVISOIRE") return { ok: false, motif: "ETAT" };

  await db.$transaction(async (tx) => {
    await tx.legalNoticeReply.create({
      data: {
        noticeId: dossier.id,
        authorId: input.auteurId,
        body: corps,
        contests: input.conteste ?? true,
      },
    });
    await tx.legalNotice.update({
      where: { id: dossier.id },
      data: { state: "CONTESTEE" },
    });
  });

  return { ok: true };
}

export type Sens = "RETIREE" | "RESTAUREE" | "CLASSEE";

/**
 * Trancher.
 *
 * Le motif est obligatoire, comme pour la fermeture d'une communauté et pour
 * la même raison : une décision qu'on ne peut pas expliquer six mois plus tard
 * n'est pas une décision, c'est un geste.
 *
 * Ce que Baobart tranche n'est pas qui a raison — c'est si le contenu reste en
 * ligne. Le litige lui-même relève du juge, et l'article 52 lui donne le
 * pouvoir de prescrire toute mesure.
 */
export async function trancher(input: {
  reference: string;
  parId: string;
  sens: Sens;
  motif: string;
}): Promise<Suite> {
  const motif = input.motif.trim();
  if (motif.length < 8) return { ok: false, motif: "ETAT" };

  const dossier = await db.legalNotice.findUnique({
    where: { reference: input.reference },
    select: { id: true, state: true, reference: true },
  });

  if (!dossier) return { ok: false, motif: "INTROUVABLE" };

  // On tranche ce qui est en cours. Un dossier déjà tranché ne se retranche
  // pas : il faudrait une nouvelle notification, avec sa propre date.
  const tranchables: string[] = ["RECUE", "INCOMPLETE", "RETRAIT_PROVISOIRE", "CONTESTEE"];
  if (!tranchables.includes(dossier.state)) return { ok: false, motif: "ETAT" };

  const ecrit = await db.legalNotice.updateMany({
    where: { id: dossier.id, state: dossier.state },
    data: {
      state: input.sens,
      decidedById: input.parId,
      decidedAt: new Date(),
      decisionReason: motif,
    },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "ETAT" };

  await consigner({
    acteurId: input.parId,
    action: input.sens === "RESTAUREE" ? "contenu.publier" : "contenu.retirer",
    ressource: ressource("dossier-juridique", dossier.id),
    details: { geste: LIBELLE_SENS[input.sens], reference: dossier.reference, motif },
  });

  return { ok: true };
}

export const LIBELLE_SENS: Record<Sens, string> = {
  RETIREE: "retrait définitif",
  RESTAUREE: "remise en ligne",
  CLASSEE: "classement sans suite",
};

/**
 * Rapprocher le dossier d'un compte.
 *
 * Geste humain et réversible. Il conditionne l'avis à l'auteur : sans lui, le
 * retrait a lieu mais personne n'est prévenu.
 */
export async function rapprocher(input: {
  reference: string;
  userId: string | null;
  parId: string;
}): Promise<Suite> {
  const dossier = await db.legalNotice.findUnique({
    where: { reference: input.reference },
    select: { id: true },
  });
  if (!dossier) return { ok: false, motif: "INTROUVABLE" };

  await db.legalNotice.update({
    where: { id: dossier.id },
    data: { targetUserId: input.userId },
  });

  await consigner({
    acteurId: input.parId,
    action: "contenu.approuver",
    ressource: ressource("dossier-juridique", dossier.id),
    details: { geste: "rapprochement de compte", compte: input.userId },
  });

  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════ outils ══

/**
 * « NOT-2026-041 ».
 *
 * Le compteur repart à chaque année, et il compte les dossiers de l'année —
 * pas les lignes de la table. Une référence lisible se cite dans un courrier
 * recommandé ; un cuid, non.
 */
async function referenceLibre(): Promise<string> {
  const annee = new Date().getFullYear();

  for (let tentative = 0; tentative < 50; tentative += 1) {
    const rang =
      (await db.legalNotice.count({
        where: { reference: { startsWith: `NOT-${annee}-` } },
      })) +
      1 +
      tentative;

    const candidat = `NOT-${annee}-${String(rang).padStart(3, "0")}`;
    const pris = await db.legalNotice.findUnique({
      where: { reference: candidat },
      select: { id: true },
    });
    if (!pris) return candidat;
  }

  // Cinquante collisions d'affilée : on rend la main à l'horloge plutôt que de
  // boucler. Moins joli, et jamais pris.
  return `NOT-${annee}-${Date.now()}`;
}

/** Les colonnes qu'on peut écrire même quand la saisie est incomplète. */
function colonnesDepuisSaisie(s: Saisie) {
  const t = (v: string) => v.trim();
  const naissance = new Date(s.naissanceDate);

  return {
    notifierKind: s.qualite,
    notifierEmail: t(s.courriel),
    notifierName: t(s.nom),
    notifierFirstNames: t(s.prenoms) || null,
    notifierProfession: t(s.profession) || null,
    notifierAddress: t(s.adresse),
    notifierNationality: t(s.nationalite) || null,
    notifierBirthDate: Number.isNaN(naissance.getTime()) ? null : naissance,
    notifierBirthPlace: t(s.naissanceLieu) || null,
    targetName: t(s.destinataireNom),
    targetFirstNames: t(s.destinatairePrenoms) || null,
    targetAddress: t(s.destinataireAdresse) || null,
    factsDescription: t(s.faits),
    targetUrls: t(s.adressesVisees),
    legalGrounds: t(s.motifs),
    priorContact: t(s.contactPrealable),
    priorContactUnreachable: s.contactImpossible,
  };
}

function colonnesDepuisValide(v: NotificationValide) {
  return {
    notifierKind: v.qualite,
    notifierEmail: v.courriel,
    notifierName: v.nom,
    notifierFirstNames: v.prenoms,
    notifierProfession: v.profession,
    notifierAddress: v.adresse,
    notifierNationality: v.nationalite,
    notifierBirthDate: v.naissanceDate,
    notifierBirthPlace: v.naissanceLieu,
    targetName: v.destinataireNom,
    targetFirstNames: v.destinatairePrenoms,
    targetAddress: v.destinataireAdresse,
    factsDescription: v.faits,
    targetUrls: v.adressesVisees.join("\n"),
    legalGrounds: v.motifs,
    priorContact: v.contactPrealable,
    priorContactUnreachable: v.contactImpossible,
  };
}

function enFrancais(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// ════════════════════════════════════════════════════════════════ l'échéance ══

export interface BilanEcheances {
  /** Dossiers dont le délai de réponse est passé sans réponse. */
  clos: number;
}

/**
 * Clore les dossiers dont l'échéance est passée sans réponse.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SANS CE PASSAGE, L'ÉCHÉANCE NE SERAIT QU'UNE PHRASE
 *
 * On écrit à l'auteur « tu as dix jours », et on l'écrit sur la page publique.
 * Si personne ne repasse, le dossier reste en RETRAIT_PROVISOIRE
 * indéfiniment : le contenu ne revient pas — donc l'auteur est puni — et le
 * notifiant n'a jamais de réponse.
 *
 * C'est le pire des défauts silencieux : rien ne plante, l'écran est cohérent,
 * et les deux parties attendent une décision que personne ne prendra.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA CONDITION EST « L'HEURE EST PASSÉE », JAMAIS « C'EST MAINTENANT »
 *
 * Même règle que la publication planifiée du blog : chercher l'égalité ferait
 * perdre définitivement tout dossier dont l'échéance tombe pendant une panne.
 * Un passage sauté rattrape au suivant, avec du retard et rien de cassé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ACTEUR EST LA PLATEFORME, ET LE MOTIF LE DIT
 *
 * Aucun humain n'a tranché. Consigner cette décision au nom du dernier
 * modérateur qui a touché le dossier serait lui attribuer un geste qu'il n'a
 * pas posé — et c'est la trace qu'on relira si quelqu'un conteste.
 *
 * `decidedById` reste donc **nul**, et le motif écrit franchement ce qui s'est
 * passé : le délai est passé, personne n'a répondu.
 */
export async function cloreLesEcheances(
  maintenant = new Date(),
): Promise<BilanEcheances> {
  const dus = await db.legalNotice.findMany({
    where: {
      state: "RETRAIT_PROVISOIRE",
      replyDueAt: { lt: maintenant },
    },
    select: { id: true, reference: true },
    take: 200,
  });

  let clos = 0;

  for (const dossier of dus) {
    // L'état d'avant est dans le `WHERE` : une réponse arrivée entre la
    // lecture et l'écriture doit gagner. Elle est plus récente, et elle vient
    // d'une personne.
    const ecrit = await db.legalNotice.updateMany({
      where: { id: dossier.id, state: "RETRAIT_PROVISOIRE" },
      data: {
        state: "RETIREE",
        decidedAt: maintenant,
        decisionReason:
          "Délai de réponse écoulé sans contestation. Décision automatique, " +
          "sans examen humain — le dossier peut être rouvert par une nouvelle " +
          "notification ou par décision judiciaire.",
      },
    });

    if (ecrit.count !== 1) continue;
    clos += 1;

    journal.info("dossier juridique clos par échéance", {
      reference: dossier.reference,
    });
  }

  return { clos };
}
