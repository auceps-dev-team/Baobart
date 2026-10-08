import "server-only";

/**
 * Registre des moyens de connexion secondaires.
 *
 * Chaque fournisseur déclare les variables d'environnement dont il a besoin,
 * et s'il est **branché** — c'est-à-dire si une route le reçoit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CONFIGURÉ, BRANCHÉ, ACTIF : TROIS MOTS, TROIS FAITS
 *
 *   — **configuré** : toutes ses variables sont posées. Un fait sur
 *     l'environnement, rien de plus ;
 *   — **branché** : `app/api/auth/<id>/route.ts` existe et sait conduire la
 *     connexion. Un fait sur le code ;
 *   — **actif** : les deux. Seul un fournisseur actif rend son bouton
 *     cliquable (`components/auth/auth-form.tsx`, qui mène à `/api/auth/<id>`).
 *
 * Jusqu'au 08/10/2026, « actif » voulait dire « configuré », et le commentaire
 * promettait qu'il suffisait de remplir le `.env`. Or aucune route
 * `/api/auth/*` n'existait : poser `AUTH_GOOGLE_ID` et `AUTH_GOOGLE_SECRET`
 * transformait « Bientôt disponible » en un bouton menant à une 404, et l'écran
 * Système comptait Google parmi les fournisseurs actifs. Rien ne plantait.
 *
 * `branche` est écrit à la main, et `providers.test.ts` le confronte au
 * dossier `app/api/auth/` dans les deux sens : un fournisseur déclaré branché
 * sans route, ou une route sans fournisseur déclaré branché, fait échouer la
 * suite. Brancher un fournisseur, c'est donc écrire sa route ET passer son
 * `branche` à `true`, dans le même commit.
 *
 * ⚠️ Ce module est `server-only` : il lit des secrets. Vers le navigateur, on
 * n'envoie que `FournisseurPublic`, qui ne contient qu'un libellé et un
 * booléen. Une clé d'API n'a rien à faire dans un bundle.
 */

export type GenreFournisseur = "otp" | "oauth";

interface Fournisseur {
  id: string;
  label: string;
  /** Glyphe affiché, dans l'esprit de la maquette (Space Mono). */
  glyph: string;
  genre: GenreFournisseur;
  /** Variables à renseigner pour que le fournisseur soit configuré. */
  variables: string[];
  /**
   * Une route `app/api/auth/<id>/route.ts` conduit-elle la connexion ?
   * Confronté au dossier par `providers.test.ts`.
   */
  branche: boolean;
}

/**
 * Le téléphone vient en tête : sur le marché visé, c'est le moyen que tout le
 * monde possède. `SPEC_AUTH_INTEGRATIONS` le désigne même comme mode principal
 * — arbitrage encore ouvert, mais il n'a rien à faire en dernier de la liste.
 */
const FOURNISSEURS: Fournisseur[] = [
  {
    id: "telephone",
    label: "Téléphone",
    glyph: "☎",
    genre: "otp",
    variables: ["AUTH_OTP_PROVIDER", "AUTH_OTP_API_KEY", "AUTH_OTP_SENDER"],
    branche: false,
  },
  {
    id: "google",
    label: "Google",
    glyph: "G",
    genre: "oauth",
    variables: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"],
    branche: false,
  },
  {
    id: "apple",
    label: "Apple",
    glyph: "",
    genre: "oauth",
    variables: ["AUTH_APPLE_ID", "AUTH_APPLE_SECRET"],
    branche: false,
  },
  {
    id: "facebook",
    label: "Facebook",
    glyph: "f",
    genre: "oauth",
    variables: ["AUTH_FACEBOOK_ID", "AUTH_FACEBOOK_SECRET"],
    branche: false,
  },
  {
    id: "instagram",
    label: "Instagram",
    glyph: "ig",
    genre: "oauth",
    variables: ["AUTH_INSTAGRAM_ID", "AUTH_INSTAGRAM_SECRET"],
    branche: false,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    glyph: "in",
    genre: "oauth",
    variables: ["AUTH_LINKEDIN_ID", "AUTH_LINKEDIN_SECRET"],
    branche: false,
  },
  {
    id: "figma",
    label: "Figma",
    glyph: "F",
    genre: "oauth",
    variables: ["AUTH_FIGMA_ID", "AUTH_FIGMA_SECRET"],
    branche: false,
  },
  {
    id: "github",
    label: "GitHub",
    glyph: "gh",
    genre: "oauth",
    variables: ["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"],
    branche: false,
  },
  {
    id: "discord",
    label: "Discord",
    glyph: "dc",
    genre: "oauth",
    variables: ["AUTH_DISCORD_ID", "AUTH_DISCORD_SECRET"],
    branche: false,
  },
];

/** Ce que reçoit le navigateur : aucun secret, juste de quoi afficher. */
export interface FournisseurPublic {
  id: string;
  label: string;
  glyph: string;
  genre: GenreFournisseur;
  /** Configuré ET branché : le seul cas où le bouton mène quelque part. */
  actif: boolean;
}

/** Ce que l'écran Système doit pouvoir distinguer. Reste côté serveur. */
export interface EtatFournisseur {
  id: string;
  label: string;
  configure: boolean;
  branche: boolean;
}

function estRenseignee(variable: string): boolean {
  const valeur = process.env[variable];
  return typeof valeur === "string" && valeur.trim().length > 0;
}

export function etatDesFournisseurs(): EtatFournisseur[] {
  return FOURNISSEURS.map((f) => ({
    id: f.id,
    label: f.label,
    configure: f.variables.every(estRenseignee),
    branche: f.branche,
  }));
}

export function listerFournisseurs(): FournisseurPublic[] {
  return FOURNISSEURS.map((f) => ({
    id: f.id,
    label: f.label,
    glyph: f.glyph,
    genre: f.genre,
    actif: f.branche && f.variables.every(estRenseignee),
  }));
}

/** Variables manquantes d'un fournisseur — pour un futur écran d'administration. */
export function variablesManquantes(id: string): string[] {
  const f = FOURNISSEURS.find((x) => x.id === id);
  if (!f) return [];
  return f.variables.filter((v) => !estRenseignee(v));
}

export const POUR_TESTS = { FOURNISSEURS };
