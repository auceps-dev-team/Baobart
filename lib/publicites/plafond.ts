import { createHmac } from "node:crypto";

import { piloteLimite } from "@/lib/securite/pilotes";

/** Vingt-six heures : un jour, et la marge d'un changement de jour en cours. */
export const DUREE_PLAFOND_MS = 26 * 60 * 60 * 1000;

/**
 * La clé du plafond d'une adresse, pour une pub, un jour, une nature de geste.
 * L'adresse n'y paraît qu'à travers une empreinte au secret du site.
 */
export function cleDuPlafond(input: {
  secret: string;
  sujet: string;
  pubId: string;
  jour: string;
  nature: "vue" | "clic";
}): string {
  const empreinte = createHmac("sha256", `${input.secret}|${input.jour}`)
    .update(`${input.sujet}|${input.pubId}`)
    .digest("hex")
    .slice(0, 32);
  return `pub:plafond:${input.nature}:${input.jour}:${empreinte}`;
}

/** En dessous, une empreinte se retrouve presque aussi vite que sans secret. */
export const LONGUEUR_MIN_SECRET = 16;

/**
 * Le secret de l'empreinte, ou `null` s'il manque ou s'il est trop court.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SANS SECRET, L'EMPREINTE NE CACHE RIEN
 *
 * Une IPv4 n'a que quatre milliards de valeurs : avec une clé vide, on retrouve
 * l'adresse derrière une empreinte en les essayant toutes, en quelques minutes.
 *
 * Constaté le 08/10/2026 : `AUTH_SECRET` n'est lu qu'ici. La connexion ne
 * l'exige pas — les sessions sont maison, sans NextAuth — et rien d'autre ne
 * garantit sa présence en production. L'ancien repli sur `""` réussissait donc
 * en silence : le plafond tenait, et les clés rangées dans Redis étaient des
 * adresses à peine déguisées.
 */
export function secretDuPlafond(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const secret = (env.AUTH_SECRET ?? "").trim();
  return secret.length >= LONGUEUR_MIN_SECRET ? secret : null;
}

/**
 * Ce qu'une adresse peut encore faire compter aujourd'hui.
 *
 * Rend les identifiants à compter, dans l'ordre reçu : une pub vue trois fois
 * dans le même envoi y paraît trois fois, et chaque occurrence consomme une
 * place du plafond.
 *
 * Trois cas où l'on compte sans plafonner, comme la garde de débit
 * (`lib/securite/garde.ts`) : pas d'adresse identifiable, compteur en panne,
 * ou pas de secret pour cacher l'adresse. Fermer le comptage ferait croire
 * qu'une campagne ne marche plus ; ranger l'adresse presque en clair serait
 * pire. L'absence de secret s'annonce sur l'écran Système.
 */
export async function sousLePlafond(input: {
  nature: "vue" | "clic";
  sujet: string | null;
  ids: readonly string[];
  plafond: number;
  jour: string;
}): Promise<string[]> {
  if (!input.sujet) return [...input.ids];

  const secret = secretDuPlafond();
  if (!secret) return [...input.ids];

  const pilote = piloteLimite();
  const gardes: string[] = [];

  for (const pubId of input.ids) {
    const n = await pilote.compter(
      cleDuPlafond({ secret, sujet: input.sujet, pubId, jour: input.jour, nature: input.nature }),
      DUREE_PLAFOND_MS,
    );
    if (n === null || n <= input.plafond) gardes.push(pubId);
  }

  return gardes;
}
