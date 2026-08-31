/**
 * De quelle adresse vient cette requête ?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA QUESTION EST PLUS PIÉGEUSE QU'ELLE N'EN A L'AIR
 *
 * Un limiteur ne vaut que par sa clé. Si l'appelant choisit la sienne, il en
 * change à chaque requête et la limite ne limite rien.
 *
 * Or `x-forwarded-for` est **fourni par le client** : n'importe qui peut
 * l'envoyer avec la valeur qu'il veut. Un mandataire honnête y ajoute l'adresse
 * réelle **à la fin** de ce qu'il a reçu — d'où la lecture habituelle « le
 * premier élément est le client », qui est exactement la mauvaise : c'est celui
 * que le client contrôle entièrement.
 *
 * On préfère donc les en-têtes que la plateforme pose elle-même et qu'un client
 * ne peut pas usurper, et l'on ne retombe sur `x-forwarded-for` qu'en dernier —
 * en prenant alors le **dernier** élément, celui qu'a écrit le mandataire le
 * plus proche de nous.
 *
 * Ce repli reste imparfait. C'est pourquoi aucune décision irréversible ne
 * repose sur cette adresse : elle sert à ralentir, jamais à interdire.
 */

/**
 * Les en-têtes posés par la plateforme, dans l'ordre de confiance.
 *
 * Vercel écrit `x-vercel-forwarded-for` et le remplace s'il arrive de
 * l'extérieur. `x-real-ip` est posé par la plupart des mandataires inverses
 * — Caddy, nginx — et vaut donc pour un déploiement sur serveur.
 */
const SURS = ["x-vercel-forwarded-for", "x-real-ip"] as const;

/** Une adresse plausible. On ne valide pas la forme, on refuse l'absurde. */
function plausible(valeur: string): boolean {
  const v = valeur.trim();
  return v.length > 0 && v.length <= 64 && !/[\s,]/.test(v);
}

/**
 * Rend une adresse, ou `null` quand on n'a rien de crédible.
 *
 * `null` n'est pas une erreur : en développement, derrière un tunnel, ou dans
 * un test, il n'y a pas d'adresse. L'appelant décide alors quoi faire — et il
 * décide de laisser passer, parce qu'un limiteur qui bloque faute d'adresse
 * ferme le service à tout le monde.
 */
export function adresseDe(requete: Request): string | null {
  for (const nom of SURS) {
    const brut = requete.headers.get(nom);
    if (brut && plausible(brut)) return brut.trim();
  }

  const chaine = requete.headers.get("x-forwarded-for");
  if (!chaine) return null;

  // Le DERNIER élément, pas le premier : c'est celui qu'a écrit le mandataire
  // le plus proche de nous, donc le moins usurpable.
  const morceaux = chaine.split(",").map((m) => m.trim()).filter(plausible);
  return morceaux.length > 0 ? morceaux[morceaux.length - 1]! : null;
}

/**
 * La clé de limitation d'une requête anonyme.
 *
 * Sans adresse, on rend `null` et l'appelant laisse passer. Utiliser une valeur
 * de repli commune — « inconnu » — serait pire que rien : tous les visiteurs
 * sans adresse partageraient un seul compteur, et le premier robot fermerait la
 * porte à tous les autres.
 */
export function sujetAnonyme(requete: Request): string | null {
  return adresseDe(requete);
}
