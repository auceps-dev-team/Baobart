/**
 * Moteur de confiance — à qui laisse-t-on vendre et encaisser.
 *
 * Traduit `state_machine(:user_risk_state)` de `app/models/user.rb` et
 * `concerns/user/low_balance_fraud_check.rb` (antiwork/gumroad, MIT, lus comme
 * spécification).
 *
 * Ce module ne touche à rien : il **décide**. Les effets de bord (invalider les
 * sessions, bloquer une IP, désactiver des produits) sont retournés sous forme
 * de liste à exécuter par l'appelant. C'est ce qui le rend testable sans base,
 * sans réseau, et vérifiable d'un coup d'œil — pour du code qui peut couper les
 * revenus d'un créateur, ça n'est pas un luxe.
 */

export type RiskState =
  | "NOT_REVIEWED"
  | "COMPLIANT"
  | "ON_PROBATION"
  | "FLAGGED_FRAUD"
  | "FLAGGED_TOS"
  | "SUSPENDED_FRAUD"
  | "SUSPENDED_TOS";

export type RiskEvent =
  | "MARK_COMPLIANT"
  | "MARK_NOT_REVIEWED"
  | "FLAG_FRAUD"
  | "FLAG_TOS"
  | "SUSPEND_FRAUD"
  | "SUSPEND_TOS"
  | "PUT_ON_PROBATION";

/** Effets à exécuter par l'appelant après une transition acceptée. */
export type RiskEffect =
  | "INVALIDER_SESSIONS"
  | "DESACTIVER_PRODUITS"
  | "BLOQUER_IP"
  | "RETIRER_ABONNES"
  | "SUPPRIMER_DOMAINE_PERSO"
  | "SUSPENDRE_AUTRES_COMPTES"
  | "AJOUTER_FILTRE_ANTI_ABUS"
  | "DEBLOQUER_IP"
  | "REACTIVER_PRODUITS"
  | "REACTIVER_AUTRES_COMPTES"
  | "RETIRER_FILTRE_ANTI_ABUS"
  | "JOURNALISER";

export const ETATS_SUSPENDUS: readonly RiskState[] = [
  "SUSPENDED_FRAUD",
  "SUSPENDED_TOS",
];

/** États qui rendent au créateur sa capacité de vendre. */
const ETATS_REHABILITANTS: readonly RiskState[] = [
  "COMPLIANT",
  "ON_PROBATION",
  "NOT_REVIEWED",
];

export function estSuspendu(state: RiskState): boolean {
  return ETATS_SUSPENDUS.includes(state);
}

/**
 * Transitions autorisées, relevées une à une dans la machine à états.
 *
 * À noter : `MARK_NOT_REVIEWED` ne part QUE de la probation. On ne remet pas un
 * compte signalé « à revoir » : soit on le réhabilite, soit on tranche.
 */
const TRANSITIONS: Record<RiskEvent, { depuis: readonly RiskState[]; vers: RiskState }> = {
  MARK_COMPLIANT: {
    depuis: [
      "NOT_REVIEWED",
      "COMPLIANT",
      "ON_PROBATION",
      "FLAGGED_FRAUD",
      "FLAGGED_TOS",
      "SUSPENDED_FRAUD",
      "SUSPENDED_TOS",
    ],
    vers: "COMPLIANT",
  },
  MARK_NOT_REVIEWED: { depuis: ["ON_PROBATION"], vers: "NOT_REVIEWED" },
  FLAG_TOS: {
    depuis: ["NOT_REVIEWED", "COMPLIANT", "FLAGGED_FRAUD"],
    vers: "FLAGGED_TOS",
  },
  FLAG_FRAUD: {
    depuis: ["NOT_REVIEWED", "COMPLIANT", "FLAGGED_TOS"],
    vers: "FLAGGED_FRAUD",
  },
  SUSPEND_FRAUD: {
    depuis: [
      "NOT_REVIEWED",
      "COMPLIANT",
      "ON_PROBATION",
      "FLAGGED_FRAUD",
      "FLAGGED_TOS",
    ],
    vers: "SUSPENDED_FRAUD",
  },
  SUSPEND_TOS: {
    depuis: [
      "NOT_REVIEWED",
      "COMPLIANT",
      "ON_PROBATION",
      "FLAGGED_TOS",
      "FLAGGED_FRAUD",
    ],
    vers: "SUSPENDED_TOS",
  },
  PUT_ON_PROBATION: {
    depuis: [
      "NOT_REVIEWED",
      "COMPLIANT",
      "ON_PROBATION",
      "FLAGGED_FRAUD",
      "FLAGGED_TOS",
      "SUSPENDED_FRAUD",
      "SUSPENDED_TOS",
    ],
    vers: "ON_PROBATION",
  },
};

/** Levée de suspension non demandée explicitement. */
export class SuspensionNonAutoriseeError extends Error {
  constructor(depuis: RiskState, vers: RiskState) {
    super(
      `Passer de ${depuis} à ${vers} lèverait une suspension. ` +
        `Il faut le vouloir explicitement (clearSuspension: true).`,
    );
    this.name = "SuspensionNonAutoriseeError";
  }
}

export class TransitionInterditeError extends Error {
  constructor(depuis: RiskState, event: RiskEvent) {
    super(`L'événement ${event} n'est pas autorisé depuis l'état ${depuis}.`);
    this.name = "TransitionInterditeError";
  }
}

/**
 * La sanction visait un compte dont l'identité n'est pas vérifiée.
 *
 * Une sorte de transition interdite, mais qui ne doit pas se dire comme les
 * autres : le refus affichait « L'événement SUSPEND_TOS n'est pas autorisé
 * depuis l'état NOT_REVIEWED » — faux, c'est l'identité qui manque, pas l'état
 * (mesuré le 25/09, Qualitytest N6-sans-kyc).
 */
export class IdentiteNonVerifieeError extends TransitionInterditeError {
  constructor(depuis: RiskState, event: RiskEvent) {
    super(depuis, event);
    this.message = "Identité non vérifiée : ce compte ne peut être ni signalé ni suspendu.";
    this.name = "IdentiteNonVerifieeError";
  }
}

export interface TransitionInput {
  from: RiskState;
  event: RiskEvent;
  /**
   * Doit valoir `true` pour toute transition qui sortirait d'une suspension.
   *
   * Ce n'est pas de la paperasse : lever une suspension **remet les produits en
   * vente**. Une revue de routine « ce compte a l'air correct » ne doit pas
   * défaire une suspension qu'elle n'a jamais examinée. Et la probation
   * réhabilite autant que la conformité — c'est pourquoi elle est gardée pareil.
   */
  clearSuspension?: boolean;
  /**
   * Le KYC est-il validé ? Un compte non vérifié ne peut pas être signalé ni
   * suspendu : il n'y a encore rien à sanctionner.
   */
  isVerified?: boolean;
}

export interface TransitionResult {
  from: RiskState;
  to: RiskState;
  effects: RiskEffect[];
}

/**
 * Décide d'une transition d'état de risque et des effets qu'elle entraîne.
 * Lève si la transition est interdite ou lèverait une suspension par mégarde.
 */
export function applyRiskEvent(input: TransitionInput): TransitionResult {
  const { from, event, clearSuspension = false, isVerified = true } = input;

  const regle = TRANSITIONS[event];
  if (!regle.depuis.includes(from)) {
    throw new TransitionInterditeError(from, event);
  }

  const to = regle.vers;

  // On ne sanctionne pas un compte dont l'identité n'a pas été vérifiée.
  const estSanction =
    estSuspendu(to) || to === "FLAGGED_FRAUD" || to === "FLAGGED_TOS";
  if (estSanction && !isVerified) {
    throw new IdentiteNonVerifieeError(from, event);
  }

  // LE GARDE-FOU CENTRAL. Il est posé sur l'ENTRÉE dans un état réhabilitant,
  // et non sur la sortie d'une suspension, parce que l'objet en mémoire peut
  // être plus vieux que la ligne en base : au moment où l'on écrit, le compte
  // a pu être suspendu entre-temps par quelqu'un d'autre. C'est précisément
  // cette lecture périmée que le garde existe pour rattraper.
  if (estSuspendu(from) && ETATS_REHABILITANTS.includes(to) && !clearSuspension) {
    throw new SuspensionNonAutoriseeError(from, to);
  }

  return { from, to, effects: effetsPour(from, to) };
}

function effetsPour(from: RiskState, to: RiskState): RiskEffect[] {
  const effects: RiskEffect[] = [];

  if (!estSuspendu(from) && estSuspendu(to)) {
    effects.push(
      "INVALIDER_SESSIONS",
      "DESACTIVER_PRODUITS",
      "BLOQUER_IP",
      "RETIRER_ABONNES",
      "SUPPRIMER_DOMAINE_PERSO",
      "SUSPENDRE_AUTRES_COMPTES",
      "AJOUTER_FILTRE_ANTI_ABUS",
    );
  }

  if (estSuspendu(from) && !estSuspendu(to)) {
    effects.push(
      "DEBLOQUER_IP",
      "REACTIVER_PRODUITS",
      "REACTIVER_AUTRES_COMPTES",
      "RETIRER_FILTRE_ANTI_ABUS",
    );
  }

  // Toute transition laisse une trace : c'est elle que relit la levée
  // automatique de probation pour savoir qui avait décidé quoi.
  effects.push("JOURNALISER");
  return effects;
}

// ────────────────────────────────────── anti-fraude par le solde ────────────

/**
 * Seuils du contrôle de solde négatif.
 *
 * L'écart entre les deux seuils n'est pas un détail : un solde qui oscille
 * autour d'un seuil unique ferait entrer et sortir le créateur de probation en
 * boucle. Il faut descendre sous le seuil bas pour être sanctionné, et remonter
 * au-dessus du seuil haut pour en sortir.
 *
 * ⚠️ Les montants sont une décision Baobart. Seul le principe est porté.
 */
export interface LowBalanceConfig {
  seuilBas: number;
  seuilHaut: number;
  /** Délai avant que le même contrôle puisse re-sanctionner. */
  delaiAvantNouvelleProbationJours: number;
}

export const LOW_BALANCE_PAR_DEFAUT: LowBalanceConfig = {
  seuilBas: -50_000, // −50 000 F
  seuilHaut: 50_000, // +50 000 F
  delaiAvantNouvelleProbationJours: 60,
};

/** Auteur inscrit dans le journal, pour reconnaître ses propres décisions. */
export const AUTEUR_CONTROLE_SOLDE = "ControleSoldeNegatif";

export interface LowBalanceInput {
  unpaidBalance: number;
  state: RiskState;
  /** Date de la dernière probation posée par CE contrôle, s'il y en a eu une. */
  derniereProbationParCeControle?: Date | null;
  /**
   * Une décision de risque plus récente que cette probation existe-t-elle ?
   * Si oui, quelqu'un d'autre a tranché depuis : ce contrôle ne revient pas
   * dessus.
   */
  decisionPlusRecenteExiste?: boolean;
  /** État du compte juste avant la probation posée par ce contrôle. */
  etatAvantProbation?: RiskState | null;
  today?: Date;
  config?: LowBalanceConfig;
}

export type LowBalanceAction =
  | { action: "RIEN"; raison: string }
  | { action: "PROBATION"; desactiverRemboursements: true; raison: string }
  | { action: "LEVER_PROBATION"; versEtat: RiskState; raison: string };

/**
 * Décide si un solde négatif doit déclencher une probation, ou si un solde
 * rétabli doit la lever.
 *
 * C'est une ceinture de sécurité : un vendeur qui accumule les litiges ne peut
 * plus creuser son déficit. Elle protège la plateforme **et** les acheteurs
 * suivants, qui n'achèteront pas à quelqu'un qui ne pourra plus les rembourser.
 */
export function decideLowBalance(input: LowBalanceInput): LowBalanceAction {
  const {
    unpaidBalance,
    state,
    derniereProbationParCeControle = null,
    decisionPlusRecenteExiste = false,
    etatAvantProbation = null,
    today = new Date(),
    config = LOW_BALANCE_PAR_DEFAUT,
  } = input;

  // Une suspension surclasse tout. Ce contrôle ignore pourquoi le compte a été
  // suspendu, donc il ne doit jamais y toucher — ni pour sanctionner, ni pour
  // réhabiliter.
  if (estSuspendu(state)) {
    return { action: "RIEN", raison: "compte suspendu — décision surclassante" };
  }

  if (unpaidBalance <= config.seuilBas) {
    if (state === "ON_PROBATION" && derniereProbationParCeControle) {
      const jours =
        (today.getTime() - derniereProbationParCeControle.getTime()) / 86_400_000;
      if (jours < config.delaiAvantNouvelleProbationJours) {
        return {
          action: "RIEN",
          raison: "déjà sanctionné récemment par ce contrôle",
        };
      }
    }

    return {
      action: "PROBATION",
      desactiverRemboursements: true,
      raison: `solde ${unpaidBalance} sous le seuil ${config.seuilBas}`,
    };
  }

  if (unpaidBalance >= config.seuilHaut && state === "ON_PROBATION") {
    // On ne lève que ce qu'on a posé soi-même…
    if (!derniereProbationParCeControle) {
      return {
        action: "RIEN",
        raison: "probation posée par quelqu'un d'autre",
      };
    }
    // …et seulement si personne n'a tranché depuis.
    if (decisionPlusRecenteExiste) {
      return {
        action: "RIEN",
        raison: "une décision plus récente existe",
      };
    }

    // Restitution de l'état d'avant. Faute de trace, on retombe sur l'état
    // initial : jamais sur « conforme », qu'on n'a pas le droit d'accorder.
    const versEtat: RiskState =
      etatAvantProbation === "COMPLIANT" ? "COMPLIANT" : "NOT_REVIEWED";

    return {
      action: "LEVER_PROBATION",
      versEtat,
      raison: `solde rétabli au-dessus de ${config.seuilHaut}`,
    };
  }

  return { action: "RIEN", raison: "aucun seuil franchi" };
}
