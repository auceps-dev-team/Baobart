/**
 * Là où mène le bouton « Téléphone » de la connexion (`components/auth/
 * auth-form.tsx` envoie chaque fournisseur actif vers `/api/auth/<id>`).
 *
 * Le téléphone n'est pas une redirection OAuth : c'est un formulaire en deux
 * étapes. Cette route ne fait donc que renvoyer vers sa page. Elle existe pour
 * que l'adresse du bouton ne soit jamais une 404, et c'est son existence que
 * `lib/auth/providers.test.ts` confronte au `branche: true` du registre.
 *
 * 303 : le navigateur suit en GET, quelle que soit la méthode d'arrivée.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE ADRESSE RELATIVE, ET NON `new URL(…, requete.url)`
 *
 * Mesuré le 08/10/2026 sous `next start -p 3300` : `requete.url` porte l'hôte
 * sur lequel le serveur ÉCOUTE, pas celui que le navigateur a demandé. Appelée
 * en `Host: 127.0.0.1:3300` — ou `Host: baobart.ci`, ou avec un
 * `X-Forwarded-Host` —, la route renvoyait vers `http://localhost:3300/…`.
 *
 * Le parcours ne cassait pas : il continuait sur `localhost`, y posait le
 * cookie de session, et la page suivante, revenue sur l'hôte d'origine,
 * n'avait plus de session. Derrière un mandataire, l'hôte d'écoute est celui
 * du conteneur (`HOSTNAME=0.0.0.0` dans le Dockerfile) : la redirection
 * mènerait hors du site. Non mesuré sur l'image elle-même.
 *
 * Un `Location` relatif est résolu par le navigateur contre l'adresse qu'il a
 * lui-même demandée (RFC 9110 §10.2.2) : rien à deviner, rien à configurer.
 */
export function GET() {
  return new Response(null, { status: 303, headers: { Location: "/connexion/telephone" } });
}
