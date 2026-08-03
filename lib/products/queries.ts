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
  /** Extrait jouable avant achat, quand une image ne suffit pas à juger. */
  extrait: { url: string; nature: "audio" | "video" } | null;
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

/** Ce que le bouton doit proposer à la personne qui regarde la fiche. */
export type DroitTelechargement =
  | { etat: "TELECHARGEABLE"; fichiers: Array<{ id: string; nom: string }> }
  | { etat: "A_ACHETER" }
  | { etat: "A_CONNECTER" };

/**
 * Le visiteur peut-il retirer cette ressource ?
 *
 * Question posée à l'affichage, pour ne pas montrer un bouton qui refusera au
 * clic. La route de téléchargement reprend la décision de zéro : ce qu'on
 * calcule ici sert l'écran, jamais l'autorisation.
 */
export async function droitDeTelecharger(
  produitId: string,
  userId: string | null,
): Promise<DroitTelechargement> {
  const produit = await db.product.findUnique({
    where: { id: produitId },
    select: {
      price: true,
      files: {
        where: { role: "SOURCE" },
        orderBy: { position: "asc" },
        select: { id: true, filename: true },
      },
    },
  });

  if (!produit || produit.files.length === 0) return { etat: "A_ACHETER" };

  const fichiers = produit.files.map((f) => ({ id: f.id, nom: f.filename }));

  // Une ressource offerte se retire dès qu'on est connecté : demander de
  // « l'acheter » à 0 F n'aurait aucun sens.
  if (produit.price === 0) {
    return userId
      ? { etat: "TELECHARGEABLE", fichiers }
      : { etat: "A_CONNECTER" };
  }

  if (!userId) return { etat: "A_ACHETER" };

  const achat = await db.orderItem.findFirst({
    where: {
      productId: produitId,
      state: { in: ["SUCCESSFUL", "NOT_CHARGED"] },
      order: { buyerId: userId },
    },
    select: { id: true, price: true, quantity: true, refundedAmount: true },
    orderBy: { createdAt: "desc" },
  });

  if (!achat) return { etat: "A_ACHETER" };

  // Un remboursement intégral retire le droit ; un remboursement partiel non.
  const totalPaye = achat.price * achat.quantity;
  if (totalPaye > 0 && achat.refundedAmount >= totalPaye) {
    return { etat: "A_ACHETER" };
  }

  return { etat: "TELECHARGEABLE", fichiers };
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
      previewUrl: true,
      previewKind: true,
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
        // Le format et les dimensions annoncés décrivent ce que l'acheteur
        // reçoit : l'aperçu n'a rien à y faire.
        where: { role: "SOURCE" },
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
    extrait:
      p.previewUrl && p.previewKind
        ? { url: p.previewUrl, nature: p.previewKind as "audio" | "video" }
        : null,
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
