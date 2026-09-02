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
  /** Le compte vient d'être enregistré : il purge son délai de vérification. */
  | "COMPTE_TROP_RECENT"
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
  COMPTE_TROP_RECENT: "compte en cours de vérification",
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
  COMPTE_TROP_RECENT:
    "Ton compte de versement vient d'être enregistré. Le premier départ a lieu après vingt-quatre heures de vérification — ton solde t'attend.",
  RIEN_A_VERSER: "Rien à verser sur cette période.",
  SOUS_LE_SEUIL:
    "Ton solde n'atteint pas encore le minimum de versement. Il roulera sur la prochaine échéance.",
};

/**
 * Le délai de vérification d'un compte de versement fraîchement enregistré.
 *
 * Vingt-quatre heures : assez pour qu'un propriétaire légitime remarque le
 * changement, assez court pour ne pas retarder quelqu'un qui s'installe.
 */
export const VERIFICATION_MS = 24 * 3_600_000;

export interface EligibiliteInput {
  riskState: RiskState;
  suspenduLe: Date | null;
  versementsSuspendusLe: Date | null;
  /** Compte de destination, ou `null` si aucun n'est enregistré. */
  compte: { provider: string; accountRef: string; enregistreLe: Date } | null;
  /** L'instant du jugement. Paramètre pour que la règle s'éprouve. */
  maintenant?: Date;
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
    maintenant,
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

  // ────────────────────────────────────────────────────────────────────────
  // VINGT-QUATRE HEURES ENTRE L'ENREGISTREMENT ET LE PREMIER DÉPART
  //
  // C'est la seule défense contre le scénario le plus coûteux du tableau de
  // bord : quelqu'un entre dans un compte, remplace le numéro de versement, et
  // le prochain cycle envoie l'argent chez lui. Tout le reste — suspension,
  // enquête, seuil — ne verrait rien : le compte est sain, le solde est à lui,
  // le rail est connu.
  //
  // Ce délai ne rend pas le détournement impossible ; il laisse au propriétaire
  // le temps de s'en apercevoir. C'est peu, et c'est ce qui existe partout
  // ailleurs pour la même raison.
  //
  // Il n'est PAS levable par un administrateur : un versement déclenché à la
  // main sur un compte qu'on vient de changer est exactement ce que l'attaquant
  // demanderait au support.
  //
  // ────────────────────────────────────────────────────────────────────────
  // POURQUOI IL PASSE EN DERNIER
  //
  // Il vient APRÈS la suspension, le gel et l'enquête, et après les montants.
  // Ce sont des refus durables : dire « ton compte est en cours de
  // vérification » à quelqu'un sous enquête laisserait croire qu'attendre
  // vingt-quatre heures suffira. Et l'annoncer à quelqu'un qui n'a rien à
  // toucher serait annoncer un obstacle imaginaire.
  //
  // Ce refus-ci n'a de sens que quand tout le reste est en ordre et qu'il y a
  // vraiment de l'argent à envoyer.
  const age = (maintenant ?? new Date()).getTime() - compte.enregistreLe.getTime();
  if (age < VERIFICATION_MS) return refus("COMPTE_TROP_RECENT");

  return { payable: true };
}
