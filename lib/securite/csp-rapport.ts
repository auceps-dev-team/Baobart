/**
 * Ce qu'on garde d'un rapport de violation CSP.
 *
 * Module pur : la route `/api/csp-report` lit, ce module trie.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN RAPPORT CSP PORTE L'ADRESSE DE LA PAGE, ET L'ADRESSE PORTE DES SECRETS
 *
 * Le navigateur envoie l'adresse complète de la page où la violation a eu
 * lieu. Sur `/reinitialiser/<jeton>`, c'est le jeton de réinitialisation
 * lui-même — valable une heure, il ouvre le compte. Les extensions de
 * navigateur provoquent des violations sur n'importe quelle page : celle-là
 * comprise.
 *
 * Le 18/10, la route journalisait le rapport entier sous un champ `rapport`.
 * Le journal caviarde par NOM de champ (`lib/observabilite/journal.ts`), pas
 * par contenu : le jeton passait. On ne garde donc que ce qui sert à corriger
 * la politique — la directive, l'origine de ce qui a été bloqué, et le chemin
 * de la page sans ses segments variables.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX FORMATS
 *
 * `report-uri` (ancien, celui que pose `lib/securite/entetes.ts`) envoie
 * `{"csp-report": {...}}` aux clés en tirets ; l'API Reporting envoie un
 * tableau `[{type: "csp-violation", body: {...}}]` aux clés en camelCase.
 */

/** Au-delà, on ne lit pas : un rapport honnête pèse quelques centaines d'octets. */
export const TAILLE_MAX_OCTETS = 8 * 1024;
/** Un envoi groupé de l'API Reporting au plus. */
export const RAPPORTS_MAX = 10;

export interface Violation {
  directive: string;
  bloque: string;
  page: string;
  disposition: string;
}

/**
 * Un segment de chemin qui ressemble à un mot de route (`reinitialiser`,
 * `pack-wax`) est gardé ; tout le reste — jetons, identifiants, `@pseudo` —
 * devient `:x`. Un faux positif masque un slug, ce qui ne coûte rien.
 */
export function cheminSansSecrets(adresse: string): string {
  let chemin: string;
  try {
    chemin = new URL(adresse).pathname;
  } catch {
    return ":x";
  }
  const segments = chemin.split("/").map((s) => (s === "" || /^[a-z][a-z-]{0,39}$/.test(s) ? s : ":x"));
  return segments.join("/") || "/";
}

/** L'origine de ce qui a été bloqué, ou son mot-clé (`inline`, `eval`, `data`). */
export function origineBloquee(valeur: string): string {
  if (/^[a-z-]+$/.test(valeur)) return valeur;
  try {
    const url = new URL(valeur);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : url.protocol.replace(/:$/, "");
  } catch {
    return "inconnu";
  }
}

function texte(objet: Record<string, unknown>, ...cles: string[]): string {
  for (const cle of cles) {
    const v = objet[cle];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

function versViolation(brut: Record<string, unknown>): Violation | null {
  const directive = texte(brut, "effective-directive", "effectiveDirective", "violated-directive", "violatedDirective");
  if (!directive) return null;
  return {
    // « script-src-elem 'self' … » : seul le nom de la directive compte.
    directive: directive.split(/\s+/)[0]!.slice(0, 40),
    bloque: origineBloquee(texte(brut, "blocked-uri", "blockedURL")).slice(0, 120),
    page: cheminSansSecrets(texte(brut, "document-uri", "documentURL")).slice(0, 200),
    disposition: texte(brut, "disposition") === "enforce" ? "enforce" : "report",
  };
}

/** Les violations d'un corps reçu ; un tableau vide quand rien n'est lisible. */
export function lireRapports(corps: unknown): Violation[] {
  if (Array.isArray(corps)) {
    return corps
      .slice(0, RAPPORTS_MAX)
      .flatMap((r) =>
        r && typeof r === "object" && (r as { body?: unknown }).body && typeof (r as { body: unknown }).body === "object"
          ? [versViolation((r as { body: Record<string, unknown> }).body)]
          : [],
      )
      .filter((v): v is Violation => v !== null);
  }
  if (corps && typeof corps === "object") {
    const interieur = (corps as Record<string, unknown>)["csp-report"];
    const v = versViolation(
      interieur && typeof interieur === "object" ? (interieur as Record<string, unknown>) : (corps as Record<string, unknown>),
    );
    return v ? [v] : [];
  }
  return [];
}
