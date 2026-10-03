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

/**
 * Ce qu'une adresse peut encore faire compter aujourd'hui.
 *
 * Rend les identifiants à compter, dans l'ordre reçu : une pub vue trois fois
 * dans le même envoi y paraît trois fois, et chaque occurrence consomme une
 * place du plafond.
 *
 * Deux cas où l'on compte sans plafonner, comme la garde de débit
 * (`lib/securite/garde.ts`) : pas d'adresse identifiable, ou compteur en
 * panne. Fermer le comptage parce que Redis hoquette ferait croire qu'une
 * campagne ne marche plus.
 */
export async function sousLePlafond(input: {
  nature: "vue" | "clic";
  sujet: string | null;
  ids: readonly string[];
  plafond: number;
  jour: string;
}): Promise<string[]> {
  if (!input.sujet) return [...input.ids];

  const pilote = piloteLimite();
  // Sans secret, l'empreinte se retrouverait en essayant les quatre milliards
  // d'adresses. `AUTH_SECRET` est exigé par la connexion : il est toujours là
  // en production.
  const secret = process.env.AUTH_SECRET ?? "";
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
