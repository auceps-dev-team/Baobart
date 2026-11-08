import { ENCRE, BLANC, JAUNE, LAVANDE, MAUVE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Les mérites : ce que l'activité d'un compte constate.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CALCULÉS À L'AFFICHAGE, JAMAIS RANGÉS (décision du 04/11/2026)
 *
 * Un mérite est **dérivé** (`Doc/MAQUETTES_A_FAIRE.md` §E.8) : « un statut
 * rangé en base se désynchronise dès qu'un passage rate son tour ». Le
 * symptôme serait un « Cent ventes » porté par quelqu'un qui en a eu quarante
 * remboursées. On le recalcule donc à chaque lecture, depuis des mesures
 * (`lib/badges/mesures.ts`), et ce module ne fait que trancher.
 *
 * Conséquence assumée : rien ne se souvient qu'un mérite a été porté. La
 * maquette dessine « Répond vite · en pause, retiré le 28 août » ; sans
 * stockage, cette ligne-là n'existe pas. Le profil cesse simplement de
 * l'afficher, ce que la maquette demande aussi.
 *
 * Une exception, décidée le 08/11/2026 : « Créateur du mois » est rangé, pour
 * pouvoir s'annoncer et porter sa date de fin (voir `TETE_DU_MOIS`).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN MÉRITE N'OUVRE AUCUN DROIT
 *
 * « Sinon publier cent ressources bidon devient un chemin d'élévation de
 * privilège » (Baobart Badges.dc.html). Rien dans le code ne doit lire ce
 * module pour décider d'un accès. Les droits vivent dans les statuts
 * (`lib/badges/statuts.ts`).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS MÉRITES NE SE MESURENT PAS ENCORE
 *
 * « Bien noté » et « Bon public » attendent les avis notés (lot 4 de
 * l'inventaire) : il n'existe aucune table d'avis. « Répond vite » attend un
 * canal de réponse sur la plateforme : la maquette le définit sur les
 * services, et une demande de service part aujourd'hui par courriel
 * (`lib/services/contact.ts`) — aucune réponse n'est enregistrée. Décidé le
 * 08/11/2026 : il se mesurera sur les échanges des commandes sur mesure
 * (lot 10), plutôt que par une adresse relais de courriel. Ils restent
 * au catalogue, avec leur critère publié et la raison de leur absence ; ils
 * ne s'obtiennent pas et ne figurent jamais parmi « les trois plus proches ».
 *
 * Pur : ni base, ni horloge. `maintenant` arrive avec les mesures.
 */

export type CodeMerite =
  | "NEW_TALENT"
  | "PIONEER"
  | "ONE_YEAR"
  | "THREE_YEARS"
  | "LOYAL_SUBSCRIBER"
  | "FIRST_PUBLICATION"
  | "TEN_RESOURCES"
  | "FIFTY_RESOURCES"
  | "HUNDRED_RESOURCES"
  | "FIRST_SALE"
  | "TEN_SALES"
  | "HUNDRED_SALES"
  | "THOUSAND_SALES"
  | "TOP_CREATOR"
  | "WELL_RATED"
  | "NO_DISPUTE"
  | "FAST_RESPONDER"
  | "COMMUNITY_PILLAR"
  | "HELPFUL_REVIEWER"
  | "VIP_CREATOR";

export type FamilleMerite = "ANCIENNETE" | "PRODUCTION" | "VENTES" | "QUALITE" | "COMMUNAUTE";

export const FAMILLES_MERITE: ReadonlyArray<{ code: FamilleMerite; titre: string; sousTitre: string }> = [
  { code: "ANCIENNETE", titre: "Ancienneté", sousTitre: "Depuis la date d'inscription et les cycles d'abonnement" },
  { code: "PRODUCTION", titre: "Production", sousTitre: "Depuis le nombre de ressources publiées" },
  { code: "VENTES", titre: "Ventes", sousTitre: "Depuis les ventes abouties" },
  { code: "QUALITE", titre: "Qualité", sousTitre: "Depuis les avis et les litiges" },
  { code: "COMMUNAUTE", titre: "Communauté", sousTitre: "Depuis les abonnés et les avis rédigés" },
];

/**
 * Pionnier : les 200 premiers comptes inscrits. Tranché par l'utilisateur le
 * 04/11/2026. La maquette exige que N soit « figé une fois pour toutes, et
 * publié » : ne plus le changer.
 */
export const PIONNIERS = 200;

/**
 * Créateur du mois, validé par l'utilisateur le 08/11/2026 : les 5 % de tête
 * parmi les créateurs qui ont vendu sur les 30 derniers jours, avec au moins
 * 20 acheteurs différents. Le plancher reprend `SPEC_GAMIFICATION` §3.1, qui
 * l'imposait sur 90 jours ; la fenêtre de 30 jours est celle de la maquette.
 * Les avis entreront dans le score au lot 4.
 *
 * Le seul mérite RANGÉ en base, par décision du même jour : il s'annonce
 * quand on le gagne (« 🎉 », `SPEC_GAMIFICATION` §5), et il porte sa date de
 * fin (« sa valeur vient de sa date », maquette). Un passage quotidien le
 * décide (`lib/badges/createur-du-mois.ts`) ; l'affichage ne fait que lire.
 */
export const TETE_DU_MOIS = { jours: 30, partDeTete: 0.05, plancher: 20 } as const;

/**
 * Un abonné compte quand son compte n'est ni suspendu, ni effacé, et qu'il a
 * au moins sept jours. Décidé le 08/11/2026 : sans cela, cinq cents comptes
 * jetables ouverts dans l'heure donnaient « Pilier ».
 */
export const ABONNE_COMPTE_APRES_JOURS = 7;

/**
 * Ce qu'il faut savoir d'un compte pour trancher ses mérites.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DES ACHETEURS, PAS DES VENTES (décision du 08/11/2026)
 *
 * Les mérites de vente comptent des acheteurs DIFFÉRENTS : cent comptes qui
 * achètent une ressource à 100 F donnaient « Cent ventes » pour 10 000 F
 * (`SPEC_GAMIFICATION` §6, « anti-abus non négociable »). Le tableau de bord,
 * lui, continue de compter les ventes : il mesure l'activité, pas un mérite.
 */
export interface Mesures {
  maintenant: Date;
  inscritLe: Date;
  /** 1 pour le premier compte inscrit sur la plateforme. */
  rangDInscription: number;
  ressourcesPubliees: number;
  /** Acheteurs différents d'au moins une vente aboutie (`lib/badges/mesures.ts`). */
  acheteurs: number;
  /** Les mêmes, comptés depuis le dernier litige ouvert ou perdu. */
  acheteursDepuisLeDernierLitige: number;
  /** Abonnés qui comptent (`ABONNE_COMPTE_APRES_JOURS`). */
  abonnes: number;
  /** Cycles d'abonnement payés d'affilée, en cours (voir `cyclesPayesDAffilee`). */
  cyclesPayesDAffilee: number;
  /** La fin du titre « Créateur du mois » rangé en base, ou `null`. */
  createurDuMoisJusquAu: Date | null;
  /** Distinction éditoriale, posée par l'administration. */
  vip: boolean;
}

export interface Progression {
  valeur: number;
  cible: number;
  /** « il te manque 3 ventes », « encore 41 jours ». */
  ecart: string;
  /** « 997 ventes abouties sur 1 000 ». */
  detail: string;
}

export interface Merite {
  code: CodeMerite;
  nom: string;
  famille: FamilleMerite;
  /** Le chiffre sur le jeton : « le jeton porte le chiffre, pas une étoile ». */
  glyphe: string;
  fond: string;
  encre: string;
  /** Le critère publié, tel qu'il s'affiche. */
  critere: string;
  /** Pourquoi il ne s'obtient pas encore. `null` : il se mesure. */
  enAttente: string | null;
  obtenu: (m: Mesures) => boolean;
  /**
   * La distance, quand elle a un sens. `null` pour ce qui ne se rapproche
   * pas : un rang d'inscription, un classement, une distinction accordée.
   */
  progression: (m: Mesures) => Progression | null;
}

const JOUR = 86_400_000;

function nombre(n: number): string {
  return n.toLocaleString("fr-FR");
}

function accorde(n: number, singulier: string, pluriel: string): string {
  return `${nombre(n)} ${n > 1 ? pluriel : singulier}`;
}

function anniversaire(depuis: Date, ans: number): Date {
  const d = new Date(depuis);
  d.setUTCFullYear(d.getUTCFullYear() + ans);
  return d;
}

function jamais(): null {
  return null;
}

/** Un palier sur un compteur : 1, 10, 100 ventes… */
function palier(
  base: Omit<Merite, "obtenu" | "progression" | "enAttente">,
  lire: (m: Mesures) => number,
  cible: number,
  unite: { singulier: string; pluriel: string; detail: string; detailSingulier: string; note?: string },
): Merite {
  return {
    ...base,
    enAttente: null,
    obtenu: (m) => lire(m) >= cible,
    progression: (m) => {
      const valeur = Math.min(lire(m), cible);
      const reste = cible - valeur;
      return {
        valeur,
        cible,
        ecart: `il te manque ${accorde(reste, unite.singulier, unite.pluriel)}`,
        // En français, 0 et 1 s'accordent au singulier : « 1 ressource publiée ».
        detail: `${nombre(lire(m))} ${lire(m) > 1 ? unite.detail : unite.detailSingulier} sur ${nombre(cible)}${unite.note ? ` · ${unite.note}` : ""}`,
      };
    },
  };
}

/** Un anniversaire d'inscription. La distance se compte en jours. */
function anciennete(base: Omit<Merite, "obtenu" | "progression" | "enAttente">, ans: number): Merite {
  return {
    ...base,
    enAttente: null,
    obtenu: (m) => m.maintenant >= anniversaire(m.inscritLe, ans),
    progression: (m) => {
      const cible = anniversaire(m.inscritLe, ans).getTime() - m.inscritLe.getTime();
      const ecoule = Math.min(Math.max(m.maintenant.getTime() - m.inscritLe.getTime(), 0), cible);
      const jours = Math.ceil((cible - ecoule) / JOUR);
      return {
        valeur: ecoule,
        cible,
        ecart: `encore ${accorde(jours, "jour", "jours")}`,
        detail: `inscrit le ${m.inscritLe.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`,
      };
    },
  };
}

function enAttente(base: Omit<Merite, "obtenu" | "progression" | "enAttente">, raison: string): Merite {
  return { ...base, enAttente: raison, obtenu: () => false, progression: jamais };
}

const NOUVEAU_TALENT_JOURS = 90;

/** « il te manque 3 ventes à de nouveaux acheteurs » — la règle se lit dans la distance. */
const ACHETEURS = {
  singulier: "vente à un nouvel acheteur",
  pluriel: "ventes à de nouveaux acheteurs",
  detail: "acheteurs différents",
  detailSingulier: "acheteur différent",
};

/** Les vingt mérites de la maquette, dans l'ordre de ses familles (E.2 → E.6). */
export const MERITES: readonly Merite[] = [
  // ── E.2 · Ancienneté ─────────────────────────────────────────────────────
  {
    code: "NEW_TALENT",
    nom: "Nouveau talent",
    famille: "ANCIENNETE",
    glyphe: "★",
    fond: JAUNE,
    encre: ENCRE,
    critere: "Compte de moins de 90 jours, et au moins une ressource publiée.",
    enAttente: null,
    // « Disparaît au 91e jour — c'est voulu, ce n'est pas une perte. »
    obtenu: (m) =>
      m.maintenant.getTime() - m.inscritLe.getTime() < NOUVEAU_TALENT_JOURS * JOUR && m.ressourcesPubliees >= 1,
    progression: (m) => {
      const restants = Math.ceil(
        (m.inscritLe.getTime() + NOUVEAU_TALENT_JOURS * JOUR - m.maintenant.getTime()) / JOUR,
      );
      if (restants <= 0) return null;
      return {
        valeur: Math.min(m.ressourcesPubliees, 1),
        cible: 1,
        ecart: "il te manque 1 ressource publiée",
        detail: `à publier d'ici ${accorde(restants, "jour", "jours")}`,
      };
    },
  },
  {
    code: "PIONEER",
    nom: "Pionnier",
    famille: "ANCIENNETE",
    glyphe: "◈",
    fond: ORANGE,
    encre: BLANC,
    critere: `Parmi les ${PIONNIERS} premiers comptes inscrits sur Baobart.`,
    enAttente: null,
    obtenu: (m) => m.rangDInscription <= PIONNIERS,
    progression: jamais,
  },
  anciennete(
    { code: "ONE_YEAR", nom: "Un an", famille: "ANCIENNETE", glyphe: "1", fond: LAVANDE, encre: ENCRE, critere: "Compte créé il y a plus d'un an." },
    1,
  ),
  anciennete(
    { code: "THREE_YEARS", nom: "Trois ans", famille: "ANCIENNETE", glyphe: "3", fond: MAUVE, encre: ENCRE, critere: "Compte créé il y a plus de trois ans." },
    3,
  ),
  palier(
    {
      code: "LOYAL_SUBSCRIBER",
      nom: "Fidèle",
      famille: "ANCIENNETE",
      glyphe: "12",
      fond: JAUNE,
      encre: ENCRE,
      critere: "12 cycles d'abonnement payés d'affilée, sans interruption.",
    },
    (m) => m.cyclesPayesDAffilee,
    12,
    { singulier: "cycle payé", pluriel: "cycles payés", detail: "cycles payés d'affilée", detailSingulier: "cycle payé d'affilée", note: "un cycle manqué remet à zéro" },
  ),

  // ── E.3 · Production ─────────────────────────────────────────────────────
  palier(
    { code: "FIRST_PUBLICATION", nom: "Première pierre", famille: "PRODUCTION", glyphe: "1", fond: JAUNE, encre: ENCRE, critere: "Une ressource publiée." },
    (m) => m.ressourcesPubliees,
    1,
    { singulier: "ressource", pluriel: "ressources", detail: "ressources publiées", detailSingulier: "ressource publiée" },
  ),
  palier(
    { code: "TEN_RESOURCES", nom: "Atelier fourni", famille: "PRODUCTION", glyphe: "10", fond: LAVANDE, encre: ENCRE, critere: "Dix ressources publiées." },
    (m) => m.ressourcesPubliees,
    10,
    { singulier: "ressource", pluriel: "ressources", detail: "ressources publiées", detailSingulier: "ressource publiée" },
  ),
  palier(
    { code: "FIFTY_RESOURCES", nom: "Grand atelier", famille: "PRODUCTION", glyphe: "50", fond: MAUVE, encre: ENCRE, critere: "Cinquante ressources publiées." },
    (m) => m.ressourcesPubliees,
    50,
    { singulier: "ressource", pluriel: "ressources", detail: "ressources publiées", detailSingulier: "ressource publiée" },
  ),
  palier(
    { code: "HUNDRED_RESOURCES", nom: "Bibliothèque", famille: "PRODUCTION", glyphe: "100", fond: ORANGE, encre: BLANC, critere: "Cent ressources publiées." },
    (m) => m.ressourcesPubliees,
    100,
    { singulier: "ressource", pluriel: "ressources", detail: "ressources publiées", detailSingulier: "ressource publiée" },
  ),

  // ── E.4 · Ventes ─────────────────────────────────────────────────────────
  // Des acheteurs différents, pas des ventes : voir `Mesures`.
  palier(
    { code: "FIRST_SALE", nom: "Première vente", famille: "VENTES", glyphe: "1", fond: JAUNE, encre: ENCRE, critere: "Une vente aboutie." },
    (m) => m.acheteurs,
    1,
    ACHETEURS,
  ),
  palier(
    { code: "TEN_SALES", nom: "Dix ventes", famille: "VENTES", glyphe: "10", fond: LAVANDE, encre: ENCRE, critere: "Dix ventes abouties, à dix acheteurs différents." },
    (m) => m.acheteurs,
    10,
    ACHETEURS,
  ),
  palier(
    { code: "HUNDRED_SALES", nom: "Cent ventes", famille: "VENTES", glyphe: "100", fond: MAUVE, encre: ENCRE, critere: "Cent ventes abouties, à cent acheteurs différents." },
    (m) => m.acheteurs,
    100,
    ACHETEURS,
  ),
  palier(
    { code: "THOUSAND_SALES", nom: "Mille ventes", famille: "VENTES", glyphe: "1K", fond: ORANGE, encre: BLANC, critere: "Mille ventes abouties, à mille acheteurs différents." },
    (m) => m.acheteurs,
    1000,
    ACHETEURS,
  ),
  {
    code: "TOP_CREATOR",
    nom: "Créateur du mois",
    famille: "VENTES",
    glyphe: "◆",
    fond: ENCRE,
    encre: JAUNE,
    critere: `Parmi les ${Math.round(TETE_DU_MOIS.partDeTete * 100)} % de créateurs qui ont vendu au plus d'acheteurs différents sur les ${TETE_DU_MOIS.jours} derniers jours, avec au moins ${TETE_DU_MOIS.plancher} acheteurs. Le titre dure ${TETE_DU_MOIS.jours} jours après le dernier jour en tête.`,
    enAttente: null,
    obtenu: (m) => m.createurDuMoisJusquAu !== null && m.createurDuMoisJusquAu > m.maintenant,
    progression: jamais,
  },

  // ── E.5 · Qualité ────────────────────────────────────────────────────────
  enAttente(
    { code: "WELL_RATED", nom: "Bien noté", famille: "QUALITE", glyphe: "4.5", fond: JAUNE, encre: ENCRE, critere: "Note moyenne d'au moins 4,5 sur au moins 20 avis." },
    "Les avis notés n'existent pas encore sur Baobart.",
  ),
  palier(
    { code: "NO_DISPUTE", nom: "Sans litige", famille: "QUALITE", glyphe: "0", fond: VERT, encre: ENCRE, critere: "Cinquante acheteurs différents servis sans un seul litige." },
    (m) => m.acheteursDepuisLeDernierLitige,
    50,
    { ...ACHETEURS, detail: "acheteurs servis sans litige", detailSingulier: "acheteur servi sans litige", note: "un litige remet à zéro" },
  ),
  enAttente(
    { code: "FAST_RESPONDER", nom: "Répond vite", famille: "QUALITE", glyphe: "24h", fond: LAVANDE, encre: ENCRE, critere: "Services : délai médian de première réponse inférieur à 24 h." },
    "Les demandes de service partent par courriel : aucune réponse n'est encore enregistrée sur Baobart.",
  ),

  // ── E.6 · Communauté ─────────────────────────────────────────────────────
  palier(
    {
      code: "COMMUNITY_PILLAR",
      nom: "Pilier",
      famille: "COMMUNAUTE",
      glyphe: "500",
      fond: MAUVE,
      encre: ENCRE,
      critere: `Cinq cents abonnés, hors comptes suspendus et comptes de moins de ${ABONNE_COMPTE_APRES_JOURS} jours.`,
    },
    (m) => m.abonnes,
    500,
    { singulier: "abonné", pluriel: "abonnés", detail: "abonnés", detailSingulier: "abonné" },
  ),
  enAttente(
    { code: "HELPFUL_REVIEWER", nom: "Bon public", famille: "COMMUNAUTE", glyphe: "25", fond: LAVANDE, encre: ENCRE, critere: "Vingt-cinq avis rédigés." },
    "Les avis notés n'existent pas encore sur Baobart.",
  ),
  {
    code: "VIP_CREATOR",
    nom: "VIP",
    famille: "COMMUNAUTE",
    glyphe: "V",
    fond: ENCRE,
    encre: JAUNE,
    critere: "Distinction éditoriale décidée par l'administration.",
    enAttente: null,
    obtenu: (m) => m.vip,
    progression: jamais,
  },
];

/**
 * Du plus rare au plus courant. C'est l'ordre de la vitrine publique : « les
 * mérites se coupent à six, choisis par rareté décroissante » (décision 2 de
 * la maquette). Un ordre écrit, pas mesuré : il n'y a pas encore assez de
 * comptes pour compter les porteurs.
 */
const RARETE: readonly CodeMerite[] = [
  "TOP_CREATOR",
  "VIP_CREATOR",
  "THOUSAND_SALES",
  "PIONEER",
  "HUNDRED_RESOURCES",
  "THREE_YEARS",
  "COMMUNITY_PILLAR",
  "WELL_RATED",
  "NO_DISPUTE",
  "HUNDRED_SALES",
  "FIFTY_RESOURCES",
  "LOYAL_SUBSCRIBER",
  "FAST_RESPONDER",
  "HELPFUL_REVIEWER",
  "ONE_YEAR",
  "TEN_SALES",
  "TEN_RESOURCES",
  "NEW_TALENT",
  "FIRST_SALE",
  "FIRST_PUBLICATION",
];

const RANG_DE_RARETE = new Map(RARETE.map((code, i) => [code, i]));
const PAR_CODE = new Map(MERITES.map((m) => [m.code, m]));

export function meriteDe(code: CodeMerite): Merite {
  return PAR_CODE.get(code)!;
}

function parRarete(a: Merite, b: Merite): number {
  return RANG_DE_RARETE.get(a.code)! - RANG_DE_RARETE.get(b.code)!;
}

/** Ce que le compte porte, du plus rare au plus courant. */
export function meritesObtenus(m: Mesures): Merite[] {
  return MERITES.filter((merite) => merite.obtenu(m)).sort(parRarete);
}

export interface Proche {
  merite: Merite;
  progression: Progression;
  /** 0 à 100, arrondi vers le bas : 99,9 % ne s'affiche pas « 100 % ». */
  pourcentage: number;
}

/**
 * Les mérites pas encore obtenus dont on est le plus près.
 *
 * « Jamais dans la vitrine publique — un profil n'affiche pas ses manques.
 * Uniquement dans l'espace privé, et seulement les trois plus proches. »
 *
 * Écartés : ce qui est obtenu, ce qui ne se rapproche pas (un rang, un
 * classement, une distinction), ce qui ne se mesure pas encore, et ce dont on
 * n'a pas fait le premier pas. Un acheteur qui n'a rien publié n'a pas à lire
 * « il te manque 100 ressources » ; il lira « encore 214 jours » pour « Un an ».
 */
export function lesPlusProches(m: Mesures, combien = 3): Proche[] {
  const proches: Proche[] = [];
  for (const merite of MERITES) {
    if (merite.enAttente !== null || merite.obtenu(m)) continue;
    const progression = merite.progression(m);
    if (!progression || progression.valeur <= 0) continue;
    proches.push({
      merite,
      progression,
      pourcentage: Math.floor((progression.valeur / progression.cible) * 100),
    });
  }
  return proches
    .sort(
      (a, b) =>
        b.progression.valeur / b.progression.cible - a.progression.valeur / a.progression.cible ||
        // À égalité, le plus courant d'abord : c'est le plus facile à finir.
        parRarete(b.merite, a.merite),
    )
    .slice(0, combien);
}

/** Ce que la vitrine publique montre : six jetons, puis « +N ». */
export function vitrineDesMerites(obtenus: readonly Merite[], visibles = 6): {
  visibles: Merite[];
  reste: Merite[];
} {
  return { visibles: obtenus.slice(0, visibles), reste: obtenus.slice(visibles) };
}

/**
 * Les cycles d'abonnement payés d'affilée, jusqu'au plus récent.
 *
 * Chaque paiement porte l'échéance qu'il couvre (`SubscriptionPayment.cycleEnd`,
 * écrit à l'ouverture dans `lib/abonnements/renouvellement.ts`). Payer à temps
 * prolonge le cycle depuis cette échéance (`cycleSuivant`, `lib/ndank/cycle.ts`) :
 * deux paiements se suivent donc quand leurs échéances sont écartées d'un cycle
 * exactement, dans le même abonnement.
 *
 * Trois choses cassent la série, et la remettent à zéro (« Ndank sait le dire
 * — un cycle manqué remet le compteur à zéro ») :
 *   - un écart de plus d'un cycle : une échéance n'a pas été payée ;
 *   - un paiement arrivé après la grâce : l'accès s'est coupé entre les deux ;
 *   - une série qui ne court plus : la dernière échéance payée est dépassée,
 *     grâce comprise, sans qu'un paiement suive.
 *
 * Les forfaits gratuits se renouvellent sans paiement (`renouvelerLesGratuits`)
 * et ne comptent pas : un abonnement qui ne coûte rien ne mesure aucune
 * fidélité. Au 05/11/2026, seul « Accès libre », gratuit, est ouvert — personne
 * ne peut donc encore obtenir « Fidèle ».
 */
export function cyclesPayesDAffilee(
  paiements: ReadonlyArray<{ abonnementId: string; echeance: Date; payeLe: Date; joursDuCycle: number }>,
  maintenant: Date,
  graceJours: number,
): number {
  const ordonnes = [...paiements].sort((a, b) => a.echeance.getTime() - b.echeance.getTime());
  let serie = 0;
  let precedent: (typeof ordonnes)[number] | null = null;
  for (const p of ordonnes) {
    const aTemps = p.payeLe.getTime() <= p.echeance.getTime() + graceJours * JOUR;
    const suit =
      precedent !== null &&
      precedent.abonnementId === p.abonnementId &&
      p.echeance.getTime() - precedent.echeance.getTime() === p.joursDuCycle * JOUR;
    serie = suit && aTemps ? serie + 1 : 1;
    precedent = p;
  }
  if (!precedent) return 0;
  // Le dernier paiement couvre le cycle qui s'ouvre à son échéance. La série
  // court tant que l'échéance suivante, grâce comprise, n'est pas dépassée.
  const finDuCyclePaye = precedent.echeance.getTime() + (precedent.joursDuCycle + graceJours) * JOUR;
  return maintenant.getTime() <= finDuCyclePaye ? serie : 0;
}

/**
 * Qui est « en tête du mois », d'après le classement des 30 derniers jours.
 *
 * `classement` : les créateurs qui ont atteint le plancher, avec leurs ventes.
 * `actifs` : combien de créateurs ont vendu au moins une fois sur la période.
 * La part de tête se compte sur les actifs, arrondie au-dessus — sans quoi,
 * sous vingt créateurs actifs, 5 % ne désignerait personne. Les ex æquo du
 * dernier rang retenu sont tous retenus : départager deux égaux au hasard
 * serait une injustice affichée en public.
 */
export function tetesDuMois(
  classement: ReadonlyArray<{ vendeurId: string; ventes: number }>,
  actifs: number,
): Set<string> {
  const places = Math.ceil(actifs * TETE_DU_MOIS.partDeTete);
  const eligibles = classement
    .filter((c) => c.ventes >= TETE_DU_MOIS.plancher)
    .sort((a, b) => b.ventes - a.ventes);
  if (places === 0 || eligibles.length === 0) return new Set();
  const seuil = eligibles[Math.min(places, eligibles.length) - 1]!.ventes;
  return new Set(eligibles.filter((c) => c.ventes >= seuil).map((c) => c.vendeurId));
}
