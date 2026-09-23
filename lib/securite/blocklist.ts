import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { adresseDe } from "@/lib/securite/adresse";

/**
 * Liste de blocage — adresses, courriels, téléphones, cartes.
 *
 * Traduit `blocked_object.rb` et `block_object_worker.rb` (antiwork/gumroad,
 * MIT, lus comme spécification), §3.6 du plan de refonte.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QU'ELLE N'EST PAS
 *
 * Ce n'est pas un limiteur. `lib/securite/garde.ts` ralentit tout le monde
 * pareil ; ceci **interdit** à quelqu'un de précis. Les deux se cumulent et ne
 * se remplacent pas : le limiteur empêche qu'on essaie un million de fois, la
 * liste empêche qu'une personne déjà jugée revienne.
 *
 * Ce n'est pas non plus une suspension de compte. `User.suspendedAt` ferme un
 * compte ; la liste ferme une **identité de contact** — et c'est justement ce
 * qui sert quand la personne se réinscrit sous un autre nom depuis la même
 * adresse.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'EXPIRATION SE LIT, ELLE NE SE BALAIE PAS
 *
 * Chaque entrée porte une `expiresAt` facultative — six mois pour une adresse,
 * comme chez Gumroad, indéfini pour un courriel jugé frauduleux.
 *
 * `estBloque` filtre sur cette date **à la lecture**. Le ménage périodique
 * (`purgerExpirees`) ne fait que récupérer des lignes : s'il ne tourne pas
 * pendant une semaine, personne ne reste bloqué une semaine de trop.
 *
 * L'inverse — ne filtrer qu'au ménage — aurait marché tant que le ménage
 * tourne, et se serait trompé exactement le jour où il ne tourne plus. Un
 * défaut qui dépend d'un cron pour ne pas se produire est un défaut.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA NORMALISATION FAIT PARTIE DU BLOCAGE
 *
 * Bloquer `Fraude@Example.COM` puis vérifier `fraude@example.com` ne trouve
 * rien : la base compare des octets. Le blocage aurait l'air posé — il est
 * écrit, il s'affiche à l'écran d'administration — et ne bloquerait personne.
 * C'est un succès silencieux, et il ne se voit qu'en réessayant vraiment.
 *
 * Toutes les entrées passent donc par `normaliser`, à l'écriture comme à la
 * lecture, et la contrainte d'unicité de la table porte sur la valeur
 * normalisée.
 */

/** Ce qu'on sait bloquer. Écrit en base dans `BlockedObject.objectType`. */
export const TYPES_BLOQUABLES = ["IP", "EMAIL", "PHONE", "CARD", "OBJECT"] as const;

export type TypeBloquable = (typeof TYPES_BLOQUABLES)[number];

/**
 * Six mois pour une adresse.
 *
 * Durée reprise de `blocked_object.rb`. Elle n'est pas arbitraire : une adresse
 * résidentielle change de mains — bail, opérateur, réattribution DHCP — et
 * bloquer indéfiniment finit par fermer la porte à quelqu'un qui n'a rien fait.
 * Un courriel, lui, n'est jamais réattribué : il n'expire pas par défaut.
 */
export const DUREE_BLOCAGE_IP_MS = 182 * 24 * 60 * 60 * 1000;

/**
 * La forme sous laquelle une valeur est comparée.
 *
 * Les courriels et les identifiants d'objet perdent leur casse ; une adresse IP
 * garde la sienne (l'IPv6 est insensible à la casse, mais on ne la réécrit pas
 * — on n'a pas à normaliser une notation qu'on ne valide pas). Tout est
 * détouré des espaces, parce qu'un copier-coller depuis un journal en traîne.
 */
export function normaliser(type: TypeBloquable, valeur: string): string {
  const net = valeur.trim();
  return type === "EMAIL" || type === "OBJECT" ? net.toLowerCase() : net;
}

export interface Blocage {
  type: TypeBloquable;
  valeur: string;
  raison?: string | null;
  /** Durée de vie. Absente = indéfini. */
  dureeMs?: number | null;
  /** Le compte à l'origine, quand le blocage vient d'une sanction. */
  userId?: string | null;
}

/**
 * Le client Prisma à utiliser.
 *
 * Optionnel, et c'est important : `lib/domain/risque.ts` pose ses blocages
 * **dans la transaction** qui change l'état du compte. Écrire avec le client
 * global depuis l'intérieur d'une transaction ouvrirait une seconde
 * connexion — le blocage serait validé même si la suspension échouait ensuite,
 * et l'on bloquerait l'adresse de quelqu'un qu'on n'a pas suspendu.
 */
type Client = Prisma.TransactionClient | typeof db;

/**
 * Pose ou renouvelle un blocage.
 *
 * Idempotent par `(type, valeur)`. Rebloquer une adresse déjà bloquée repousse
 * son expiration et réécrit sa raison, plutôt que d'échouer sur la contrainte
 * d'unicité — c'est ce qu'on veut quand un second incident survient.
 */
export async function bloquer(
  entree: Blocage,
  client: Client = db,
): Promise<void> {
  const valeur = normaliser(entree.type, entree.valeur);
  if (!valeur) return;

  const expiresAt =
    entree.dureeMs == null ? null : new Date(Date.now() + entree.dureeMs);

  await client.blockedObject.upsert({
    where: {
      objectType_objectValue: { objectType: entree.type, objectValue: valeur },
    },
    update: {
      reason: entree.raison ?? null,
      expiresAt,
      userId: entree.userId ?? null,
    },
    create: {
      objectType: entree.type,
      objectValue: valeur,
      reason: entree.raison ?? null,
      expiresAt,
      userId: entree.userId ?? null,
    },
  });
}

/**
 * Lève tous les blocages d'adresse posés à cause d'un compte.
 *
 * Le pendant exact de ce que pose `BLOQUER_IP`. Il cherche par `userId` et non
 * par valeur, parce qu'au moment de lever, les sessions d'où venaient les
 * adresses ont été supprimées depuis longtemps — c'est `INVALIDER_SESSIONS`
 * qui s'en est chargé, et il s'exécute avant.
 *
 * Rend le nombre de lignes retirées, pour que l'appelant puisse le journaliser
 * au lieu de supposer.
 */
export async function debloquerPourCompte(
  userId: string,
  client: Client = db,
): Promise<number> {
  const { count } = await client.blockedObject.deleteMany({
    where: { userId, objectType: "IP" },
  });

  return count;
}

/** Lève un blocage. Silencieux si rien n'était posé. */
export async function debloquer(
  type: TypeBloquable,
  valeur: string,
  client: Client = db,
): Promise<void> {
  await client.blockedObject.deleteMany({
    where: { objectType: type, objectValue: normaliser(type, valeur) },
  });
}

/**
 * Cette valeur est-elle bloquée, maintenant ?
 *
 * `expiresAt: null` veut dire « indéfini », et non « expiré » — d'où le `OR`
 * plutôt qu'un simple `gt`. Écrire `expiresAt: { gt: new Date() }` seul aurait
 * ignoré tous les blocages permanents : les plus graves, précisément.
 */
export async function estBloque(
  type: TypeBloquable,
  valeur: string,
): Promise<boolean> {
  const net = normaliser(type, valeur);
  if (!net) return false;

  const trouve = await db.blockedObject.findFirst({
    where: {
      objectType: type,
      objectValue: net,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });

  return trouve !== null;
}

/**
 * Le premier blocage qui s'applique à cette tentative, s'il y en a un.
 *
 * Rend le type touché plutôt qu'un booléen : l'écran d'administration a besoin
 * de savoir **ce qui** a fermé la porte, et le journal aussi. Le message rendu
 * à la personne, lui, reste le même dans les deux cas — dire « c'est votre
 * adresse IP » apprend à l'intéressé comment contourner.
 */
export async function premierBlocage(
  candidats: Array<{ type: TypeBloquable; valeur: string }>,
): Promise<TypeBloquable | null> {
  for (const c of candidats) {
    if (await estBloque(c.type, c.valeur)) return c.type;
  }
  return null;
}

/**
 * L'adresse de l'appelant, vue depuis une action serveur.
 *
 * Même détour que `verifierLimiteAction` : une action n'a pas de `Request`, on
 * refabrique donc une enveloppe autour des en-têtes pour réutiliser
 * `adresseDe` et ses précautions sur `x-forwarded-for`.
 *
 * `null` quand rien n'est crédible — en développement, derrière un tunnel, dans
 * un test. L'appelant ne bloque alors pas sur l'adresse, seulement sur les
 * autres critères.
 */
export async function adresseCourante(): Promise<string | null> {
  const { headers } = await import("next/headers");
  const entetes = await headers();

  const factice = new Request("https://baobart.local/action", {
    headers: new Headers(Object.fromEntries(entetes.entries())),
  });

  return adresseDe(factice);
}

/**
 * Récupère les lignes dont la date est passée.
 *
 * Appelé par l'ordonnanceur. Ne change **rien** au comportement — voir
 * l'en-tête : l'expiration est déjà appliquée à la lecture. Ce ménage évite
 * seulement qu'une table de blocage grossisse indéfiniment.
 */
export async function purgerExpirees(): Promise<number> {
  const { count } = await db.blockedObject.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return count;
}

/** Ce que l'écran d'administration affiche. */
export interface LigneBlocage {
  id: string;
  type: TypeBloquable;
  valeur: string;
  raison: string | null;
  expireLe: Date | null;
  poseeLe: Date;
  /** Le compte dont la suspension a posé ce blocage, s'il y en a un. */
  userId: string | null;
  /** Vraie quand la ligne existe encore mais ne bloque plus personne. */
  expiree: boolean;
}

/**
 * La liste, la plus récente d'abord.
 *
 * Les lignes expirées sont **montrées**, marquées comme telles, et non
 * cachées : une entrée qui a cessé d'agir explique pourquoi quelqu'un est
 * repassé, et la faire disparaître de l'écran ferait chercher ailleurs.
 */
export async function listerBlocages(limite = 200): Promise<LigneBlocage[]> {
  const lignes = await db.blockedObject.findMany({
    orderBy: { createdAt: "desc" },
    take: limite,
  });

  const maintenant = Date.now();

  return lignes.map((l) => ({
    id: l.id,
    type: l.objectType as TypeBloquable,
    valeur: l.objectValue,
    raison: l.reason,
    expireLe: l.expiresAt,
    poseeLe: l.createdAt,
    userId: l.userId,
    expiree: l.expiresAt !== null && l.expiresAt.getTime() <= maintenant,
  }));
}
