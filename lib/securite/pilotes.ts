import "server-only";

import { journal } from "@/lib/observabilite/journal";

/**
 * Où vivent les compteurs.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX PILOTES, ET LE PREMIER MENT UN PEU
 *
 * **`memoire`** compte dans le processus. En développement et dans les tests,
 * c'est exactement ce qu'il faut : aucune infrastructure, aucun nettoyage.
 *
 * En production serverless, c'est un mensonge — chaque instance a ses propres
 * compteurs, et dix instances multiplient la limite par dix. Le pilote le dit
 * lui-même à l'écran de configuration plutôt que de laisser croire qu'on est
 * protégé.
 *
 * **`redis`** compte pour tout le monde. C'est le seul qui tienne dès qu'il y a
 * plus d'une instance.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ON LAISSE PASSER QUAND LE COMPTEUR EST EN PANNE
 *
 * Redis injoignable rend `null`, et l'appelant autorise. Ce choix se discute et
 * il est assumé : un limiteur indisponible ne doit pas fermer la connexion à
 * tout le monde. Une panne de compteur deviendrait une panne de service, et le
 * remède serait pire que le mal qu'il prévient.
 *
 * La contrepartie est réelle — pendant la panne, plus rien n'est borné — donc
 * l'incident est journalisé en erreur, pas avalé.
 */

export type NomPiloteLimite = "memoire" | "redis" | "aucun";

export interface PiloteLimite {
  nom: NomPiloteLimite;
  /**
   * Incrémente le compteur et rend sa valeur, ou `null` si le compteur est
   * hors service. La péremption n'est posée qu'à la création.
   */
  compter(cle: string, ttlMs: number): Promise<number | null>;
  /** Lit sans incrémenter. `0` quand la clé n'existe pas. */
  lire(cle: string): Promise<number | null>;
}

// ────────────────────────────────────────────────────────────────── mémoire ──

const compteurs = new Map<string, { valeur: number; expireA: number }>();

/**
 * Le ménage se fait à la lecture, pas par une minuterie.
 *
 * Une minuterie tiendrait le processus éveillé et compliquerait les tests. Ici
 * une clé périmée est simplement traitée comme absente, et la carte est purgée
 * quand elle grossit — ce qui n'arrive qu'en développement.
 */
const PLAFOND_MEMOIRE = 10_000;

function purger(maintenant: number): void {
  if (compteurs.size < PLAFOND_MEMOIRE) return;
  for (const [cle, entree] of compteurs) {
    if (entree.expireA <= maintenant) compteurs.delete(cle);
  }
}

const MEMOIRE: PiloteLimite = {
  nom: "memoire",

  async compter(cle, ttlMs) {
    const maintenant = Date.now();
    purger(maintenant);

    const entree = compteurs.get(cle);
    if (!entree || entree.expireA <= maintenant) {
      compteurs.set(cle, { valeur: 1, expireA: maintenant + ttlMs });
      return 1;
    }

    entree.valeur += 1;
    return entree.valeur;
  },

  async lire(cle) {
    const entree = compteurs.get(cle);
    if (!entree || entree.expireA <= Date.now()) return 0;
    return entree.valeur;
  },
};

/** Vidé par les tests. Sans cela, un test hériterait des compteurs du suivant. */
export function oublierCompteurs(): void {
  compteurs.clear();
}

// ──────────────────────────────────────────────────────────────────── redis ──

/**
 * Incrémenter ET poser la péremption doit être un seul geste.
 *
 * En deux commandes, un processus qui meurt entre les deux laisse une clé
 * éternelle : le compteur ne redescend jamais et l'adresse est bannie à vie.
 * Ce petit script fait les deux d'un bloc, et ne pose la péremption qu'à la
 * création — la reposer à chaque appel ferait glisser la fenêtre indéfiniment
 * sous un trafic soutenu, et l'adresse ne serait jamais libérée.
 */
const SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return n
`;

type ClientRedis = {
  eval(
    script: string,
    nombreCles: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
  get(cle: string): Promise<string | null>;
};

let client: ClientRedis | null = null;
let clientImpossible = false;

async function connexion(): Promise<ClientRedis | null> {
  if (client) return client;
  if (clientImpossible) return null;

  const url = (process.env.REDIS_URL ?? "").trim();
  if (!url) {
    clientImpossible = true;
    return null;
  }

  try {
    const { default: Redis } = await import("ioredis");
    client = new Redis(url, {
      /**
       * Toutes les clés de ce projet vivent sous un préfixe à lui.
       *
       * ═════════════════════════════════════════════════════════════════════
       * REDIS ÉCOUTE SUR 6379, ET TOUT LE MONDE UTILISE 6379
       *
       * Postgres a été décalé sur 5433 précisément pour ça (voir
       * `docker-compose.yml`). Redis, non — et sur une machine où plusieurs
       * projets Node tournent ensemble, `redis://localhost:6379` peut très
       * bien désigner le Redis du voisin : le conteneur de Baobart n'a pas
       * réussi à prendre le port, l'application se connecte quand même, et
       * rien ne le signale.
       *
       * Une clé comme `lim:connexion:<ip>:<seau>` n'a alors rien qui dise à
       * qui elle appartient. Le compteur d'un autre projet se lit comme le
       * nôtre : une limite se déclenche sans raison, un test de limitation
       * échoue sur du code juste. C'est le faux positif le plus difficile à
       * diagnostiquer, parce qu'il dépend de ce que fait l'autre projet.
       *
       * `keyPrefix` règle le cas sans toucher aux ports ni aux conteneurs :
       * ioredis l'applique à toutes les commandes à clé, `eval` compris —
       * il connaît la position des clés grâce à `numkeys`.
       *
       * `REDIS_PREFIX` permet de séparer deux instances du même projet, par
       * exemple une base de test et une base de développement qui
       * partageraient un Redis.
       */
      keyPrefix: process.env.REDIS_PREFIX ?? "baobart:",
      // Ne pas empiler les tentatives : si Redis est absent, on veut le savoir
      // tout de suite et laisser passer, pas retenir la requête.
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      lazyConnect: false,
      // Sans ce garde-fou, ioredis réessaie indéfiniment et chaque requête
      // paierait le délai d'attente.
      enableOfflineQueue: false,
    }) as unknown as ClientRedis;

    return client;
  } catch (cause) {
    journal.erreur("client Redis impossible à créer", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    clientImpossible = true;
    return null;
  }
}

/** Referme la connexion et oublie l'échec. Pour les tests et le rechargement. */
export function oublierRedis(): void {
  client = null;
  clientImpossible = false;
}

const REDIS: PiloteLimite = {
  nom: "redis",

  async compter(cle, ttlMs) {
    const c = await connexion();
    if (!c) return null;

    try {
      const valeur = await c.eval(SCRIPT, 1, cle, String(Math.ceil(ttlMs)));
      return typeof valeur === "number" ? valeur : Number(valeur);
    } catch (cause) {
      // On laisse passer. Un limiteur en panne ne doit pas fermer le service.
      journal.erreur("compteur de limitation injoignable", {
        cause: cause instanceof Error ? cause.message : String(cause),
      });
      return null;
    }
  },

  async lire(cle) {
    const c = await connexion();
    if (!c) return null;

    try {
      const brut = await c.get(cle);
      return brut === null ? 0 : Number(brut);
    } catch {
      return null;
    }
  },
};

// ──────────────────────────────────────────────────────────────────── aucun ──

/** Ne compte rien, n'interdit rien. Le réglage de qui préfère ne pas limiter. */
const AUCUN: PiloteLimite = {
  nom: "aucun",
  async compter() {
    return null;
  },
  async lire() {
    return null;
  },
};

const PILOTES: Record<NomPiloteLimite, PiloteLimite> = {
  memoire: MEMOIRE,
  redis: REDIS,
  aucun: AUCUN,
};

/**
 * Le pilote actif.
 *
 * Par défaut `memoire` : un développement qui démarre sans Redis doit quand
 * même voir la limitation fonctionner, sans quoi personne ne l'éprouve jamais.
 * En production, poser `RATE_LIMIT_DRIVER=redis` — l'écran de configuration le
 * réclame.
 */
export function piloteLimite(): PiloteLimite {
  const nom = (process.env.RATE_LIMIT_DRIVER ?? "memoire").trim().toLowerCase();
  return PILOTES[nom as NomPiloteLimite] ?? PILOTES.memoire;
}

export const POUR_TESTS = { MEMOIRE, REDIS, AUCUN };
