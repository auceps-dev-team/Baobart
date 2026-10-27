import { journal } from "@/lib/observabilite/journal";

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

/**
 * `cf-connecting-ip`, seulement quand on l'a déclaré.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN EN-TÊTE N'EST SÛR QUE LÀ OÙ QUELQU'UN LE RÉÉCRIT
 *
 * Cloudflare pose cet en-tête et écrase celui qu'envoie le client. Hors de
 * Cloudflare, personne ne l'écrase : c'est un en-tête comme un autre, que le
 * client remplit à sa guise.
 *
 * Le 18/10, il avait été ajouté en tête de liste sans condition. Mesuré le
 * 22/10 : derrière Vercel, une requête qui porte `cf-connecting-ip` forgé
 * faisait ignorer `x-vercel-forwarded-for`, et la clé de limitation suivait
 * la valeur forgée — une nouvelle à chaque requête, donc aucune limite. La
 * même adresse alimente `lib/securite/blocklist.ts` : on pouvait aussi faire
 * porter ses requêtes à l'adresse de quelqu'un d'autre.
 *
 * D'où `ADRESSE_CLOUDFLARE=true`, à ne poser que si le site n'est joignable
 * QUE par Cloudflare (origine fermée au reste du monde).
 */
function enTetesSurs(env: Record<string, string | undefined>): readonly string[] {
  return env.ADRESSE_CLOUDFLARE === "true" ? ["cf-connecting-ip", ...SURS] : SURS;
}

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
export function adresseDe(
  requete: Request,
  env: Record<string, string | undefined> = process.env,
): string | null {
  for (const nom of enTetesSurs(env)) {
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
 * Sans adresse identifiable :
 * — en développement, en test, derrière un tunnel : `null`, et l'appelant
 *   laisse passer ;
 * — en production (ou `RATE_LIMIT_STRICT=true`) : la clé commune
 *   `"anonyme-sans-ip"`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN COMPROMIS, PAS UNE SOLUTION
 *
 * Jusqu'au 18/10, une requête sans adresse passait toujours : quiconque
 * atteignait le conteneur sans passer par le mandataire n'était limité par
 * rien, en silence. La clé commune ferme ce passage.
 *
 * Son prix : si le mandataire cesse de poser ses en-têtes, TOUS les visiteurs
 * partagent ce compteur, et le premier robot ferme la connexion à tout le
 * monde. On le préfère au silence — la panne se voit, et le journal la nomme
 * une fois par processus —, mais la vraie réponse est ailleurs : un
 * conteneur qui n'écoute que le mandataire.
 */
export function sujetAnonyme(
  requete: Request,
  optionnelStrict?: boolean,
): string | null {
  const adresse = adresseDe(requete);
  if (adresse) return adresse;

  const strict =
    optionnelStrict ??
    (process.env.NODE_ENV === "production" ||
      process.env.RATE_LIMIT_STRICT === "true");
  if (!strict) return null;

  if (!dejaSignale) {
    dejaSignale = true;
    journal.avertissement("requête sans adresse : clé de limitation commune", {
      remede:
        "Le mandataire inverse doit poser x-real-ip (ou Vercel x-vercel-forwarded-for). Sans lui, tous les visiteurs partagent un seul compteur.",
    });
  }
  return SANS_ADRESSE;
}

/** La clé que partagent les requêtes sans adresse, en production. */
export const SANS_ADRESSE = "anonyme-sans-ip";

let dejaSignale = false;
