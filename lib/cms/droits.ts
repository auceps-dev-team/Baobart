import type { Pouvoir, RolePlateforme } from "@/lib/auth/administration";
import { peut } from "@/lib/auth/administration";

/**
 * Qui a le droit de publier quoi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES QUATRE CMS N'ONT PAS LE MÊME RÉGIME
 *
 * C'est le point qui décide de toute leur construction, et la pente naturelle
 * est de l'oublier : ce sont quatre listes avec un éditeur, on les traite
 * uniformément, et l'on obtient soit un blog que n'importe qui écrit, soit un
 * annuaire d'offres que personne ne peut remplir.
 *
 *   BLOG, ÉVÉNEMENTS   l'administration seule
 *   JOBS               tout inscrit — lecture publique, action authentifiée
 *   SERVICES           vendeur, abonné, badgé Freelance ou Agence
 *
 * Voir `SPEC_ADMIN_CMS_BAOBART.md` §18, qui arbitre et prime sur les §§4 à 7.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE DROIT SE CALCULE, IL NE SE RANGE PAS
 *
 * Une colonne `peutPublierDesServices` serait plus rapide à lire et fausse au
 * premier renouvellement manqué. Les conditions se relisent à chaque fois,
 * depuis ce qui fait autorité : la progression du compte, l'état Ndank de son
 * abonnement, ses badges.
 *
 * C'est la même leçon qu'ailleurs dans ce projet — `lib/auth/roles.ts` déduit
 * l'étape d'un compte de son activité, Ndank déduit l'état d'un abonnement de
 * ses dates. Un statut rangé se désynchronise dès qu'un passage rate son tour.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MODULE EST PUR
 *
 * Il reçoit des faits, il rend une décision. Aucune requête, aucune session :
 * c'est ce qui permet d'éprouver « un abonnement suspendu ferme la publication
 * sans fermer les prestations en cours » sans rien monter.
 */

export type TypeDeContenu = "job" | "service" | "evenement" | "article";

/**
 * Ce qu'on sait de la personne au moment de décider.
 *
 * Rien n'est optionnel : un champ absent serait lu comme « faux », et un droit
 * refusé par oubli est aussi difficile à diagnostiquer qu'un droit accordé par
 * erreur.
 */
export interface Demandeur {
  role: RolePlateforme;
  /** A publié au moins une ressource — au sens de `lib/auth/roles.ts`. */
  estVendeur: boolean;
  /** Abonnement `ACTIVE` ou dans la grâce — au sens de Ndank. */
  abonnementOuvert: boolean;
  /** Porte le badge Freelance ou Agence, accordé par l'administration. */
  badgeProfessionnel: boolean;
}

export type Refus =
  /** Il faut un compte. Rien de plus. */
  | "CONNEXION_REQUISE"
  /** Réservé à l'administration. */
  | "RESERVE_A_L_ADMINISTRATION"
  /** Il faut avoir publié quelque chose pour être vendeur. */
  | "PAS_ENCORE_VENDEUR"
  /** Le badge Freelance ou Agence manque, et il s'accorde. */
  | "BADGE_MANQUANT"
  /** L'abonnement n'est plus ouvert. */
  | "ABONNEMENT_A_RENOUVELER";

export type Verdict = { ok: true } | { ok: false; motif: Refus };

export const MESSAGES: Record<Refus, string> = {
  CONNEXION_REQUISE: "Connecte-toi pour publier.",
  RESERVE_A_L_ADMINISTRATION:
    "Ce contenu est publié par l'équipe Baobart. Écris-nous si tu as quelque chose à proposer.",
  PAS_ENCORE_VENDEUR:
    "Publie d'abord une ressource : on devient vendeur en publiant, pas en le déclarant.",
  BADGE_MANQUANT:
    "Les services sont réservés aux comptes Freelance et Agence. Le badge s'accorde après vérification — écris-nous.",
  ABONNEMENT_A_RENOUVELER:
    "Ton abonnement doit être à jour pour publier de nouveaux services. Ceux qui sont en ligne ne bougent pas.",
};

/**
 * Cette personne peut-elle publier ce type de contenu ?
 *
 * `null` veut dire « personne » : un visiteur non connecté. C'est un cas à part
 * entière, pas une absence — sur Jobs, il a le droit de LIRE, et c'est
 * `peutLire` qui le dit.
 */
export function peutPublier(
  qui: Demandeur | null,
  type: TypeDeContenu,
): Verdict {
  if (qui === null) return { ok: false, motif: "CONNEXION_REQUISE" };

  switch (type) {
    // ── Blog et événements : l'administration, et personne d'autre ─────────
    //
    // Ce sont des contenus qui portent la voix de Baobart. Un article signé du
    // site engage le site.
    case "article":
    case "evenement":
      return peut(qui.role, "publier_du_contenu")
        ? { ok: true }
        : { ok: false, motif: "RESERVE_A_L_ADMINISTRATION" };

    // ── Jobs : tout inscrit ────────────────────────────────────────────────
    //
    // Aucune condition au-delà du compte. Ce qui protège n'est pas le droit
    // d'entrée — un compte se crée en deux minutes — mais la modération : rien
    // ne paraît avant relecture.
    case "job":
      return { ok: true };

    // ── Services : trois conditions cumulatives ────────────────────────────
    //
    // L'ordre des refus n'est pas indifférent. On annonce d'abord ce qui
    // demande le plus de travail : quelqu'un qui n'est pas encore vendeur n'a
    // que faire d'apprendre qu'il lui manque aussi un badge.
    case "service": {
      // L'administration passe outre : elle publie pour dépanner un créateur,
      // et son geste est tracé à l'audit.
      if (peut(qui.role, "publier_du_contenu")) return { ok: true };

      if (!qui.estVendeur) return { ok: false, motif: "PAS_ENCORE_VENDEUR" };
      if (!qui.badgeProfessionnel) return { ok: false, motif: "BADGE_MANQUANT" };
      if (!qui.abonnementOuvert) {
        return { ok: false, motif: "ABONNEMENT_A_RENOUVELER" };
      }
      return { ok: true };
    }
  }
}

/**
 * Qui peut lire ce type de contenu, une fois publié ?
 *
 * Tout le monde, sans exception, y compris sans compte. C'est écrit ici plutôt
 * que sous-entendu : une fonction qui rend toujours vrai a l'air inutile, mais
 * elle est l'endroit où l'on viendra le changer si un CMS devient réservé — et
 * sans elle, ce changement serait éparpillé dans quatre écrans.
 */
export function peutLire(): boolean {
  return true;
}

/**
 * Qui peut agir sur un contenu publié — postuler, s'inscrire, commander ?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * VOIR EST PUBLIC, AGIR NE L'EST PAS
 *
 * C'est le resserrement du 2 septembre 2026, et il fait disparaître la surface
 * d'attaque la plus large du projet : un formulaire public qui écrit en base.
 *
 * Il ne filtre pas les arnaques — un compte gratuit se crée en deux minutes —
 * mais il donne quelqu'un à qui les imputer. On peut suspendre un compte ; on
 * ne peut pas suspendre un visiteur.
 */
export function peutAgir(qui: Demandeur | null): Verdict {
  return qui === null ? { ok: false, motif: "CONNEXION_REQUISE" } : { ok: true };
}

/** Le pouvoir d'administration qui modère ce type de contenu. */
export function pouvoirDeModeration(type: TypeDeContenu): Pouvoir {
  // Blog et événements n'ont pas de file : leur auteur portait déjà le droit
  // de publier. Le pouvoir rendu ici sert au retrait, qui reste possible.
  return type === "article" || type === "evenement"
    ? "publier_du_contenu"
    : "moderer_le_contenu";
}

/**
 * Ce type de contenu passe-t-il par une relecture avant de paraître ?
 *
 * Dérivé du régime, jamais écrit deux fois : c'est ce qui garantit qu'un
 * contenu ouvert à tous ne puisse pas paraître sans avoir été lu.
 */
export function exigeUneRelecture(type: TypeDeContenu): boolean {
  return type === "job" || type === "service";
}
