/**
 * Quelle preuve exiger avant de changer de compte de versement ?
 *
 * Module pur : l'action lit le compte et la session, ce module décide.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA RÈGLE
 *
 * Décidée le 18/10 (`TACHES_REMEDIATION.md`, VULN-08), confirmée le 23/10 : un
 * second facteur à CHAQUE changement. Un compte détourné redirige l'argent ;
 * la session seule ne suffit pas, puisque c'est elle qu'on vole.
 *
 * Le 18/10, ce facteur ne pouvait être que TOTP : qui n'avait pas installé
 * d'application ne pouvait plus être payé. Le 23/10 : pour ne forcer personne
 * à installer une application, le code arrive par courriel
 * (`lib/auth/code-courriel.ts`). Il n'y a donc plus de compte « sans second
 * facteur » : tout compte a une adresse.
 *
 *   — un compte TOTP donne le code de son application, ou un code de
 *     secours. Il a choisi le facteur le plus fort ; on ne le remplace pas par
 *     un plus faible ;
 *   — tout autre compte donne le code reçu par courriel — ou un code de
 *     secours, s'il en a (un compte à clés d'accès) ;
 *   — un compte à clés d'accès qui vient d'en franchir une (moins d'un quart
 *     d'heure, `FRAICHEUR_SENSIBLE_MS`) n'a rien à saisir : une clé d'accès ne
 *     se laisse pas hameçonner, un code si.
 */

export type Preuve =
  /** Le code de l'application TOTP, ou un code de secours. */
  | { exiger: "CODE_TOTP" }
  /** Le code reçu par courriel — ou, s'il n'a pas six chiffres, un code de secours. */
  | { exiger: "CODE_COURRIEL" }
  /** Le passage récent par une clé d'accès suffit. */
  | { exiger: "RIEN" }
  | { refus: "CODE_MANQUANT" | "CODE_COURRIEL_MANQUANT" };

export function preuveExigee(entree: {
  totpActif: boolean;
  clesDAcces: number;
  codeSaisi: boolean;
  /** La session a franchi la 2FA (TOTP ou clé d'accès) dans le quart d'heure. */
  passageRecent: boolean;
}): Preuve {
  if (entree.totpActif) return entree.codeSaisi ? { exiger: "CODE_TOTP" } : { refus: "CODE_MANQUANT" };
  if (entree.codeSaisi) return { exiger: "CODE_COURRIEL" };
  if (entree.clesDAcces > 0 && entree.passageRecent) return { exiger: "RIEN" };
  return { refus: "CODE_COURRIEL_MANQUANT" };
}

/** Le facteur qu'on propose à l'écran : celui que `preuveExigee` attendra. */
export function facteurPropose(entree: { totpActif: boolean }): "TOTP" | "COURRIEL" {
  return entree.totpActif ? "TOTP" : "COURRIEL";
}

export const MESSAGES_PREUVE = {
  CODE_MANQUANT: "Saisis le code à 6 chiffres de ton application (ou un code de secours).",
  CODE_COURRIEL_MANQUANT: "Demande un code par courriel, puis saisis-le pour confirmer.",
  CODE_FAUX: "Ce code ne correspond pas.",
  EXPIRE: "Ce code a expiré. Demande-en un nouveau.",
  TROP_D_ESSAIS: "Trop d'essais sur ce code. Demande-en un nouveau.",
  AUTRE_COMPTE: "Ce code a été demandé pour un autre compte. Demande-en un pour celui-ci.",
} as const;
