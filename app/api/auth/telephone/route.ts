import { rediriger } from "@/lib/http/redirection";

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
 * Adresse relative, par `rediriger` : voir `lib/http/redirection.ts`. C'est
 * sur cette route que le défaut de `requete.url` a été vu le premier — la
 * session se posait sur l'hôte d'écoute, et le profil, visité ensuite,
 * renvoyait à la connexion.
 */
export function GET() {
  return rediriger("/connexion/telephone", 303);
}
