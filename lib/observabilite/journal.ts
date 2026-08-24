/**
 * Journal structuré.
 *
 * En production, personne ne lit les journaux ligne à ligne : on les
 * interroge. `console.log("échec upload " + id)` ne s'interroge pas — il faut
 * une expression régulière pour en ressortir l'identifiant, et elle casse au
 * premier changement de formulation. Une ligne JSON par événement se filtre
 * par champ, sur Vercel comme derrière `docker logs`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE PROTÈGE
 *
 * Le vrai risque d'un journal n'est pas d'être illisible, c'est d'être trop
 * bavard. Un objet passé à la légère — le contexte d'une requête, une
 * configuration S3, un en-tête — emporte des clés d'accès et des jetons de
 * session vers un agrégateur de logs qui les conservera des mois, et que bien
 * plus de gens peuvent lire que la base de données.
 *
 * Les champs dont le nom évoque un secret sont donc remplacés par `[caviardé]`,
 * à tous les niveaux d'imbrication. Le filtre se trompe parfois en caviardant
 * ce qui ne l'exigeait pas ; c'est le sens dans lequel il faut se tromper.
 */

export type Niveau = "info" | "avertissement" | "erreur";

/**
 * Ce qui ne sort jamais.
 *
 * Sur le **nom** du champ, jamais sur sa valeur : chercher ce qui « ressemble »
 * à un jeton dans le contenu produit des faux négatifs à la première clé d'un
 * format inattendu.
 */
const NOMS_SENSIBLES =
  /(secret|token|jeton|password|motdepasse|passe|authorization|cookie|session|credential|accesskey|apikey|api_key|signature|dsn)/i;

const REMPLACEMENT = "[caviardé]";

/** Au-delà, on arrête de descendre : un objet cyclique ne doit pas nous piéger. */
const PROFONDEUR_MAX = 6;

export type Champs = Record<string, unknown>;

function nettoyer(valeur: unknown, profondeur: number): unknown {
  if (profondeur > PROFONDEUR_MAX) return "[trop profond]";

  // Une `Error` se sérialise en `{}` : son message et sa pile ne sont pas des
  // propriétés énumérables. Sans ce cas, journaliser une erreur ne journalise
  // rien — précisément quand on en a besoin.
  if (valeur instanceof Error) {
    return {
      nom: valeur.name,
      message: valeur.message,
      pile: valeur.stack?.split("\n").slice(0, 8).join("\n"),
    };
  }

  if (Array.isArray(valeur)) {
    return valeur.map((v) => nettoyer(v, profondeur + 1));
  }

  if (valeur && typeof valeur === "object") {
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
      sortie[cle] = NOMS_SENSIBLES.test(cle)
        ? REMPLACEMENT
        : nettoyer(v, profondeur + 1);
    }
    return sortie;
  }

  // `BigInt` fait échouer `JSON.stringify` en levant une exception : une ligne
  // de journal ne doit jamais pouvoir casser ce qu'elle observe.
  if (typeof valeur === "bigint") return valeur.toString();

  return valeur;
}

/** La ligne telle qu'elle part, sans l'écrire — pour pouvoir la tester. */
export function ligne(
  niveau: Niveau,
  message: string,
  champs: Champs = {},
  maintenant: Date = new Date(),
): string {
  const nettoyes = nettoyer(champs, 0) as Record<string, unknown>;

  return JSON.stringify({
    horodatage: maintenant.toISOString(),
    niveau,
    message,
    ...nettoyes,
  });
}

/**
 * Les avertissements et les erreurs partent sur `stderr`.
 *
 * Beaucoup d'hébergeurs ne trient que sur ce canal-là : une erreur écrite sur
 * `stdout` se noie dans le trafic normal et n'alerte personne.
 */
function ecrire(niveau: Niveau, message: string, champs?: Champs): void {
  const texte = ligne(niveau, message, champs);
  if (niveau === "info") {
    console.log(texte);
  } else {
    console.error(texte);
  }
}

export const journal = {
  info: (message: string, champs?: Champs) => ecrire("info", message, champs),
  avertissement: (message: string, champs?: Champs) =>
    ecrire("avertissement", message, champs),
  erreur: (message: string, champs?: Champs) =>
    ecrire("erreur", message, champs),
};
