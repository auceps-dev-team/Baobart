/**
 * Quand réessayer, et quand renoncer.
 *
 * Pur : ces règles décident du sort d'un message sans toucher la base, ce qui
 * les rend exerçables. Elles méritent de l'être — se tromper ici produit soit
 * une file qui martèle un service déjà à terre, soit des messages abandonnés
 * pour une panne de trente secondes.
 */

/** Au-delà, on cesse d'essayer tout seul et on attend une décision humaine. */
export const TENTATIVES_MAX = 5;

/**
 * Recul progressif : une minute, cinq, un quart d'heure, une heure, six.
 *
 * Le premier palier est court parce que la panne la plus fréquente est
 * passagère — un délai réseau, un pic chez l'expéditeur. Les suivants
 * s'espacent : si le service est toujours muet au bout d'un quart d'heure, le
 * relancer chaque minute n'aide personne et masque le reste de la file.
 */
const PALIERS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

export function reculApres(tentatives: number): number {
  if (tentatives <= 0) return PALIERS_MS[0];
  const index = Math.min(tentatives - 1, PALIERS_MS.length - 1);
  return PALIERS_MS[index] ?? PALIERS_MS[PALIERS_MS.length - 1]!;
}

export type Suite =
  | { sort: "REESSAYER"; dansMs: number }
  | { sort: "RENONCER"; motif: "definitif" | "trop_de_tentatives" };

/**
 * Le sort d'un message qui vient d'échouer.
 *
 * `tentatives` est le compte **après** incrément — la tentative qui vient
 * d'échouer est comprise dedans.
 */
export function suiteApresEchec(input: {
  tentatives: number;
  definitif: boolean;
}): Suite {
  // Une adresse mal formée ne guérit pas avec le temps : insister ne fait que
  // retarder les messages valides derrière elle dans la file.
  if (input.definitif) return { sort: "RENONCER", motif: "definitif" };

  if (input.tentatives >= TENTATIVES_MAX) {
    return { sort: "RENONCER", motif: "trop_de_tentatives" };
  }

  return { sort: "REESSAYER", dansMs: reculApres(input.tentatives) };
}

/**
 * Au-delà, une ligne « en cours d'envoi » est tenue pour orpheline.
 *
 * Le processus qui l'avait réclamée est mort avant de conclure. On la remet en
 * file — en sachant que le message est peut-être déjà parti : c'est le prix
 * d'une livraison « au moins une fois ». Le doublon gêne moins que le silence,
 * et la clé d'idempotence protège les cas où il compte vraiment.
 */
export const RECLAMATION_PERIMEE_MS = 10 * 60_000;
