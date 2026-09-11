/**
 * Ce qu'on accepte de recevoir dans un événement.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL EST PUR
 *
 * Il reçoit des chaînes, il rend une décision. Aucune requête, aucune session —
 * ce qui permet d'éprouver chaque refus sans rien monter.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES HEURES SONT LUES EN GMT, ET C'EST UNE SIMPLIFICATION ASSUMÉE
 *
 * Un champ `datetime-local` rend « 2026-10-10T14:00 » sans fuseau. Il faut
 * bien décider ce que « 14 h » veut dire.
 *
 * On l'interprète en **GMT**, ce qui est exact pour Abidjan, Dakar, Bamako,
 * Ouagadougou, Lomé et Accra — toute la zone où Baobart travaille — et faux
 * d'une heure pour Douala. Le jour où un événement camerounais sera saisi, il
 * faudra un champ de fuseau sur `Event` ; l'inventer aujourd'hui ferait porter
 * un sélecteur de fuseau à tous les écrans pour un cas qui n'existe pas encore.
 *
 * Ce qui compte est que la règle soit **écrite à un seul endroit** : ici, à la
 * saisie. La disperser dans chaque écran d'affichage garantirait que l'un
 * d'eux l'oublie.
 */

import { GENRES, type EventKind } from "@/lib/evenements/enums";

export interface Saisie {
  titre: string;
  description: string;
  genre: string;
  debut: string;
  fin: string;
  lieu: string;
  enLigne: string;
  capacite: string;
  prixBillet: string;
  dotation: string;
}

export type Champ =
  | "titre"
  | "description"
  | "genre"
  | "debut"
  | "fin"
  | "lieu"
  | "capacite"
  | "prixBillet"
  | "dotation";

export interface Refus {
  champ: Champ;
  message: string;
}

/** L'événement, une fois accepté. Prêt à écrire, sans retouche. */
export interface EvenementValide {
  titre: string;
  description: string;
  genre: EventKind;
  debut: Date;
  fin: Date;
  lieu: string | null;
  enLigne: boolean;
  capacite: number | null;
  prixBillet: number | null;
  dotation: number | null;
}

export type Verdict =
  | { ok: true; evenement: EvenementValide }
  | { ok: false; refus: Refus };

const TITRE_MIN = 6;
const TITRE_MAX = 120;
const DESCRIPTION_MIN = 60;
const DESCRIPTION_MAX = 8_000;
const LIEU_MAX = 160;

/**
 * Un an. Au-delà, ce n'est plus un événement mais une saison — et la fiche
 * unique cesse d'aider : personne ne s'inscrit à « quelque chose, un jour ».
 */
const DUREE_MAX_JOURS = 365;

/** Cent mille places. Au-delà, c'est presque toujours une faute de frappe. */
const CAPACITE_MAX = 100_000;

/** Cinq millions de francs, comme le plafond de prix des services. */
const MONTANT_MAX = 5_000_000;

export function valider(saisie: Saisie): Verdict {
  const titre = saisie.titre.trim().replace(/\s+/g, " ");
  const description = saisie.description.trim();

  if (titre.length < TITRE_MIN) {
    return refus("titre", "Donne un titre à l'événement, même court.");
  }
  if (titre.length > TITRE_MAX) {
    return refus("titre", `Le titre ne doit pas dépasser ${TITRE_MAX} caractères.`);
  }

  if (description.length < DESCRIPTION_MIN) {
    return refus(
      "description",
      "Décris l'événement en quelques phrases : ce qui s'y passe, pour qui, ce qu'il faut prévoir.",
    );
  }
  if (description.length > DESCRIPTION_MAX) {
    return refus("description", "La description est trop longue.");
  }

  if (!GENRES.includes(saisie.genre as EventKind)) {
    return refus("genre", "Choisis un type d'événement.");
  }

  const debut = lireInstant(saisie.debut);
  if (debut === "invalide") {
    return refus("debut", "Date et heure de début attendues.");
  }
  if (debut === null) {
    return refus("debut", "Indique quand l'événement commence.");
  }

  const fin = lireInstant(saisie.fin);
  if (fin === "invalide") {
    return refus("fin", "Date et heure de fin attendues.");
  }
  if (fin === null) {
    return refus("fin", "Indique quand l'événement se termine.");
  }

  // Une fin avant le début n'est pas une omission : c'est une saisie inversée,
  // et l'écrire telle quelle donnerait une phase « terminé » dès la création.
  if (fin <= debut) {
    return refus("fin", "La fin doit venir après le début.");
  }

  const jours = (fin.getTime() - debut.getTime()) / 86_400_000;
  if (jours > DUREE_MAX_JOURS) {
    return refus("fin", "Un événement ne peut pas durer plus d'un an.");
  }

  const enLigne = saisie.enLigne === "on" || saisie.enLigne === "true";
  const lieu = saisie.lieu.trim().slice(0, LIEU_MAX);

  // En présentiel, l'adresse n'est pas un détail : c'est la seule chose qui
  // permette de venir. Une fiche sans lieu fait écrire tous les inscrits.
  if (!enLigne && lieu.length === 0) {
    return refus("lieu", "Indique où l'événement a lieu, ou coche « en ligne ».");
  }

  const capacite = lireEntier(saisie.capacite);
  if (capacite === "invalide") {
    return refus("capacite", "Indique un nombre de places, ou laisse vide.");
  }
  if (capacite !== null && capacite < 1) {
    return refus("capacite", "Une capacité de zéro n'ouvre aucune place. Laisse vide pour ne pas plafonner.");
  }
  if (capacite !== null && capacite > CAPACITE_MAX) {
    return refus("capacite", "Ce nombre de places semble trop élevé — vérifie la saisie.");
  }

  const prixBillet = lireEntier(saisie.prixBillet);
  if (prixBillet === "invalide") {
    return refus("prixBillet", "Indique un prix en chiffres, ou laisse vide pour un événement gratuit.");
  }
  if (prixBillet !== null && prixBillet > MONTANT_MAX) {
    return refus("prixBillet", "Ce prix semble trop élevé — vérifie le nombre de zéros.");
  }

  const dotation = lireEntier(saisie.dotation);
  if (dotation === "invalide") {
    return refus("dotation", "Indique une dotation en chiffres, ou laisse vide.");
  }
  if (dotation !== null && dotation > MONTANT_MAX) {
    return refus("dotation", "Cette dotation semble trop élevée — vérifie le nombre de zéros.");
  }

  return {
    ok: true,
    evenement: {
      titre,
      description,
      genre: saisie.genre as EventKind,
      debut,
      fin,
      // Un lieu laissé par mégarde ne survit pas au passage « en ligne » :
      // sinon la fiche annonce une adresse ET un lien, et l'on ne sait plus.
      lieu: enLigne ? null : lieu,
      enLigne,
      capacite,
      // Zéro et « vide » disent la même chose — gratuit. On range `null`,
      // pour n'avoir qu'une écriture de la gratuité à lire.
      prixBillet: prixBillet === 0 ? null : prixBillet,
      dotation: dotation === 0 ? null : dotation,
    },
  };
}

function refus(champ: Champ, message: string): { ok: false; refus: Refus } {
  return { ok: false, refus: { champ, message } };
}

/**
 * Un instant, lu d'un champ `datetime-local`.
 *
 * Le suffixe `:00Z` force la lecture en GMT — voir l'en-tête. Sans lui,
 * `new Date()` interpréterait la chaîne dans le fuseau du serveur, et la même
 * saisie donnerait deux heures différentes selon l'endroit où tourne le code.
 */
function lireInstant(brut: string): Date | null | "invalide" {
  const propre = brut.trim();
  if (propre.length === 0) return null;

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(propre)) return "invalide";

  const valeur = new Date(`${propre}:00Z`);
  return Number.isNaN(valeur.getTime()) ? "invalide" : valeur;
}

/** Un entier positif, ou `null` si vide, ou `"invalide"` sinon. */
function lireEntier(brut: string): number | null | "invalide" {
  const propre = brut.trim().replace(/\s/g, "");
  if (propre.length === 0) return null;
  if (!/^\d+$/.test(propre)) return "invalide";
  return Number(propre);
}
