/**
 * Où en est un événement dans le temps, et peut-on encore s'y inscrire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA PHASE SE DÉDUIT DES DATES, ELLE NE SE RANGE PAS
 *
 * C'est la même leçon que Jobs et que Ndank, et elle vaut d'être répétée ici
 * parce que le schéma existant faisait exactement l'inverse : `Event.status`
 * valait `"upcoming"` par défaut, une chaîne libre qui mélangeait deux
 * questions sans rapport.
 *
 * Un statut rangé demanderait un ordonnanceur pour faire passer chaque
 * événement de « à venir » à « en cours » à l'heure dite. Le jour où ce
 * passage rate son tour — panne, déploiement, week-end — un atelier
 * commencé s'annoncerait encore à venir, et prendrait des inscriptions
 * pour une salle déjà pleine.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX QUESTIONS, DEUX RÉPONSES SÉPARÉES
 *
 *   — **l'état éditorial** — brouillon, publié, retiré — dit si le contenu
 *     existe pour le public. Il se range, parce qu'il résulte d'une décision
 *     humaine. C'est `ContentState`, partagé avec les trois autres CMS ;
 *   — **la phase** — à venir, en cours, terminé — dit où l'on en est du
 *     calendrier. Elle se calcule, parce qu'elle résulte du temps qui passe.
 *
 * Les confondre dans une seule colonne, ce que faisait `status`, rend l'une
 * des deux fausse dès qu'on touche à l'autre.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TERMINÉ N'EST PAS EXPIRÉ
 *
 * Une offre d'emploi périmée disparaît : elle n'aide plus personne, et un
 * annuaire de fantômes se vide de ses lecteurs. Un événement passé, non — on
 * vient y lire ce qui s'est produit, les résultats d'un concours, la liste
 * du jury.
 *
 * `estPublic` de `lib/cms/cycle.ts` accepte une échéance pour cette raison :
 * Jobs la lui donne, Événements ne la lui donne jamais. Un événement publié
 * le reste après sa date.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MODULE EST PUR
 *
 * Ni base, ni session. C'est ce qui permet d'éprouver « on ne s'inscrit pas à
 * un événement terminé » et « la capacité verrouille au plafond » sans rien
 * monter.
 */

import type { EtatContenu } from "@/lib/cms/cycle";

export type Phase =
  /** La date de début n'est pas encore atteinte. */
  | "A_VENIR"
  /** Commencé, pas encore fini. Une expo dure deux semaines. */
  | "EN_COURS"
  /** La date de fin est passée. Consultable, mais clos. */
  | "TERMINE";

export const LIBELLE_PHASE: Record<Phase, string> = {
  A_VENIR: "À venir",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
};

/**
 * Où en est cet événement, maintenant.
 *
 * Les bornes sont inclusives au début et exclusives à la fin : un événement
 * qui commence à 14 h est « en cours » à 14 h pile, et « terminé » à la
 * seconde où sa fin est atteinte. Sans cette convention, une des deux bornes
 * laisserait un trou d'une seconde où l'événement n'est nulle part.
 */
export function phaseDe(
  debut: Date,
  fin: Date,
  maintenant: Date = new Date(),
): Phase {
  if (maintenant < debut) return "A_VENIR";
  if (maintenant >= fin) return "TERMINE";
  return "EN_COURS";
}

/** Ce qui empêche de s'inscrire, quand quelque chose l'empêche. */
export type RefusInscription =
  /** L'événement n'est pas publié — brouillon, ou retiré. */
  | "INTROUVABLE"
  /** L'organisateur l'a annulé. Il reste visible, mais fermé. */
  | "ANNULE"
  /** La date de fin est passée. */
  | "TERMINE"
  /** Le plafond est atteint. */
  | "COMPLET"
  /** Cette personne s'est déjà inscrite. */
  | "DEJA_INSCRIT";

export type Verdict = { ok: true } | { ok: false; motif: RefusInscription };

export const MESSAGES: Record<RefusInscription, string> = {
  INTROUVABLE: "Cet événement n'est pas ouvert aux inscriptions.",
  ANNULE:
    "Cet événement a été annulé. Si tu étais inscrit·e, tu n'as rien à faire — on te recontacte.",
  TERMINE: "Cet événement est terminé.",
  COMPLET: "Toutes les places sont prises.",
  DEJA_INSCRIT: "Tu es déjà inscrit·e à cet événement.",
};

export interface EtatInscription {
  etat: EtatContenu;
  /** Posée quand l'organisateur annule. Distincte du retrait — voir plus bas. */
  annuleLe: Date | null;
  debut: Date;
  fin: Date;
  /** `null` veut dire « sans plafond ». Ce n'est pas zéro. */
  capacite: number | null;
  /** Compteur dénormalisé, comme partout ailleurs dans le projet. */
  inscrits: number;
  /** Cette personne est-elle déjà inscrite ? */
  dejaInscrit: boolean;
}

/**
 * Peut-on encore s'inscrire ?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ON S'INSCRIT ENCORE PENDANT, PAS APRÈS
 *
 * Le choix mérite d'être écrit, parce que l'inverse semble plus naturel :
 * fermer les inscriptions au coup d'envoi. Il serait faux pour la moitié du
 * catalogue — une exposition court deux semaines, un concours reste ouvert
 * jusqu'à sa clôture, un atelier en ligne accepte un retardataire. Fermer au
 * début condamnerait ces trois-là à n'accepter personne après leur première
 * heure.
 *
 * C'est donc la **fin** qui ferme. Un organisateur qui veut arrêter plus tôt
 * a deux moyens honnêtes : le plafond de capacité, ou l'annulation.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'ORDRE DES REFUS N'EST PAS INDIFFÉRENT
 *
 * On annonce d'abord ce qui est définitif — annulé, terminé — avant ce qui
 * peut changer. Dire « complet » d'un événement annulé laisserait croire
 * qu'une place peut se libérer.
 */
export function peutSInscrire(etat: EtatInscription, maintenant = new Date()): Verdict {
  if (etat.etat !== "PUBLIE") return { ok: false, motif: "INTROUVABLE" };
  if (etat.annuleLe !== null) return { ok: false, motif: "ANNULE" };

  if (phaseDe(etat.debut, etat.fin, maintenant) === "TERMINE") {
    return { ok: false, motif: "TERMINE" };
  }

  // Avant le plafond : quelqu'un de déjà inscrit doit lire « tu es inscrit »,
  // pas « c'est complet » — sur un événement plein, les deux sont vrais et
  // seul le premier l'aide.
  if (etat.dejaInscrit) return { ok: false, motif: "DEJA_INSCRIT" };

  if (etat.capacite !== null && etat.inscrits >= etat.capacite) {
    return { ok: false, motif: "COMPLET" };
  }

  return { ok: true };
}

/**
 * Combien de places restent, quand il y a un plafond.
 *
 * `null` pour un événement sans capacité déclarée — et surtout pas un grand
 * nombre : « 999 places restantes » se lit comme une information, alors que
 * c'est une absence d'information.
 *
 * Jamais négatif : un plafond abaissé après coup rendrait un reste négatif,
 * qui s'afficherait tel quel.
 */
export function placesRestantes(
  capacite: number | null,
  inscrits: number,
): number | null {
  if (capacite === null) return null;
  return Math.max(0, capacite - inscrits);
}
