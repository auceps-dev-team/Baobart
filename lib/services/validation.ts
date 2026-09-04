/**
 * Ce qu'on accepte de recevoir dans une offre de service.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * MOINS EXPOSÉ QUE JOBS, MAIS EXPOSÉ QUAND MÊME
 *
 * Publier un service exige trois choses : être vendeur, porter le badge
 * Freelance ou Agence, avoir un abonnement ouvert (§18.3). C'est cette porte
 * qui filtre — la validation ici borne ce qui entre, elle ne juge pas la
 * personne.
 *
 * Le module est **pur** : il reçoit des chaînes, il rend une décision. Aucune
 * requête, aucune session — ce qui permet d'éprouver chaque refus sans rien
 * monter.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DES CHIFFRES, PAS DES ADJECTIFS
 *
 * Un prix « raisonnable » et un délai « rapide » ne servent à rien pour
 * comparer. On refuse tout ce qui n'est pas un nombre : un prix vide, un
 * délai « selon disponibilité » — un catalogue de services qui laisse parler
 * les mots ne se filtre plus, et personne ne le consulte.
 */

export interface Saisie {
  titre: string;
  description: string;
  categoryId: string;
  startingPrice: string;
  deliveryDays: string;
}

export type Champ =
  | "titre"
  | "description"
  | "categoryId"
  | "startingPrice"
  | "deliveryDays";

export interface Refus {
  champ: Champ;
  message: string;
}

/** L'offre, une fois acceptée. Prête à écrire, sans retouche. */
export interface OffreValide {
  titre: string;
  description: string;
  categoryId: string;
  startingPrice: number;
  deliveryDays: number;
}

export type Verdict =
  | { ok: true; offre: OffreValide }
  | { ok: false; refus: Refus };

const TITRE_MIN = 6;
const TITRE_MAX = 120;
const DESCRIPTION_MIN = 60;
const DESCRIPTION_MAX = 8_000;

/**
 * Un prix minimum symbolique — 1 000 FCFA, l'équivalent d'à peu près 1,50 €.
 *
 * En dessous, on n'est plus dans une prestation : un service à 100 F payé par
 * mobile money coûte plus cher en frais qu'il ne rapporte. Refuser ici évite
 * une file de commandes minuscules dont personne ne vit.
 */
const PRIX_MIN = 1_000;

/**
 * Un prix maximum — 5 000 000 FCFA, à peu près 7 600 €.
 *
 * Ce plafond n'existe pas pour brider les prestations chères, mais pour
 * attraper une saisie fantaisiste : ranger cinq cent mille euros sous forme
 * de « 500000000 » est presque toujours une erreur de zéros.
 */
const PRIX_MAX = 5_000_000;

/** Un délai raisonnable : au moins un jour, au plus un an. */
const DELAI_MIN = 1;
const DELAI_MAX = 365;

export function valider(saisie: Saisie): Verdict {
  const titre = saisie.titre.trim().replace(/\s+/g, " ");
  const description = saisie.description.trim();

  if (titre.length < TITRE_MIN) {
    return refus("titre", "Donne un intitulé de service, même court.");
  }
  if (titre.length > TITRE_MAX) {
    return refus("titre", `L'intitulé ne doit pas dépasser ${TITRE_MAX} caractères.`);
  }

  // Un minimum de description écarte les « je fais de tout, contacte-moi » qui
  // n'aident personne. Un acheteur qui commande veut savoir ce qu'il reçoit.
  if (description.length < DESCRIPTION_MIN) {
    return refus(
      "description",
      "Décris ta prestation en quelques phrases : ce qui est inclus, ce qui ne l'est pas, ce que tu attends.",
    );
  }
  if (description.length > DESCRIPTION_MAX) {
    return refus("description", "La description est trop longue.");
  }

  const categoryId = saisie.categoryId.trim();
  if (categoryId.length === 0) {
    return refus("categoryId", "Choisis une catégorie.");
  }

  const prix = lireEntier(saisie.startingPrice);
  if (prix === "invalide") {
    return refus("startingPrice", "Indique un prix en chiffres.");
  }
  if (prix === null || prix < PRIX_MIN) {
    return refus(
      "startingPrice",
      `Le prix de départ doit être d'au moins ${PRIX_MIN.toLocaleString("fr-FR")} F.`,
    );
  }
  if (prix > PRIX_MAX) {
    return refus(
      "startingPrice",
      `Ce prix semble trop élevé — vérifie le nombre de zéros.`,
    );
  }

  const delai = lireEntier(saisie.deliveryDays);
  if (delai === "invalide") {
    return refus("deliveryDays", "Indique un délai en jours pleins.");
  }
  if (delai === null || delai < DELAI_MIN) {
    return refus("deliveryDays", "Le délai doit être d'au moins un jour.");
  }
  if (delai > DELAI_MAX) {
    return refus("deliveryDays", "Un délai supérieur à un an n'est plus une prestation.");
  }

  return {
    ok: true,
    offre: { titre, description, categoryId, startingPrice: prix, deliveryDays: delai },
  };
}

function refus(champ: Champ, message: string): { ok: false; refus: Refus } {
  return { ok: false, refus: { champ, message } };
}

/** Un entier positif, ou `null` si vide, ou `"invalide"` sinon. */
function lireEntier(brut: string): number | null | "invalide" {
  const propre = brut.trim().replace(/\s/g, "");
  if (propre.length === 0) return null;
  if (!/^\d+$/.test(propre)) return "invalide";
  return Number(propre);
}
