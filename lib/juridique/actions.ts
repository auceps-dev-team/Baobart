"use server";

import { revalidatePath } from "next/cache";

import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { sessionCourante } from "@/lib/auth/session";
import type { Manque, Qualite, Saisie } from "@/lib/juridique/article47";
import { texteDuBilan, type BilanRetrait } from "@/lib/juridique/retrait";
import { verifierLimiteAction } from "@/lib/securite/garde";
import {
  MESSAGES_ECHEC,
  deposer,
  rapprocher,
  repondre,
  retirerProvisoirement,
  trancher,
  type Sens,
} from "@/lib/juridique/dossier";

/**
 * Les gestes sur un dossier juridique.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE DÉPÔT EST OUVERT À QUI N'A PAS DE COMPTE
 *
 * C'est la seule action publique de tout le projet qui écrit en base sans
 * session. Ce n'est pas un oubli : la personne dont on a repris le travail
 * n'est pas forcément inscrite sur Baobart, et lui demander de créer un compte
 * pour pouvoir se plaindre reviendrait à lui opposer une condition que la loi
 * ne pose pas — l'article 47 parle de « la victime ou d'une personne
 * intéressée », sans autre qualité.
 *
 * Ce que ça coûte est borné par `juridique.depot` : trois dépôts par heure et
 * par adresse. C'est la seule règle de `lib/securite/limites.ts` qui protège
 * une écriture **anonyme** — toutes les autres bornent un geste qui exige déjà
 * un compte.
 *
 * Trois, et non cinq comme les autres dépôts, parce que le geste n'a pas le
 * même effet : une offre d'emploi en trop fait une ligne dans une file ; une
 * notification en trop fait retirer le travail de quelqu'un.
 *
 * Ce que la borne ne règle pas : quelqu'un de patient. Une limite par adresse
 * n'arrête pas un acharnement lent — c'est l'article 49, qui punit la mauvaise
 * foi d'un à cinq ans, qui répond à ce cas-là, et l'écran l'affiche.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES GESTES DE TRAITEMENT EXIGENT `moderer_le_contenu`
 *
 * Retirer, trancher, rapprocher d'un compte : chacun passe par
 * `exigerLePouvoir`. Un module « use server » expose chacun de ses exports au
 * navigateur — la garde est ici, pas dans l'écran.
 */

export type EtatDepot =
  | { ok: true; reference: string; complete: true }
  | { ok: true; reference: string; complete: false; manques: Manque[] }
  | { ok: false; message: string };

/**
 * Le geste a-t-il abouti, et qu'a-t-il atteint.
 *
 * `avis` n'est pas une erreur : le geste a réussi. Il porte ce que le retrait
 * n'a PAS touché — une adresse qui ne désigne aucune ressource, ou un dossier
 * qui n'en désignait aucune du tout. Sans lui, « retiré » s'afficherait à
 * l'identique qu'on ait retiré trois ressources ou zéro.
 */
export type EtatGeste =
  | { ok: true; avis?: string }
  | { ok: false; message: string };

// ════════════════════════════════════════════════════════════════════ dépôt ══

export async function deposerUneNotification(
  _precedent: EtatDepot | null,
  donnees: FormData,
): Promise<EtatDepot> {
  // La borne AVANT toute écriture. Un dépôt refusé ne doit rien coûter de plus
  // qu'une lecture de compteur — et surtout il ne doit pas laisser de dossier
  // derrière lui : une référence consommée par un robot est une référence qui
  // manquera dans la numérotation d'une vraie notification.
  const borne = await verifierLimiteAction("juridique.depot");
  if (!borne.autorise) {
    return {
      ok: false,
      message:
        `Trop de dépôts depuis cette connexion. Réessaie dans ` +
        `${Math.ceil(borne.dansSecondes / 60)} minutes. ` +
        `Si tu dois signaler plusieurs contenus, une seule notification peut ` +
        `en lister plusieurs — une adresse par ligne.`,
    };
  }

  const saisie = lireSaisie(donnees);
  const suite = await deposer({ saisie });

  if (!suite.complete) {
    return {
      ok: true,
      reference: suite.reference,
      complete: false,
      manques: suite.manques,
    };
  }

  revalidatePath("/dashboard/signalements");
  return { ok: true, reference: suite.reference, complete: true };
}

// ═══════════════════════════════════════════════════════════════ traitement ══

export async function retirerLeContenu(reference: string): Promise<EtatGeste> {
  const qui = await exigerLePouvoir("moderer_le_contenu");

  const suite = await retirerProvisoirement({ reference, parId: qui.id });
  if (!suite.ok) return { ok: false, message: MESSAGES_ECHEC[suite.motif] };

  revalidatePath("/dashboard/signalements");

  // Les fiches retirées, et la liste où elles apparaissaient. Sans ça, la
  // ressource sort de la base et reste dans le cache de la page — un retrait
  // qui a eu lieu et qu'on continue de voir.
  for (const slug of suite.retrait.suspendus) {
    revalidatePath(`/products/${slug}`);
  }
  if (suite.retrait.suspendus.length > 0) revalidatePath("/explore");

  return { ok: true, avis: avisDeRetrait(suite.retrait) };
}

/**
 * Ce que le modérateur doit lire après avoir cliqué.
 *
 * Rien à dire quand tout a été atteint — un message systématique se lit sans
 * être lu, et celui-ci doit se remarquer. Le cas qui compte est « zéro
 * ressource retirée » : le dossier passe en retrait provisoire, l'auteur
 * reçoit « un de tes contenus a été retiré », et rien n'a bougé.
 */
function avisDeRetrait(retrait: BilanRetrait): string | undefined {
  // Le même texte que la fiche du dossier, qui le reconstitue depuis la base
  // et l'affiche durablement (voir `bilanEnregistre`).
  if (retrait.nonResolues.length === 0) return undefined;
  return texteDuBilan(retrait);
}

export async function trancherLeDossier(
  reference: string,
  sens: Sens,
  motif: string,
): Promise<EtatGeste> {
  const qui = await exigerLePouvoir("moderer_le_contenu");

  const suite = await trancher({ reference, parId: qui.id, sens, motif });
  if (!suite.ok) {
    // `ETAT` recouvre ici deux choses : un motif trop court, et un dossier déjà
    // tranché. Le message le dit, parce que l'écran ne peut pas deviner.
    return {
      ok: false,
      message:
        suite.motif === "ETAT"
          ? "Écris un motif d'au moins huit caractères — et vérifie que le dossier est encore ouvert."
          : MESSAGES_ECHEC[suite.motif],
    };
  }

  revalidatePath("/dashboard/signalements");
  return { ok: true };
}

export async function rapprocherDUnCompte(
  reference: string,
  userId: string | null,
): Promise<EtatGeste> {
  const qui = await exigerLePouvoir("moderer_le_contenu");

  const suite = await rapprocher({ reference, userId, parId: qui.id });
  if (!suite.ok) return { ok: false, message: MESSAGES_ECHEC[suite.motif] };

  revalidatePath("/dashboard/signalements");
  return { ok: true };
}

/**
 * L'auteur répond.
 *
 * Il doit être connecté — c'est son contenu, donc son compte. Et le dossier
 * doit lui être rapproché : répondre au dossier de quelqu'un d'autre reviendrait
 * à renoncer en son nom.
 */
export async function repondreAuDossier(
  reference: string,
  _precedent: EtatGeste | null,
  donnees: FormData,
): Promise<EtatGeste> {
  const qui = await sessionCourante();
  if (!qui) return { ok: false, message: "Connecte-toi pour répondre." };

  const suite = await repondre({
    reference,
    auteurId: qui.id,
    corps: texte(donnees, "corps"),
  });

  if (!suite.ok) {
    return {
      ok: false,
      message:
        suite.motif === "ETAT"
          ? "Écris au moins une phrase — et vérifie que le délai n'est pas passé."
          : MESSAGES_ECHEC[suite.motif],
    };
  }

  revalidatePath("/dashboard/mes-dossiers");
  revalidatePath("/dashboard/signalements");
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════ outils ══

function lireSaisie(d: FormData): Saisie {
  const qualite: Qualite =
    texte(d, "qualite") === "PERSONNE_MORALE" ? "PERSONNE_MORALE" : "PERSONNE_PHYSIQUE";

  return {
    qualite,
    courriel: texte(d, "courriel"),
    nom: texte(d, "nom"),
    adresse: texte(d, "adresse"),
    prenoms: texte(d, "prenoms"),
    profession: texte(d, "profession"),
    nationalite: texte(d, "nationalite"),
    naissanceDate: texte(d, "naissanceDate"),
    naissanceLieu: texte(d, "naissanceLieu"),
    destinataireNom: texte(d, "destinataireNom"),
    destinatairePrenoms: texte(d, "destinatairePrenoms"),
    destinataireAdresse: texte(d, "destinataireAdresse"),
    faits: texte(d, "faits"),
    adressesVisees: texte(d, "adressesVisees"),
    motifs: texte(d, "motifs"),
    contactPrealable: texte(d, "contactPrealable"),
    contactImpossible: d.get("contactImpossible") === "on",
  };
}

function texte(donnees: FormData, champ: string): string {
  const valeur = donnees.get(champ);
  return typeof valeur === "string" ? valeur : "";
}
