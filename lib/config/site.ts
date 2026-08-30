/**
 * L'adresse publique du site.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CONFIGURÉE, ET JAMAIS DEVINÉE
 *
 * La tentation est de lire l'en-tête `Host` de la requête en cours : le lien
 * pointerait alors toujours sur le bon domaine, sans réglage. C'est une faille
 * connue — l'empoisonnement du lien de réinitialisation. `Host` est fourni par
 * celui qui appelle : il suffit de demander une réinitialisation pour le compte
 * d'autrui en annonçant `Host: chez-moi.example` pour que la victime reçoive un
 * courriel authentique, envoyé par nous, dont le lien mène chez l'attaquant.
 * Elle clique, et son jeton part avec.
 *
 * Il y a d'ailleurs une seconde raison, moins spectaculaire : le passage qui
 * vide la file d'envoi tourne la nuit, sans requête HTTP. Il n'y a aucun `Host`
 * à lire à ce moment-là.
 */
export function urlDuSite(): string | null {
  const brut = process.env.APP_URL?.trim();
  if (!brut) return null;

  try {
    const url = new URL(brut);
    // Le même filtre que sur les autres URL du projet : `javascript:` passe la
    // construction d'une `URL` sans broncher.
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
