import { createHash, timingSafeEqual } from "node:crypto";

/**
 * La garde des routes d'ordonnanceur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 *
 * Elle était recopiée dans les six routes de `app/api/cron/`. Recopiée, et
 * déjà divergente : quatre écrivaient `recu ^ voulu`, deux `voulu ^ recu`.
 * L'écart est sans conséquence, et c'est précisément ce qui le rend
 * instructif — personne ne l'avait vu, donc personne ne verrait non plus un
 * écart qui en aurait une.
 *
 * Une correction de sécurité faite dans un fichier sur six laisse cinq routes
 * ouvertes, et rien ne le signale : les cinq continuent de refuser les mauvais
 * secrets, simplement moins bien. C'est un défaut qui réussit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON COMPARE DES EMPREINTES, PAS DES CHAÎNES
 *
 * La version recopiée commençait par `if (recu.length !== voulu.length) return
 * false`. Ce raccourci est obligatoire pour comparer deux chaînes caractère par
 * caractère — mais il **répond instantanément** sur toute longueur fausse. Un
 * attaquant apprend donc la longueur du secret, ce qui réduit l'espace à
 * fouiller avant même d'avoir deviné un seul caractère.
 *
 * Passer les deux par SHA-256 supprime la question : deux empreintes font
 * toujours trente-deux octets, quelle que soit l'entrée. `timingSafeEqual` les
 * compare alors en temps constant, sans qu'aucune longueur ne transpire.
 *
 * Le condensat n'est pas là pour protéger le secret — il est en clair dans
 * l'environnement des deux côtés. Il est là pour égaliser les longueurs.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 404 ET NON 401
 *
 * Une route d'ordonnanceur n'a pas à confirmer son existence à qui n'a pas le
 * secret. `401` dit « tu as trouvé la bonne URL, il te manque le jeton » ;
 * `404` ne dit rien.
 */

/**
 * Le secret attendu est-il présenté ?
 *
 * Rend `false` quand `CRON_SECRET` est absent ou vide : une route qui
 * s'ouvrirait faute de configuration serait un déclencheur public d'écritures
 * en masse. Mieux vaut un ordonnanceur qui ne tourne pas — cela se voit — qu'un
 * ordonnanceur que n'importe qui déclenche.
 */
export function ordonnanceurAutorise(requete: Request): boolean {
  const attendu = process.env.CRON_SECRET;
  if (!attendu || attendu.length === 0) return false;

  const recu = requete.headers.get("authorization") ?? "";

  return timingSafeEqual(
    createHash("sha256").update(`Bearer ${attendu}`).digest(),
    createHash("sha256").update(recu).digest(),
  );
}

/**
 * La réponse à opposer quand la garde refuse.
 *
 * Extraite pour la même raison que la garde : six routes rendaient chacune leur
 * `new NextResponse("Not found", { status: 404 })`, et il suffisait d'en
 * oublier une pour qu'une route réponde autre chose et se signale ainsi.
 */
export function reponseIntrouvable(): Response {
  return new Response("Not found", { status: 404 });
}
