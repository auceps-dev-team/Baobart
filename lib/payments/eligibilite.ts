import type { RiskState } from "@/lib/domain/trust";
import { estSuspendu } from "@/lib/domain/trust";

/**
 * Qui peut être payé, et sinon pourquoi.
 *
 * Traduit `Payouts.is_user_payable` du dépôt de référence. Module pur : la
 * question « peut-on payer cette personne » se répond sur huit valeurs, et
 * doit pouvoir s'éprouver sans monter une base.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'ORDRE DES REFUS N'EST PAS ARBITRAIRE
 *
 * On annonce d'abord ce que la personne peut corriger elle-même — ajouter un
 * compte, atteindre le seuil — et en dernier ce qui dépend de nous. Gumroad
 * fait le contraire par endroits et le regrette dans ses commentaires : un
 * créateur à qui l'on répond « compte en cours d'examen » alors qu'il lui
 * manque surtout un numéro de téléphone perd son temps à attendre.
 *
 * Une exception : la suspension passe avant tout. Elle n'est pas un obstacle
 * à contourner, et laisser croire qu'ajouter un compte suffirait serait
 * malhonnête.
 */

export type RefusVersement =
  /** Compte suspendu : rien ne sort. */
  | "SUSPENDU"
  /** Signalé, enquête en cours. Le solde est conservé, pas perdu. */
  | "SOUS_ENQUETE"
  /** Versements arrêtés à la main, sans que la boutique soit coupée. */
  | "VERSEMENTS_SUSPENDUS"
  /** Aucun compte de destination enregistré. */
  | "PAS_DE_COMPTE"
  /** Le rail du compte n'est pas un rail connu. */
  | "RAIL_INCONNU"
  /** Rien à verser sur la période. */
  | "RIEN_A_VERSER"
  /** En dessous du minimum : la somme roule sur le cycle suivant. */
  | "SOUS_LE_SEUIL";

export type DecisionVersement =
  | { payable: true }
  | { payable: false; raison: RefusVersement; message: string };

/**
 * Forme courte du refus, pour une légende sous un chiffre.
 *
 * Le message complet explique et conseille ; il n'a pas sa place en légende
 * d'un indicateur, où il serait lu deux fois dans le même écran.
 */
export const REFUS_COURT: Record<RefusVersement, string> = {
  SUSPENDU: "compte suspendu",
  SOUS_ENQUETE: "contrôle en cours",
  VERSEMENTS_SUSPENDUS: "versements suspendus",
  PAS_DE_COMPTE: "aucun compte enregistré",
  RAIL_INCONNU: "moyen de versement à revoir",
  RIEN_A_VERSER: "rien à verser",
  SOUS_LE_SEUIL: "sous le minimum de versement",
};

const MESSAGES: Record<RefusVersement, string> = {
  SUSPENDU:
    "Ton compte est suspendu : les versements sont arrêtés. Écris-nous pour comprendre pourquoi.",
  SOUS_ENQUETE:
    "Un contrôle est en cours sur ton compte. Ton solde est conservé et te sera versé une fois le contrôle terminé.",
  VERSEMENTS_SUSPENDUS:
    "Tes versements sont momentanément suspendus. Ton solde reste acquis.",
  PAS_DE_COMPTE:
    "Ajoute un compte de versement — mobile money ou bancaire — pour être payé.",
  RAIL_INCONNU:
    "Le moyen de versement enregistré n'est plus proposé. Choisis-en un autre.",
  RIEN_A_VERSER: "Rien à verser sur cette période.",
  SOUS_LE_SEUIL:
    "Ton solde n'atteint pas encore le minimum de versement. Il roulera sur la prochaine échéance.",
};

export interface EligibiliteInput {
  riskState: RiskState;
  suspenduLe: Date | null;
  versementsSuspendusLe: Date | null;
  /** Compte de destination, ou `null` si aucun n'est enregistré. */
  compte: { provider: string; accountRef: string } | null;
  /** Rails que la plateforme sait exécuter. */
  railsConnus: readonly string[];
  soldeVersable: number;
  minimum: number;
  /** Versement déclenché à la main par un administrateur. */
  parAdministrateur?: boolean;
}

/**
 * Ce créateur peut-il être payé sur cette période ?
 *
 * `parAdministrateur` lève le seuil minimum et l'enquête en cours — un
 * versement décidé à la main l'est en connaissance de cause. Il ne lève **ni**
 * la suspension du compte, **ni** le gel des versements, **ni** l'absence de
 * compte : les deux premières sont des décisions qu'on ne contourne pas par un
 * clic — et le gel est désormais posé automatiquement par un litige, donc par
 * personne — la troisième rendrait le virement impossible.
 */
export function peutEtrePaye(input: EligibiliteInput): DecisionVersement {
  const {
    riskState,
    suspenduLe,
    versementsSuspendusLe,
    compte,
    railsConnus,
    soldeVersable,
    minimum,
    parAdministrateur = false,
  } = input;

  const refus = (raison: RefusVersement): DecisionVersement => ({
    payable: false,
    raison,
    message: MESSAGES[raison],
  });

  // La suspension passe avant tout : ce n'est pas un obstacle à contourner.
  if (suspenduLe !== null || estSuspendu(riskState)) return refus("SUSPENDU");

  if (compte === null) return refus("PAS_DE_COMPTE");
  if (!railsConnus.includes(compte.provider)) return refus("RAIL_INCONNU");

  // Le gel des versements ne se lève pas non plus, même à la main.
  //
  // Il l'était jusqu'à présent : la permission datait d'une époque où le gel
  // était toujours une décision humaine, qu'un autre humain pouvait donc
  // défaire en connaissance de cause. Depuis, un litige le pose **tout seul**
  // (`lib/domain/litiges.ts`) : le laisser levable ferait repartir l'argent
  // d'un compte dont l'opérateur vient justement de reprendre des fonds.
  //
  // La garde vit ici plutôt que chez l'appelant : protéger un appelant à la
  // fois laisse une mine pour le prochain qui emploiera `parAdministrateur`
  // sans savoir qu'il doit refaire le contrôle lui-même.
  if (versementsSuspendusLe !== null) return refus("VERSEMENTS_SUSPENDUS");

  // Le signalement, lui, reste levable : c'est un signal souple, et un
  // administrateur qui a lu le dossier peut raisonnablement passer outre. Le
  // gel post-litige n'est pas de cette nature — personne ne l'a décidé.
  if (!parAdministrateur) {
    if (riskState === "FLAGGED_FRAUD" || riskState === "FLAGGED_TOS") {
      return refus("SOUS_ENQUETE");
    }
  }

  // Un solde nul ou négatif ne se verse pas, même sur ordre : on ne réclame
  // pas d'argent à un créateur.
  if (soldeVersable <= 0) return refus("RIEN_A_VERSER");

  if (!parAdministrateur && soldeVersable < minimum) {
    return refus("SOUS_LE_SEUIL");
  }

  return { payable: true };
}
