/**
 * Les en-têtes de sécurité HTTP, posés sur toutes les réponses.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI ILS MANQUAIENT, ET CE QU'ILS ACHÈTENT
 *
 * Rien dans le dépôt ne les posait — ni `next.config.ts`, ni un middleware, ni
 * `vercel.json` (audit du 08/10/2026). Trois conséquences concrètes :
 *
 *   — **le site pouvait s'afficher dans l'iframe d'un autre** : une page
 *     piégée superpose un bouton invisible sur « Payer » ou « Supprimer mon
 *     compte » (le *clickjacking*) ;
 *   — **pas de HSTS** : la première visite tapée sans `https://` passe en
 *     clair, le temps d'une redirection qu'un réseau hostile peut détourner ;
 *   — **pas de CSP** : le jour où une XSS passe, rien ne limite ce que le
 *     script injecté peut charger ou à qui il peut parler.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI LA CSP EST EN « REPORT-ONLY »
 *
 * Une CSP qui bloque, posée à l'aveugle, casse des choses qu'on ne voit pas en
 * développement : un téléversement direct vers le stockage, une image de CDN,
 * un script de Next. `Content-Security-Policy-Report-Only` applique la même
 * règle sans rien bloquer : le navigateur signale chaque violation dans sa
 * console. Quand une période d'observation n'en montre plus, on renomme
 * l'en-tête — et la règle mord.
 *
 * Les autres en-têtes, eux, mordent dès maintenant : aucun ne dépend de ce que
 * la page charge.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUE ÇA NE FAIT PAS
 *
 *   — aucun `report-uri` : les violations restent dans la console de chaque
 *     visiteur, personne ne les collecte. Pour passer en mode bloquant, il faut
 *     les regarder soi-même, page par page, ou ajouter une route de collecte ;
 *   — `'unsafe-inline'` pour les scripts : Next injecte des scripts en ligne
 *     pour l'hydratation, et s'en passer demande un nonce par requête, donc un
 *     middleware et des pages toutes dynamiques. C'est le prochain pas, pas
 *     celui-ci ;
 *   — HSTS sans `includeSubDomains` ni `preload` : on ne sait pas quels
 *     sous-domaines existeront, ni s'ils parleront tous HTTPS. Un `preload`
 *     se retire en des mois, pas en un déploiement.
 *
 * Pur et sans import : `next.config.ts` l'appelle au build, et un test peut
 * l'appeler sans rien monter.
 *
 * « Au build » compte : Next fige les en-têtes dans son manifeste des routes.
 * Une origine de stockage changée après coup ne s'y verra qu'au build suivant
 * — d'où les `ARG S3_*` du Dockerfile.
 */

export interface EnteteHttp {
  key: string;
  value: string;
}

/**
 * Les origines du stockage, à autoriser pour les images et l'envoi direct.
 *
 * Le navigateur téléverse vers `S3_ENDPOINT` par URL signée, et affiche les
 * aperçus depuis `S3_PUBLIC_URL` (le CDN en production). Une URL illisible est
 * ignorée plutôt que de casser le build — comme dans `next.config.ts`.
 */
function originesDuStockage(env: Record<string, string | undefined>): string[] {
  const origines = new Set<string>();
  for (const brut of [env.S3_PUBLIC_URL, env.S3_ENDPOINT]) {
    if (!brut) continue;
    try {
      origines.add(new URL(brut).origin);
    } catch {
      // Ignorée : le pire cas est une violation signalée, pas un build cassé.
    }
  }
  return [...origines];
}

/** La politique de contenu, une directive par ligne pour rester relisible. */
export function politiqueDeContenu(
  env: Record<string, string | undefined>,
): string {
  const stockage = originesDuStockage(env);
  const developpement = env.NODE_ENV === "development";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // `'unsafe-eval'` en développement seulement : le rafraîchissement à chaud
    // de Next en a besoin, un build de production non.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(developpement ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...stockage],
    "media-src": ["'self'", "blob:", ...stockage],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...stockage],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  return Object.entries(directives)
    .map(([nom, valeurs]) => `${nom} ${valeurs.join(" ")}`)
    .join("; ");
}

export function entetesDeSecurite(
  env: Record<string, string | undefined>,
): EnteteHttp[] {
  return [
    // Deux ans. Ignoré par le navigateur sur une réponse en HTTP clair, donc
    // sans effet en développement.
    { key: "Strict-Transport-Security", value: "max-age=63072000" },
    // `DENY` plutôt que `SAMEORIGIN` : aucune page du site n'en encadre une
    // autre. `frame-ancestors` dit la même chose aux navigateurs récents, mais
    // il est dans une CSP qui ne bloque pas encore.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // L'adresse complète reste chez nous ; les autres sites ne voient que
    // l'origine. Une URL de commande ou de jeton n'a pas à fuiter en Referer.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Rien dans le dépôt n'utilise caméra, micro ni position. Les passkeys
    // (WebAuthn) restent permises : leur valeur par défaut est `self`.
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    {
      key: "Content-Security-Policy-Report-Only",
      value: politiqueDeContenu(env),
    },
  ];
}
