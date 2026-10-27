import "server-only";

import { db } from "@/lib/db";
import type { ProductFamily } from "@/lib/domain/prisma-types";
import {
  RESEAUX,
  adresseAffichable,
  depuisBase,
  identifiant,
  type Reseau,
} from "@/lib/reseaux/reseaux";

/**
 * Le profil public d'un créateur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL RÉPARE UN LIEN MORT
 *
 * On pouvait déjà suivre quelqu'un — le bouton existe sur chaque fiche — sans
 * pouvoir visiter sa page. L'écran « Abonnements » du tableau de bord renvoyait
 * vers l'explorateur faute de mieux, et le portait dans un commentaire : *« le
 * profil public d'un créateur reste à faire »*.
 *
 * Suivre quelqu'un qu'on ne peut pas aller voir n'est pas une fonctionnalité à
 * moitié faite : c'est une promesse qui n'aboutit nulle part.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE LA MAQUETTE DESSINE ET QUI N'EST PAS ICI
 *
 * `Baobart Accueil.dc.html` dessine cinq indicateurs : produits, ventes à vie,
 * vues de page, abonnés, abonnements. Elle affiche aussi *« répond en moyenne
 * en 4 h »*.
 *
 * Les **vues de page** sont comptées depuis v1.96.0 (16/10) — un visiteur, un
 * profil, un jour, voir `lib/createurs/vues.ts`. Jusque-là elles étaient
 * absentes, pour la raison qui vaut encore pour le reste : un chiffre inventé
 * sur un profil public est un mensonge que l'acheteur prend pour une mesure.
 *
 * **Abonnements** et **délai de réponse** ont été écartés le 02/09
 * (`Doc/MAQUETTES_A_FAIRE.md` §F) : le premier renseigne sur la personne plutôt
 * que sur son travail, le second est coûteux à rendre honnête.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES COMPTEURS SONT DÉNORMALISÉS, ET ON LES RELIT QUAND MÊME
 *
 * `Profile` porte `workCount` et `followerCount`. On préfère ici compter les
 * ressources **publiées** : `workCount` compte les créations, brouillons
 * compris, et afficher « 57 produits » sur une page qui en montre trois ferait
 * douter de tout le reste.
 */

export interface ProfilPublic {
  userId: string;
  username: string;
  nom: string;
  bio: string | null;
  specialite: string | null;
  ville: string | null;
  pays: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  verifie: boolean;
  membreDepuis: Date;

  /**
   * Les liens que le créateur a bien voulu donner. Le portfolio n'est rendu
   * qu'en `https://` : une valeur sans protocole (`awadiallo.com`, dans les
   * données de démonstration) deviendrait un lien relatif vers
   * `/createurs/awadiallo.com` — une page qui n'existe pas.
   */
  portfolioUrl: string | null;
  /** Ses réseaux, dans l'ordre de la maquette, chacun vérifié sur son domaine. */
  liens: Array<{ reseau: Reseau; url: string; identifiant: string }>;
  /** « Oui, sous 2 semaines » — un texte, pas un booléen. */
  ouvertAuxCommandes: string | null;
  /** Le bouton « Contact » est-il ouvert ? Le créateur le ferme depuis son profil. */
  ouvertAuxMessages: boolean;
  /** Tarif journalier indicatif, en unités mineures. */
  tarifJournalier: number | null;

  note: number;
  nombreDAvis: number;

  /** Les indicateurs qu'on sait vraiment compter. */
  ressourcesPubliees: number;
  ventes: number;
  abonnes: number;
  /** Depuis v1.96.0 : un visiteur, un profil, un jour (`lib/createurs/vues.ts`). */
  vues: number;
  /** L'identifiant du profil, que vise le signal de vue. */
  profilId: string;
}

/**
 * Le profil d'un créateur, par son nom d'utilisateur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TOUT LE MONDE N'A PAS DE PAGE
 *
 * Un compte qui n'a rien publié n'a pas de vitrine : `lib/auth/roles.ts` pose
 * qu'on devient créateur en publiant. Rendre `null` pour un acheteur n'est pas
 * une restriction, c'est la vérité — il n'y a rien à montrer, et une page vide
 * au nom de quelqu'un lui ferait du tort.
 *
 * Un compte suspendu n'a pas de page non plus. Laisser sa vitrine debout
 * pendant qu'on enquête reviendrait à continuer de le recommander.
 */
export async function profilPublic(
  username: string,
): Promise<ProfilPublic | null> {
  const profil = await db.profile.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      userId: true,
      username: true,
      displayName: true,
      bio: true,
      viewCount: true,
      speciality: true,
      city: true,
      country: true,
      avatarUrl: true,
      bannerUrl: true,
      isVerified: true,
      ratingAvg: true,
      ratingCount: true,
      followerCount: true,
      portfolioUrl: true,
      links: { select: { network: true, url: true } },
      openToCommissions: true,
      acceptsMessages: true,
      dailyRate: true,
      createdAt: true,
      user: { select: { suspendedAt: true } },
    },
  });

  if (!profil || profil.user.suspendedAt !== null) return null;

  const produits = await db.product.findMany({
    where: { sellerId: profil.userId, status: "PUBLISHED" },
    select: { salesCount: true },
  });

  // Rien de publié, pas de vitrine.
  if (produits.length === 0) return null;

  return {
    userId: profil.userId,
    username: profil.username,
    nom: profil.displayName,
    bio: profil.bio,
    specialite: profil.speciality,
    ville: profil.city,
    pays: profil.country,
    avatarUrl: profil.avatarUrl,
    bannerUrl: profil.bannerUrl,
    verifie: profil.isVerified,
    membreDepuis: profil.createdAt,
    portfolioUrl: profil.portfolioUrl?.startsWith("https://") ? profil.portfolioUrl : null,
    liens: liensAffichables(profil.links),
    ouvertAuxCommandes: profil.openToCommissions,
    ouvertAuxMessages: profil.acceptsMessages,
    tarifJournalier: profil.dailyRate,
    note: Number(profil.ratingAvg),
    nombreDAvis: profil.ratingCount,
    ressourcesPubliees: produits.length,
    ventes: produits.reduce((total, p) => total + p.salesCount, 0),
    abonnes: profil.followerCount,
    vues: profil.viewCount,
    profilId: profil.id,
  };
}

/**
 * Les réseaux rangés, remis dans l'ordre de la maquette. Une adresse qui ne
 * mène plus sur son réseau est écartée ici, avant l'écran : c'est l'affichage
 * qui pose le logo dessus.
 */
function liensAffichables(
  lignes: Array<{ network: string; url: string }>,
): ProfilPublic["liens"] {
  const liens: ProfilPublic["liens"] = [];
  for (const reseau of RESEAUX) {
    const ligne = lignes.find((l) => depuisBase(l.network) === reseau);
    const url = ligne ? adresseAffichable(reseau, ligne.url) : null;
    if (url) liens.push({ reseau, url, identifiant: identifiant(reseau, url) });
  }
  return liens;
}

export interface CreateurEnVitrine {
  /** L'identifiant du compte : c'est lui que « Suivre » vise. */
  id: string;
  username: string;
  nom: string;
  specialite: string | null;
  ville: string | null;
  avatarUrl: string | null;
  verifie: boolean;
  ressourcesPubliees: number;
  abonnes: number;
  /**
   * Ses dernières ressources publiées, cinq au plus — la bande de vignettes de
   * la maquette (`PAGE CREATEURS`, `c.work`). Filtrées par famille quand
   * l'annuaire l'est : on montre ce qui a fait entrer le créateur dans la
   * liste.
   */
  travaux: Array<{ slug: string; titre: string; couverture: string | null }>;
}

/** Combien de vignettes par créateur, comme la maquette. */
const TRAVAUX_PAR_CREATEUR = 5;

/**
 * L'annuaire des créateurs.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ON N'Y ENTRE QU'EN AYANT PUBLIÉ
 *
 * La requête part des **produits**, pas des profils : un annuaire construit sur
 * `Profile` listerait tous les comptes, acheteurs compris, et la page
 * ressemblerait à un annuaire d'inscrits plutôt qu'à une vitrine.
 *
 * Le tri est par nombre d'abonnés puis par nom. Trier par ventes mettrait en
 * avant ceux qui vendent cher plutôt que ceux qu'on suit — et ferait de la page
 * un classement commercial.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PAR FAMILLE (09/10)
 *
 * La maquette pose au-dessus de la liste des étiquettes « Populaire » qui
 * mènent à une recherche par mot-clé. Explorer ne sait chercher que par
 * famille (`/explore?filtre=`) : ces étiquettes auraient mené à une page qui
 * ne filtre pas. Le filtre de l'annuaire porte donc sur la famille — « qui
 * publie des polices ? » —, et `ressourcesPubliees` reste le total du
 * créateur, toutes familles confondues.
 */
export async function listerCreateurs({
  limite = 60,
  famille,
}: { limite?: number; famille?: ProductFamily } = {}): Promise<CreateurEnVitrine[]> {
  const groupes = await db.product.groupBy({
    by: ["sellerId"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });

  if (groupes.length === 0) return [];

  const parVendeur = new Map(groupes.map((g) => [g.sellerId, g._count._all]));

  // Ceux qui publient dans la famille demandée, quand il y en a une.
  const retenus = famille
    ? (
        await db.product.groupBy({
          by: ["sellerId"],
          where: { status: "PUBLISHED", family: famille },
        })
      ).map((g) => g.sellerId)
    : [...parVendeur.keys()];

  if (retenus.length === 0) return [];

  const profils = await db.profile.findMany({
    where: {
      userId: { in: retenus },
      user: { suspendedAt: null },
    },
    orderBy: [{ followerCount: "desc" }, { displayName: "asc" }],
    take: limite,
    select: {
      userId: true,
      username: true,
      displayName: true,
      speciality: true,
      city: true,
      avatarUrl: true,
      isVerified: true,
      followerCount: true,
    },
  });

  // Les vignettes : une seule requête pour tout l'annuaire, la plus récente
  // d'abord, puis cinq par créateur. Prisma ne sait pas limiter « par
  // groupe » ; le plafond borne ce qu'on lit si un créateur publiait
  // beaucoup — au pire, un créateur prolifique prive les autres de quelques
  // vignettes, il n'en invente aucune.
  const ids = profils.map((p) => p.userId);
  const recents = await db.product.findMany({
    where: {
      sellerId: { in: ids },
      status: "PUBLISHED",
      ...(famille ? { family: famille } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: ids.length * TRAVAUX_PAR_CREATEUR * 4,
    select: { sellerId: true, slug: true, name: true, coverUrl: true },
  });
  const travaux = new Map<string, CreateurEnVitrine["travaux"]>();
  for (const r of recents) {
    const liste = travaux.get(r.sellerId) ?? [];
    if (liste.length < TRAVAUX_PAR_CREATEUR) {
      liste.push({ slug: r.slug, titre: r.name, couverture: r.coverUrl });
      travaux.set(r.sellerId, liste);
    }
  }

  return profils.map((p) => ({
    id: p.userId,
    username: p.username,
    nom: p.displayName,
    specialite: p.speciality,
    ville: p.city,
    avatarUrl: p.avatarUrl,
    verifie: p.isVerified,
    ressourcesPubliees: parVendeur.get(p.userId) ?? 0,
    abonnes: p.followerCount,
    travaux: travaux.get(p.userId) ?? [],
  }));
}

/**
 * Les familles où publie au moins un créateur visible — la barre de filtres
 * de l'annuaire. Une famille sans personne n'y figure pas : elle mènerait à
 * une liste vide.
 */
export async function famillesDesCreateurs(): Promise<ProductFamily[]> {
  const groupes = await db.product.groupBy({
    by: ["family"],
    where: { status: "PUBLISHED", family: { not: null }, seller: { suspendedAt: null } },
  });
  return groupes.map((g) => g.family).filter((f): f is ProductFamily => f !== null);
}

/**
 * Parmi ces créateurs, ceux que le visiteur suit — en une requête pour tout
 * l'annuaire, là où `suitCeCreateur` en ferait une par carte.
 */
export async function suivisParmi(
  visiteurId: string | null,
  createurIds: string[],
): Promise<Set<string>> {
  if (!visiteurId || createurIds.length === 0) return new Set();
  const lignes = await db.follow.findMany({
    where: { followerId: visiteurId, followingId: { in: createurIds } },
    select: { followingId: true },
  });
  return new Set(lignes.map((l) => l.followingId));
}

/**
 * Ce visiteur suit-il ce créateur ?
 *
 * `etatSocial` répond à la même question mais réclame un produit : elle est
 * écrite pour une fiche. L'appeler ici obligerait à lui donner un identifiant
 * de ressource au hasard, et à charger des compteurs dont la page n'a que faire.
 */
export async function suitCeCreateur(
  visiteurId: string | null,
  createurId: string,
): Promise<boolean> {
  if (!visiteurId || visiteurId === createurId) return false;

  const suivi = await db.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: visiteurId,
        followingId: createurId,
      },
    },
    select: { id: true },
  });

  return suivi !== null;
}

export interface CollectionEnVitrine {
  id: string;
  titre: string;
  description: string | null;
  /** Les ressources publiées qu'elle range — pas les brouillons ni les retirées. */
  ressources: number;
  couvertures: string[];
}

/**
 * Les collections publiques d'un créateur — onglet « Collections ».
 *
 * `Doc/MAQUETTES_A_FAIRE.md` §F.3 notait le 02/09 que « Collections publiques
 * n'existe pas ». Elles existent depuis v1.74.0 (`Board.isPublic`). Une
 * collection partagée avec une communauté seulement n'y figure pas : son
 * propriétaire l'a ouverte à ce cercle, pas au public.
 */
export async function collectionsPubliquesDe(
  createurId: string,
  limite = 12,
): Promise<CollectionEnVitrine[]> {
  const publiees = { product: { status: "PUBLISHED" as const } };
  const lignes = await db.board.findMany({
    where: { ownerId: createurId, isPublic: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limite,
    select: {
      id: true,
      title: true,
      description: true,
      _count: { select: { saves: { where: publiees } } },
      saves: {
        where: publiees,
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { product: { select: { coverUrl: true } } },
      },
    },
  });

  // Une collection vide ne montre rien à personne.
  return lignes
    .filter((b) => b._count.saves > 0)
    .map((b) => ({
      id: b.id,
      titre: b.title,
      description: b.description,
      ressources: b._count.saves,
      couvertures: b.saves
        .map((s) => s.product?.coverUrl ?? null)
        .filter((c): c is string => c !== null),
    }));
}

/** Combien d'offres publiées : l'onglet « Services » ne paraît que s'il y en a. */
export async function nombreDeServices(createurId: string): Promise<number> {
  return db.serviceOffer.count({ where: { creatorId: createurId, state: "PUBLIE" } });
}
