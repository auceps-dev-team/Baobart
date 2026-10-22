/**
 * Quelle preuve exiger avant de changer de compte de versement ?
 *
 * Module pur : l'action lit le compte et la session, ce module décide.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA RÈGLE DU 18/10, ET CE QU'ELLE OUBLIAIT
 *
 * Décidée le 18/10 (`TACHES_REMEDIATION.md`, VULN-08) : la double
 * authentification est obligatoire, et un code se saisit à chaque changement.
 * Un compte détourné redirige l'argent ; la session seule ne suffit pas.
 *
 * Elle exigeait TOTP, et seulement TOTP. Or un compte peut n'avoir que des clés
 * d'accès (passkeys), avec leurs codes de secours (`verifierCodeOuSecours` les
 * accepte sans TOTP). Ce compte-là était refusé — enfermé dehors avec une
 * protection plus forte que celle qu'on lui demandait.
 *
 * Pour lui, un code de secours vaut toujours ; à défaut, une clé d'accès
 * franchie depuis moins d'un quart d'heure (`FRAICHEUR_SENSIBLE_MS`, le seuil
 * des autres gestes sensibles). Une clé d'accès ne se laisse pas hameçonner, un
 * code TOTP si : la remplacer par un code serait un recul.
 */

export type Preuve =
  /** Vérifier le code saisi (TOTP ou secours). */
  | { exiger: "CODE" }
  /** Le passage récent suffit — compte à clés d'accès sans code saisi. */
  | { exiger: "RIEN" }
  | { refus: "SANS_DEUX_FACTEURS" | "CODE_MANQUANT" | "PASSAGE_ANCIEN" };

export function preuveExigee(entree: {
  totpActif: boolean;
  clesDAcces: number;
  codeSaisi: boolean;
  /** La session a franchi la 2FA (TOTP ou clé d'accès) dans le quart d'heure. */
  passageRecent: boolean;
}): Preuve {
  if (entree.totpActif) return entree.codeSaisi ? { exiger: "CODE" } : { refus: "CODE_MANQUANT" };
  if (entree.clesDAcces === 0) return { refus: "SANS_DEUX_FACTEURS" };
  if (entree.codeSaisi) return { exiger: "CODE" };
  return entree.passageRecent ? { exiger: "RIEN" } : { refus: "PASSAGE_ANCIEN" };
}

export const MESSAGES_PREUVE = {
  SANS_DEUX_FACTEURS:
    "La double authentification est obligatoire pour enregistrer un compte de versement. Active-la dans ton profil (application TOTP ou clé d'accès).",
  CODE_MANQUANT: "Saisis le code à 6 chiffres de ton application (ou un code de secours).",
  PASSAGE_ANCIEN:
    "Reconnecte-toi avec ta clé d'accès, ou saisis un code de secours : la dernière vérification date de plus d'un quart d'heure.",
  CODE_FAUX: "Ce code ne correspond pas.",
} as const;
