import "server-only";

/**
 * Registre des moyens de connexion secondaires.
 *
 * Chaque fournisseur déclare les variables d'environnement dont il a besoin.
 * Un fournisseur est **actif** quand toutes ses variables sont renseignées.
 *
 * ⚠️ « Actif » ne veut pas dire « branché ». Ce commentaire disait qu'il
 * suffisait de remplir le `.env` pour l'allumer en production. Relevé le
 * 08/10/2026 : le bouton actif mène à `/api/auth/<id>`
 * (`components/auth/auth-form.tsx`), et aucune route de ce nom n'existe dans
 * `app/`. Le flux OAuth et l'envoi d'OTP restent à écrire ; d'ici là, poser
 * ces variables produit un bouton qui mène à une 404.
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
  /** Variables à renseigner pour que le fournisseur devienne actif. */
  variables: string[];
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
  },
  {
    id: "google",
    label: "Google",
    glyph: "G",
    genre: "oauth",
    variables: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"],
  },
  {
    id: "apple",
    label: "Apple",
    glyph: "",
    genre: "oauth",
    variables: ["AUTH_APPLE_ID", "AUTH_APPLE_SECRET"],
  },
  {
    id: "facebook",
    label: "Facebook",
    glyph: "f",
    genre: "oauth",
    variables: ["AUTH_FACEBOOK_ID", "AUTH_FACEBOOK_SECRET"],
  },
  {
    id: "instagram",
    label: "Instagram",
    glyph: "ig",
    genre: "oauth",
    variables: ["AUTH_INSTAGRAM_ID", "AUTH_INSTAGRAM_SECRET"],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    glyph: "in",
    genre: "oauth",
    variables: ["AUTH_LINKEDIN_ID", "AUTH_LINKEDIN_SECRET"],
  },
  {
    id: "figma",
    label: "Figma",
    glyph: "F",
    genre: "oauth",
    variables: ["AUTH_FIGMA_ID", "AUTH_FIGMA_SECRET"],
  },
  {
    id: "github",
    label: "GitHub",
    glyph: "gh",
    genre: "oauth",
    variables: ["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"],
  },
  {
    id: "discord",
    label: "Discord",
    glyph: "dc",
    genre: "oauth",
    variables: ["AUTH_DISCORD_ID", "AUTH_DISCORD_SECRET"],
  },
];

/** Ce que reçoit le navigateur : aucun secret, juste de quoi afficher. */
export interface FournisseurPublic {
  id: string;
  label: string;
  glyph: string;
  genre: GenreFournisseur;
  actif: boolean;
}

function estRenseignee(variable: string): boolean {
  const valeur = process.env[variable];
  return typeof valeur === "string" && valeur.trim().length > 0;
}

export function listerFournisseurs(): FournisseurPublic[] {
  return FOURNISSEURS.map((f) => ({
    id: f.id,
    label: f.label,
    glyph: f.glyph,
    genre: f.genre,
    actif: f.variables.every(estRenseignee),
  }));
}

/** Variables manquantes d'un fournisseur — pour un futur écran d'administration. */
export function variablesManquantes(id: string): string[] {
  const f = FOURNISSEURS.find((x) => x.id === id);
  if (!f) return [];
  return f.variables.filter((v) => !estRenseignee(v));
}
