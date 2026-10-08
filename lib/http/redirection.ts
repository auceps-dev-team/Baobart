import { NextResponse } from "next/server";

/**
 * Une redirection dont l'adresse ne dépend pas de l'hôte où le serveur écoute.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI A ÉTÉ MESURÉ
 *
 * Sous `next start` (Next.js 15.5), `request.url` dans une route porte l'hôte
 * sur lequel le serveur ÉCOUTE, pas l'en-tête `Host` que le navigateur a
 * envoyé. Mesuré le 08/10/2026 avec `next start -p 3300` et `Host: baobart.ci` :
 *
 *   GET /api/telechargement/inexistant → 307, location: http://localhost:3300/connexion
 *   GET /api/pub/inexistante/clic      → 303, location: http://localhost:3300/
 *
 * Avec `X-Forwarded-Host: baobart.ci` et `X-Forwarded-Proto: https`, mesuré le
 * même jour : https://localhost:3300/. Tout `NextResponse.redirect(new
 * URL(chemin, requete.url))` envoyait donc le visiteur sur localhost — ou sur
 * 0.0.0.0:3000 dans l'image Docker, qui pose HOSTNAME=0.0.0.0 (non mesuré).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE REMÈDE : UNE LOCATION RELATIVE
 *
 * Le navigateur résout une `Location` relative contre l'URL qu'il a lui-même
 * demandée (RFC 9110 §10.2.2) : le bon hôte, sans que le serveur ait à le
 * connaître. `NextResponse.redirect` refuse une URL relative ; la réponse se
 * construit donc à la main — un `NextResponse`, pour garder `cookies.set`.
 *
 * On ne reconstruit PAS l'origine depuis `Host` : c'est l'empoisonnement que
 * `lib/config/site.ts` décrit. Quand une adresse absolue est vraiment
 * nécessaire (un courriel), c'est `urlDuSite()`.
 */
export function rediriger(cible: string, statut: 302 | 303 | 307): NextResponse {
  return new NextResponse(null, { status: statut, headers: { Location: locationSure(cible) } });
}

/**
 * Ce que la `Location` peut porter : un chemin de chez nous, ou une adresse
 * http(s) absolue (le site d'un annonceur). Tout le reste mène à l'accueil.
 *
 * « //ailleurs.com » ressemble à un chemin et n'en est pas un — le navigateur
 * le lit comme une adresse extérieure, et « /\ailleurs.com » comme « // ». Même
 * règle que `lienAcceptable` (lib/publicites/regles.ts), redite ici parce
 * qu'une redirection ne doit pas dépendre de ce qui a été validé ailleurs.
 */
export function locationSure(cible: string): string {
  if (cible.startsWith("/")) return /^\/[/\\]/.test(cible) || /\s/.test(cible) ? "/" : cible;
  try {
    const url = new URL(cible);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    // Ni chemin ni adresse : l'accueil.
  }
  return "/";
}
