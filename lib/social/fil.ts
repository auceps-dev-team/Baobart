import "server-only";

import { estOfferte, libelleDuPrix } from "@/lib/commerce/montant";
import { debutDuMois } from "@/lib/dashboard/mois";
import { pageDemandee } from "@/lib/dashboard/pagination";
import { db } from "@/lib/db";
import { LIBELLE_PAR_FAMILLE } from "@/lib/feed/types";
import {
  avancerVuJusquA,
  debutDeSemaine,
  etatDansLeFil,
  presenterAbonne,
  type AbonneVu,
  type EtatDansLeFil,
} from "@/lib/social/regles";

/**
 * « Suivre les détails » (lot 5b, maquette `c_suivre`) : ce que publient les
 * créateurs qu'on suit, les trois compteurs, et les personnes des deux côtés.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI ENTRE DANS LE FIL
 *
 * Une ressource en ligne (`PUBLISHED`), datée de sa première publication
 * (`firstPublishedAt`, posée par le déclencheur de la migration
 * `20261124100000_premiere_publication`), d'un créateur qu'on suit et qui
 * n'est pas suspendu — une vitrine suspendue n'existe pas pour le public
 * (`profilPublic`), ses ressources non plus. Les plus récentes d'abord, sur
 * un ordre total (la date, puis l'identifiant), paginées en base comme la
 * liste des abonnés (`abonnesDe`).
 */
function deSesSuivis(userId: string) {
  return {
    status: "PUBLISHED" as const,
    firstPublishedAt: { not: null },
    seller: { suspendedAt: null, followers: { some: { followerId: userId } } },
  };
}

export interface PublicationSuivie {
  produitId: string;
  slug: string;
  titre: string;
  auteur: string;
  /** « Vidéo », « Pack »… ; nul pour une ressource sans famille. */
  famille: string | null;
  /** « gratuit », comme la maquette, ou le prix tel qu'il s'affiche ailleurs. */
  prix: string;
  coverUrl: string | null;
  publieeLe: Date;
  etat: EtatDansLeFil;
}

export interface PageDuFil {
  total: number;
  page: number;
  pages: number;
  publications: PublicationSuivie[];
}

export async function filDesSuivis(
  userId: string,
  brutPage: string | undefined,
  parPage: number,
  vuJusquA: Date | null,
): Promise<PageDuFil> {
  if (!Number.isInteger(parPage) || parPage < 1) throw new Error(`filDesSuivis : taille de page invalide (${parPage})`);

  const where = deSesSuivis(userId);
  const total = await db.product.count({ where });
  const pages = Math.max(1, Math.ceil(total / parPage));
  const page = pageDemandee(brutPage, pages);

  const lignes = await db.product.findMany({
    where,
    orderBy: [{ firstPublishedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * parPage,
    take: parPage,
    select: {
      id: true,
      slug: true,
      name: true,
      family: true,
      price: true,
      pricingMode: true,
      minPrice: true,
      currency: true,
      coverUrl: true,
      firstPublishedAt: true,
      seller: { select: { profile: { select: { displayName: true, username: true } } } },
    },
  });

  return {
    total,
    page,
    pages,
    publications: lignes.map((p) => {
      // Le filtre exige la date : elle est là. Le repli ne sert qu'au typage.
      const publieeLe = p.firstPublishedAt ?? new Date(0);
      return {
        produitId: p.id,
        slug: p.slug,
        titre: p.name,
        auteur: p.seller.profile?.displayName?.trim() || p.seller.profile?.username || "Créateur Baobart",
        famille: p.family ? LIBELLE_PAR_FAMILLE[p.family] : null,
        prix: estOfferte(p) ? "gratuit" : libelleDuPrix(p),
        coverUrl: p.coverUrl,
        publieeLe,
        etat: etatDansLeFil(publieeLe, vuJusquA),
      };
    }),
  };
}

export interface CompteursDuFil {
  abonnes: number;
  abonnesCeMois: number;
  abonnements: number;
  publicationsCetteSemaine: number;
}

/**
 * Les trois cartes de la maquette : « Abonnés · +132 ce mois »,
 * « Abonnements · créateurs suivis », « Publications suivies · cette semaine ».
 *
 * Comptés à la source, comme la liste des abonnés : « ce mois » se calcule
 * comme sur l'écran Statistiques (`debutDuMois`, UTC), « cette semaine »
 * depuis le lundi 0 h (`debutDeSemaine`). Les publications de la semaine
 * suivent la même règle que le fil : la carte et la liste ne se contredisent
 * pas.
 */
export async function compteursDuFil(userId: string, maintenant: Date = new Date()): Promise<CompteursDuFil> {
  const [abonnes, abonnesCeMois, abonnements, publicationsCetteSemaine] = await Promise.all([
    db.follow.count({ where: { followingId: userId } }),
    db.follow.count({ where: { followingId: userId, createdAt: { gte: debutDuMois(maintenant) } } }),
    db.follow.count({ where: { followerId: userId } }),
    db.product.count({ where: { ...deSesSuivis(userId), firstPublishedAt: { gte: debutDeSemaine(maintenant) } } }),
  ]);
  return { abonnes, abonnesCeMois, abonnements, publicationsCetteSemaine };
}

/**
 * Les créateurs suivis le plus récemment — les cartes « Suivi ✓ » de la
 * maquette. Présentés par la même règle que les abonnés (`presenterAbonne`) :
 * de leur vitrine, rien de plus que ce qu'elle montre déjà.
 */
export async function suivisRecents(userId: string, combien: number): Promise<AbonneVu[]> {
  const lignes = await db.follow.findMany({
    where: { followerId: userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: combien,
    select: {
      createdAt: true,
      following: {
        select: {
          id: true,
          suspendedAt: true,
          profile: {
            select: { displayName: true, username: true, speciality: true, city: true, avatarUrl: true, acceptsMessages: true },
          },
          _count: { select: { products: { where: { status: "PUBLISHED" } } } },
        },
      },
    },
  });
  return lignes.map((l) =>
    presenterAbonne({
      userId: l.following.id,
      suitDepuis: l.createdAt,
      suspendu: l.following.suspendedAt !== null,
      ressourcesPubliees: l.following._count.products,
      profil: l.following.profile,
    }),
  );
}

/** Jusqu'où le fil a été vu — lu AVANT de le marquer, pour dire ce qui est nouveau. */
export async function filVuJusquA(userId: string): Promise<Date | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { followFeedSeenAt: true } });
  return u?.followFeedSeenAt ?? null;
}

/**
 * Marque le fil vu jusqu'à `propose` — l'instant où la page a été rendue,
 * renvoyé par le navigateur une fois la page affichée.
 *
 * Pas pendant le rendu : une page qui écrit en se dessinant se dément au
 * premier rafraîchissement, et un préchargement compterait comme une visite.
 * L'écriture est conditionnelle : deux onglets qui répondent ensemble ne font
 * jamais reculer la marque (`avancerVuJusquA` décide, la condition SQL tient
 * la course).
 */
export async function marquerFilVu(userId: string, propose: Date, maintenant: Date = new Date()): Promise<boolean> {
  const borne = avancerVuJusquA(propose, await filVuJusquA(userId), maintenant);
  if (borne === null) return false;
  const { count } = await db.user.updateMany({
    where: { id: userId, OR: [{ followFeedSeenAt: null }, { followFeedSeenAt: { lt: borne } }] },
    data: { followFeedSeenAt: borne },
  });
  return count > 0;
}
