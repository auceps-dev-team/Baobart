/**
 * Calendrier des versements Baobart.
 *
 * Traduit `app/modules/user/payout_schedule.rb` et
 * `app/business/payments/payouts/payout_rail_schedule.rb` du dépôt
 * antiwork/gumroad (MIT, lu comme spécification).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE MODULE EXISTE
 *
 * Le plan désigne l'incertitude de paiement comme LE frein des créateurs
 * africains. Répondre « tu seras payé mercredi 12, 47 500 F » demande de
 * distinguer deux dates que tout le monde confond au départ :
 *
 *   LA DATE DE CYCLE   ancrée un jour fixe de la semaine (vendredi ici).
 *                      Elle décide QUELLES sommes entrent dans le versement.
 *
 *   LA DATE DE VERSEMENT  le jour où le rail du créateur est réellement
 *                      exécuté, quelque part dans la semaine de ce cycle.
 *                      C'est la date qu'on lui montre.
 *
 * Un créateur payé par Wave le mardi et un créateur payé par virement le jeudi
 * touchent les mêmes ventes — celles arrêtées à la date de cycle — mais pas le
 * même jour. Confondre les deux fait sauter des créateurs d'un lot entier :
 * le commentaire de `payout_schedule.rb` documente précisément ce bug.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUI EST UNE DÉCISION, PAS UNE CONSTANTE
 *
 * Le délai de rétention, le seuil minimum et le jour d'ancrage sont des choix
 * Baobart, pas des vérités techniques. Ils sont regroupés dans `PayoutConfig`
 * pour être discutés, pas dispersés dans le code.
 */

export type PayoutFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";

/** 0 = dimanche … 6 = samedi (convention `Date.getUTCDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const VENDREDI: Weekday = 5;

/**
 * Un « rail » est un moyen d'acheminement de l'argent : un opérateur de mobile
 * money, ou le virement bancaire d'un pays donné. Chaque rail est exécuté un
 * jour précis de la semaine — c'est ce qui permet d'étaler la charge et de
 * respecter les fenêtres de compensation propres à chaque opérateur.
 */
export interface PayoutRail {
  id: string;
  label: string;
  weekday: Weekday;
}

/**
 * Rails proposés pour le lancement. Les jours sont à confirmer avec chaque
 * opérateur : ce sont leurs fenêtres de compensation qui décident, pas nous.
 */
export const RAILS_BAOBART: Record<string, PayoutRail> = {
  wave: { id: "wave", label: "Wave", weekday: 2 },
  om: { id: "om", label: "Orange Money", weekday: 2 },
  mtn: { id: "mtn", label: "MTN MoMo", weekday: 3 },
  moov: { id: "moov", label: "Moov Money", weekday: 3 },
  bank: { id: "bank", label: "Virement bancaire", weekday: 4 },
};

export interface PayoutConfig {
  /** Jour d'ancrage des cycles. */
  anchorWeekday: Weekday;
  /**
   * Jours de rétention avant qu'une somme devienne versable. C'est la marge
   * qui absorbe les impayés et les litiges : une vente d'aujourd'hui n'est
   * jamais versée demain.
   */
  delayDays: number;
  /**
   * Montant en dessous duquel on ne verse pas : la somme roule sur le cycle
   * suivant. Évite d'envoyer des versements dont les frais dépassent le gain.
   * ⚠️ Valeur à fixer avec les tarifs réels des opérateurs.
   */
  minimumAmount: number;
}

export const CONFIG_PAR_DEFAUT: PayoutConfig = {
  anchorWeekday: VENDREDI,
  delayDays: 7,
  minimumAmount: 1_000, // 1 000 F — à confirmer
};

// ───────────────────────────────────────────────────────────── dates (UTC) ──
// Tout est calculé en UTC : les versements ne doivent pas changer de jour
// selon le fuseau du serveur qui exécute le job.

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Ramène un instant au jour civil UTC correspondant. */
export function jour(date: Date): Date {
  return utc(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function ajouterJours(date: Date, days: number): Date {
  const d = jour(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function ajouterMois(date: Date, months: number): Date {
  const d = jour(date);
  const jourDuMois = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Fin de mois : 31 janvier + 1 mois doit donner 28/29 février, pas le 2 mars.
  const dernierJour = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(jourDuMois, dernierJour));
  return d;
}

/** Premier jour d'ancrage à partir de `date` incluse. */
function ancrageSuivant(date: Date, anchor: Weekday): Date {
  const d = jour(date);
  const ecart = (anchor - d.getUTCDay() + 7) % 7;
  return ajouterJours(d, ecart);
}

/** Dernier jour d'ancrage du mois de `date`. */
function dernierAncrageDuMois(date: Date, anchor: Weekday): Date {
  const d = jour(date);
  const finDeMois = utc(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
  const recul = (finDeMois.getUTCDay() - anchor + 7) % 7;
  return ajouterJours(finDeMois, -recul);
}

/** Dernier jour d'ancrage du trimestre de `date`. */
function dernierAncrageDuTrimestre(date: Date, anchor: Weekday): Date {
  const d = jour(date);
  const moisFinTrimestre = Math.floor(d.getUTCMonth() / 3) * 3 + 2;
  const finTrimestre = utc(d.getUTCFullYear(), moisFinTrimestre + 1, 0);
  const recul = (finTrimestre.getUTCDay() - anchor + 7) % 7;
  return ajouterJours(finTrimestre, -recul);
}

export function memeJour(a: Date, b: Date): boolean {
  return jour(a).getTime() === jour(b).getTime();
}

// ────────────────────────────────────────────────────────────────── cycles ──

/** Premier cycle candidat à partir de `date`, selon la fréquence. */
export function cycleInitial(
  date: Date,
  frequency: PayoutFrequency,
  config: PayoutConfig = CONFIG_PAR_DEFAUT,
): Date {
  const { anchorWeekday } = config;
  switch (frequency) {
    // Le versement quotidien vit hors cycle ; cette date sert de repli pour
    // la part qui n'a pas pu partir en instantané.
    case "DAILY":
    case "WEEKLY":
      return ancrageSuivant(date, anchorWeekday);
    case "MONTHLY":
      return dernierAncrageDuMois(date, anchorWeekday);
    case "QUARTERLY":
      return dernierAncrageDuTrimestre(date, anchorWeekday);
  }
}

/** Cycle suivant celui passé en argument. */
export function cycleSuivant(
  cycleDate: Date,
  frequency: PayoutFrequency,
  config: PayoutConfig = CONFIG_PAR_DEFAUT,
): Date {
  const { anchorWeekday } = config;
  switch (frequency) {
    case "DAILY":
    case "WEEKLY":
      return ancrageSuivant(ajouterJours(cycleDate, 7), anchorWeekday);
    case "MONTHLY":
      return dernierAncrageDuMois(ajouterMois(cycleDate, 1), anchorWeekday);
    case "QUARTERLY":
      return dernierAncrageDuTrimestre(ajouterMois(cycleDate, 3), anchorWeekday);
  }
}

/** Combien de jours avant l'ancrage le rail du créateur est exécuté. */
function reculDuRail(rail: PayoutRail, config: PayoutConfig): number {
  return (config.anchorWeekday - rail.weekday + 7) % 7;
}

/** Date de cycle → date à laquelle CE créateur est réellement payé. */
export function dateVersementPourCycle(
  cycleDate: Date,
  rail: PayoutRail,
  config: PayoutConfig = CONFIG_PAR_DEFAUT,
): Date {
  return ajouterJours(cycleDate, -reculDuRail(rail, config));
}

/** L'inverse : à quel cycle appartient une date de versement. */
export function cyclePourDateVersement(
  payoutDate: Date,
  rail: PayoutRail,
  config: PayoutConfig = CONFIG_PAR_DEFAUT,
): Date {
  return ajouterJours(payoutDate, reculDuRail(rail, config));
}

/**
 * Jusqu'à quelle date les sommes sont incluses dans ce versement.
 *
 * Ancrée sur le CYCLE, jamais sur la date de versement : deux créateurs de
 * rails différents payés des jours différents dans la même semaine touchent
 * exactement les mêmes ventes.
 */
export function finDePeriodePourVersement(
  payoutDate: Date,
  rail: PayoutRail,
  config: PayoutConfig = CONFIG_PAR_DEFAUT,
): Date {
  return ajouterJours(
    cyclePourDateVersement(payoutDate, rail, config),
    -config.delayDays,
  );
}

// ────────────────────────────────────────────────────────────── projection ──

export interface ProjectionInput {
  frequency: PayoutFrequency;
  rail: PayoutRail;
  /** Cumul versable arrêté à une date donnée. */
  soldeVersableJusqua: (date: Date) => number;
  today?: Date;
  /** Un versement a-t-il déjà été émis aujourd'hui ? */
  dejaPayeAujourdhui?: boolean;
  config?: PayoutConfig;
  /** Nombre maximum d'échéances à projeter. */
  limite?: number;
}

export interface VersementProjete {
  /** Le jour où le créateur reçoit l'argent. */
  payoutDate: Date;
  /** Le cycle auquel ce versement appartient. */
  cycleDate: Date;
  /** Dernière date de vente incluse. */
  periodEnd: Date;
  amount: number;
}

/**
 * Prochaine date à laquelle ce créateur sera payé, ou `null` s'il n'atteint
 * pas encore le seuil.
 */
export function prochaineDateVersement(
  input: ProjectionInput,
): Date | null {
  const premier = projeterVersements({ ...input, limite: 1 })[0];
  return premier ? premier.payoutDate : null;
}

/**
 * Projette les prochaines échéances : « quand serai-je payé, et combien ».
 *
 * Chaque échéance ne compte que ce qui n'a pas déjà été projeté dans les
 * précédentes — sans quoi la même vente apparaîtrait dans plusieurs versements.
 */
export function projeterVersements(
  input: ProjectionInput,
): VersementProjete[] {
  const {
    frequency,
    rail,
    soldeVersableJusqua,
    today = new Date(),
    dejaPayeAujourdhui = false,
    config = CONFIG_PAR_DEFAUT,
    limite = 4,
  } = input;

  const aujourdhui = jour(today);
  const resultats: VersementProjete[] = [];

  let cycleDate = cycleInitial(aujourdhui, frequency, config);
  let dejaProjete = 0;
  let garde = 0;

  /**
   * Solde brut observé au cycle précédent.
   *
   * Sert à savoir quand s'arrêter. Une échéance sous le seuil n'est pas une
   * fin : la somme roule, et le cycle suivant lui ajoutera les ventes de la
   * période. Mais si le solde n'a pas bougé d'un cycle à l'autre, plus rien
   * n'arrive — continuer à avancer poserait une requête par cycle pour lire
   * chaque fois le même chiffre.
   */
  let soldePrecedent: number | null = null;

  while (resultats.length < limite && garde < limite + 24) {
    garde += 1;

    const payoutDate = dateVersementPourCycle(cycleDate, rail, config);

    // Le rail de ce créateur est peut-être déjà passé cette semaine, ou il a
    // déjà été payé aujourd'hui : dans les deux cas, cap sur le cycle suivant.
    const passe = payoutDate.getTime() < aujourdhui.getTime();
    const dejaFait = memeJour(payoutDate, aujourdhui) && dejaPayeAujourdhui;
    if (passe || dejaFait) {
      cycleDate = cycleSuivant(cycleDate, frequency, config);
      continue;
    }

    const periodEnd = finDePeriodePourVersement(payoutDate, rail, config);
    const brut = soldeVersableJusqua(periodEnd);
    const amount = brut - dejaProjete;

    if (amount < config.minimumAmount) {
      // Rien de neuf depuis le cycle précédent : les suivants diront pareil.
      if (soldePrecedent === brut) break;
      soldePrecedent = brut;
      cycleDate = cycleSuivant(cycleDate, frequency, config);
      continue;
    }

    resultats.push({ payoutDate, cycleDate, periodEnd, amount });
    dejaProjete += amount;
    soldePrecedent = brut;
    cycleDate = cycleSuivant(cycleDate, frequency, config);
  }

  return resultats;
}
