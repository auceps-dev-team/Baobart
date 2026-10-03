import "server-only";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { pubMenantA } from "@/lib/publicites/attribution";
import { ECART_PAR_DEFAUT, lienExterieur, type PubValide } from "@/lib/publicites/regles";
import { AUCUNE_DIFFUSION, type Diffusion } from "@/lib/publicites/types";
import { PREFIXE_PUBLIC, urlPublique } from "@/lib/upload/storage";

/**
 * Les publicités, côté base.
 *
 * Les règles vivent ailleurs, dans des modules purs : où tombe une bannière
 * (`placement`), ce qu'une saisie doit être (`regles`), à qui revient une vente
 * (`attribution`). Ici, seulement lire et écrire.
 */

/** Le dossier du stockage où vont les médias des bannières. */
export const DOSSIER_MEDIAS = `${PREFIXE_PUBLIC}pubs/`;

/** L'adresse publique de ce dossier : tout média de bannière doit en venir. */
export function racineMedias(): string {
  return urlPublique(DOSSIER_MEDIAS);
}

export interface Reglages {
  actives: boolean;
  ecartMinimal: number;
}

/** La ligne n'existe qu'une fois réglée : avant, ce sont les défauts du schéma. */
export async function reglages(): Promise<Reglages> {
  const r = await db.adSettings.findUnique({ where: { id: "global" } });
  return { actives: r?.enabled ?? true, ecartMinimal: r?.minGap ?? ECART_PAR_DEFAUT };
}

export async function regler(r: Reglages): Promise<void> {
  await db.adSettings.upsert({
    where: { id: "global" },
    create: { id: "global", enabled: r.actives, minGap: r.ecartMinimal },
    update: { enabled: r.actives, minGap: r.ecartMinimal },
  });
}

/**
 * Ce que la mosaïque affiche maintenant.
 *
 * Triées par ancienneté, pas tirées au sort comme dans le plugin : un tirage
 * changerait les bannières à chaque « charger plus », et la page qu'on relit
 * ne serait plus celle qu'on a vue. L'alternance entre pubs du même rang se
 * fait dans `placerLesPublicites`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE PANNE ICI NE FERME PAS L'ACCUEIL
 *
 * Les bannières sont un supplément. Si leur lecture échoue — table absente
 * d'un environnement qu'on a oublié de migrer, base qui hoquette —, la
 * mosaïque s'affiche sans elles et l'erreur part au journal. L'inverse
 * transformerait un incident publicitaire en page d'accueil blanche.
 */
export async function diffusion(maintenant = new Date()): Promise<Diffusion> {
  try {
    const r = await reglages();
    if (!r.actives) return AUCUNE_DIFFUSION;

    const pubs = await db.ad.findMany({
      where: {
        pausedAt: null,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: maintenant } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: maintenant } }] },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        mediaKind: true,
        imageUrl: true,
        imageWidth: true,
        imageHeight: true,
        videoUrl: true,
        linkUrl: true,
        frequency: true,
      },
    });

    return {
      ecartMinimal: r.ecartMinimal,
      pubs: pubs.map((p) => ({
        id: p.id,
        titre: p.title,
        nature: p.mediaKind === "VIDEO" && p.videoUrl ? "VIDEO" : "IMAGE",
        imageUrl: p.imageUrl,
        largeur: p.imageWidth,
        hauteur: p.imageHeight,
        videoUrl: p.mediaKind === "VIDEO" ? p.videoUrl : null,
        exterieure: lienExterieur(p.linkUrl),
        frequence: p.frequency,
      })),
    };
  } catch (cause) {
    journal.erreur("publicités non lues, mosaïque servie sans elles", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return AUCUNE_DIFFUSION;
  }
}

/** Le jour d'Abidjan — GMT, donc celui de l'horloge UTC. */
export function jourDe(quand: Date): string {
  return quand.toISOString().slice(0, 10);
}

/**
 * Ajoute des affichages au compteur du jour.
 *
 * Une seule requête, quel que soit le nombre de bannières : la jointure sur
 * `Ad` écarte d'elle-même les identifiants inventés, sans les lire d'abord.
 * `ON CONFLICT` fait l'addition dans la base — deux envois simultanés ne
 * peuvent pas lire la même valeur et écrire chacun « +1 » par-dessus l'autre.
 */
export async function enregistrerVues(ids: readonly string[], quand = new Date()): Promise<void> {
  const parId = new Map<string, number>();
  for (const id of ids) parId.set(id, (parId.get(id) ?? 0) + 1);
  if (parId.size === 0) return;

  const cles = [...parId.keys()];
  const nombres = cles.map((id) => parId.get(id)!);

  await db.$executeRaw`
    INSERT INTO "AdDailyStat" ("adId", "day", "views", "clicks")
    SELECT a."id", ${jourDe(quand)}::date, v.n, 0
    FROM "Ad" a
    JOIN (SELECT unnest(${cles}::text[]) AS id, unnest(${nombres}::int[]) AS n) v ON v.id = a."id"
    ON CONFLICT ("adId", "day") DO UPDATE SET "views" = "AdDailyStat"."views" + EXCLUDED."views"`;
}

/** Le lien d'une pub, sans rien compter. `null` si elle n'existe pas. */
export async function lienDe(id: string): Promise<string | null> {
  const pub = await db.ad.findUnique({ where: { id }, select: { linkUrl: true } });
  return pub?.linkUrl ?? null;
}

/** Compte un clic et rend le lien à suivre. `null` si la pub n'existe pas. */
export async function enregistrerClic(id: string, quand = new Date()): Promise<string | null> {
  const pub = await db.ad.findUnique({ where: { id }, select: { linkUrl: true } });
  if (!pub) return null;

  await db.$executeRaw`
    INSERT INTO "AdDailyStat" ("adId", "day", "views", "clicks")
    VALUES (${id}, ${jourDe(quand)}::date, 0, 1)
    ON CONFLICT ("adId", "day") DO UPDATE SET "clicks" = "AdDailyStat"."clicks" + 1`;

  return pub.linkUrl;
}

/**
 * La bannière à qui revient l'achat de `slug`, parmi les clics retenus.
 * Relue en base : un identifiant du cookie n'est qu'une indication.
 */
export async function attribuer(slug: string, clics: readonly string[]): Promise<string | null> {
  if (clics.length === 0) return null;
  const pubs = await db.ad.findMany({
    where: { id: { in: [...clics] } },
    select: { id: true, linkUrl: true },
  });
  return pubMenantA(slug, clics, pubs);
}

export interface LignePub {
  id: string;
  titre: string;
  nature: "IMAGE" | "VIDEO";
  imageUrl: string;
  lien: string;
  frequence: number;
  debut: Date | null;
  fin: Date | null;
  enPauseDepuis: Date | null;
  vues: number;
  clics: number;
  ventes: number;
  /** Seule une pub qui mène à une fiche produit peut se voir attribuer une vente. */
  peutVendre: boolean;
}

export async function listerPourAdministration(): Promise<LignePub[]> {
  const [pubs, stats, ventes] = await Promise.all([
    db.ad.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        mediaKind: true,
        imageUrl: true,
        linkUrl: true,
        frequency: true,
        startsAt: true,
        endsAt: true,
        pausedAt: true,
      },
    }),
    db.adDailyStat.groupBy({ by: ["adId"], _sum: { views: true, clicks: true } }),
    // Les ventes abouties seulement : une commande ouverte puis abandonnée au
    // moment de taper le code mobile money n'est pas une vente.
    db.order.groupBy({
      by: ["adId"],
      where: { adId: { not: null }, status: "COMPLETED" },
      _count: { _all: true },
    }),
  ]);

  const parStat = new Map(stats.map((s) => [s.adId, s._sum]));
  const parVente = new Map(ventes.map((v) => [v.adId, v._count._all]));

  return pubs.map((p) => ({
    id: p.id,
    titre: p.title,
    nature: p.mediaKind,
    imageUrl: p.imageUrl,
    lien: p.linkUrl,
    frequence: p.frequency,
    debut: p.startsAt,
    fin: p.endsAt,
    enPauseDepuis: p.pausedAt,
    vues: parStat.get(p.id)?.views ?? 0,
    clics: parStat.get(p.id)?.clicks ?? 0,
    ventes: parVente.get(p.id) ?? 0,
    peutVendre: p.linkUrl.startsWith("/products/"),
  }));
}

export async function pubAEditer(id: string) {
  return db.ad.findUnique({ where: { id } });
}

export async function creer(acteurId: string, pub: PubValide): Promise<string> {
  const cree = await db.ad.create({ data: { ...pub, createdById: acteurId }, select: { id: true } });
  return cree.id;
}

/** `false` si la pub n'existe plus. */
export async function modifier(id: string, pub: PubValide): Promise<boolean> {
  const n = await db.ad.updateMany({ where: { id }, data: pub });
  return n.count > 0;
}

export async function mettreEnPause(id: string, enPause: boolean): Promise<boolean> {
  const n = await db.ad.updateMany({
    where: { id },
    data: { pausedAt: enPause ? new Date() : null },
  });
  return n.count > 0;
}

/**
 * Efface la pub et ses compteurs. Les ventes restent, détachées : une vente a
 * eu lieu, qu'on garde ou non la campagne qui l'a amenée.
 */
export async function supprimer(id: string): Promise<boolean> {
  const n = await db.ad.deleteMany({ where: { id } });
  return n.count > 0;
}
