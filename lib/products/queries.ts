import "server-only";

import { db } from "@/lib/db";
import { LIBELLE_PAR_FAMILLE, type Filtre } from "@/lib/feed/types";
import type { Currency } from "@/lib/i18n/money";

/** Tout ce qu'affiche la fiche d'une ressource. */
export interface FicheProduit {
  id: string;
  slug: string;
  titre: string;
  description: string | null;
  famille: Filtre | null;
  prix: number;
  devise: Currency;
  coverUrl: string | null;
  telechargements: number;
  publieLe: Date;
  auteur: {
    nom: string;
    username: string | null;
    role: string;
    verifie: boolean;
  };
  /** Détails techniques : format, dimensions, poids du plus gros fichier. */
  fichier: {
    format: string;
    dimensions: string | null;
    poids: number;
  } | null;
  /** Autres ressources du même créateur, pour la bande de vignettes. */
  duMemeCreateur: Array<{ slug: string; titre: string; coverUrl: string | null }>;
}

function formatDeContenu(contentType: string, filename: string): string {
  const extension = filename.split(".").pop();
  if (extension && extension.length <= 5) return extension.toUpperCase();
  return contentType.split("/").pop()?.toUpperCase() ?? "FICHIER";
}

export async function obtenirProduit(slug: string): Promise<FicheProduit | null> {
  const p = await db.product.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      family: true,
      price: true,
      currency: true,
      coverUrl: true,
      downloadsCount: true,
      createdAt: true,
      status: true,
      sellerId: true,
      seller: {
        select: {
          profile: {
            select: {
              displayName: true,
              username: true,
              city: true,
              isVerified: true,
            },
          },
        },
      },
      files: {
        orderBy: { sizeBytes: "desc" },
        take: 1,
        select: {
          filename: true,
          sizeBytes: true,
          media: { select: { contentType: true, width: true, height: true } },
        },
      },
    },
  });

  // Une ressource non publiée n'a pas de fiche publique : on répond comme si
  // elle n'existait pas, plutôt que de révéler qu'un brouillon porte ce slug.
  if (!p || p.status !== "PUBLISHED") return null;

  const autres = await db.product.findMany({
    where: {
      sellerId: p.sellerId,
      status: "PUBLISHED",
      NOT: { id: p.id },
    },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { slug: true, name: true, coverUrl: true },
  });

  const fichier = p.files[0];

  return {
    id: p.id,
    slug: p.slug,
    titre: p.name,
    description: p.description,
    famille: p.family ? LIBELLE_PAR_FAMILLE[p.family] : null,
    prix: p.price,
    devise: p.currency,
    coverUrl: p.coverUrl,
    telechargements: p.downloadsCount,
    publieLe: p.createdAt,
    auteur: {
      nom: p.seller.profile?.displayName ?? "Créateur Baobart",
      username: p.seller.profile?.username ?? null,
      role: p.seller.profile?.city ?? "Afrique",
      verifie: p.seller.profile?.isVerified ?? false,
    },
    fichier: fichier
      ? {
          format: formatDeContenu(fichier.media.contentType, fichier.filename),
          dimensions:
            fichier.media.width && fichier.media.height
              ? `${fichier.media.width} × ${fichier.media.height}`
              : null,
          poids: fichier.sizeBytes,
        }
      : null,
    duMemeCreateur: autres.map((a) => ({
      slug: a.slug,
      titre: a.name,
      coverUrl: a.coverUrl,
    })),
  };
}

/** Slugs publiés — pour la génération statique éventuelle et les tests. */
export async function listerSlugsPublies(limit = 500) {
  const lignes = await db.product.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { slug: true },
  });
  return lignes.map((l) => l.slug);
}
