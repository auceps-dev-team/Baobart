import "server-only";

import { db } from "@/lib/db";

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
 * DEUX CHIFFRES DE LA MAQUETTE NE SONT PAS ICI, ET C'EST VOLONTAIRE
 *
 * `Baobart Accueil.dc.html` dessine cinq indicateurs : produits, ventes à vie,
 * **vues de page**, abonnés, abonnements. Elle affiche aussi *« répond en
 * moyenne en 4 h »*.
 *
 * Nous ne comptons **ni les vues de page, ni le délai de réponse**. Aucune
 * table ne les porte, aucun code ne les alimente. Les afficher demanderait de
 * les inventer — et un chiffre inventé sur un profil public est un mensonge que
 * l'acheteur prend pour une mesure.
 *
 * Ils sont donc absents, et signalés dans `Doc/MAQUETTES_A_FAIRE.md`. Le jour
 * où l'on compte vraiment, ils reviendront.
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

  /** Les liens que le créateur a bien voulu donner. */
  portfolioUrl: string | null;
  instagram: string | null;
  behance: string | null;
  /** « Oui, sous 2 semaines » — un texte, pas un booléen. */
  ouvertAuxCommandes: string | null;
  /** Tarif journalier indicatif, en unités mineures. */
  tarifJournalier: number | null;

  note: number;
  nombreDAvis: number;

  /** Les trois indicateurs qu'on sait vraiment compter. */
  ressourcesPubliees: number;
  ventes: number;
  abonnes: number;
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
      userId: true,
      username: true,
      displayName: true,
      bio: true,
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
      instagram: true,
      behance: true,
      openToCommissions: true,
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
    portfolioUrl: profil.portfolioUrl,
    instagram: profil.instagram,
    behance: profil.behance,
    ouvertAuxCommandes: profil.openToCommissions,
    tarifJournalier: profil.dailyRate,
    note: Number(profil.ratingAvg),
    nombreDAvis: profil.ratingCount,
    ressourcesPubliees: produits.length,
    ventes: produits.reduce((total, p) => total + p.salesCount, 0),
    abonnes: profil.followerCount,
  };
}

export interface CreateurEnVitrine {
  username: string;
  nom: string;
  specialite: string | null;
  ville: string | null;
  avatarUrl: string | null;
  verifie: boolean;
  ressourcesPubliees: number;
  abonnes: number;
}

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
 */
export async function listerCreateurs(limite = 60): Promise<CreateurEnVitrine[]> {
  const groupes = await db.product.groupBy({
    by: ["sellerId"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });

  if (groupes.length === 0) return [];

  const parVendeur = new Map(groupes.map((g) => [g.sellerId, g._count._all]));

  const profils = await db.profile.findMany({
    where: {
      userId: { in: [...parVendeur.keys()] },
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

  return profils.map((p) => ({
    username: p.username,
    nom: p.displayName,
    specialite: p.speciality,
    ville: p.city,
    avatarUrl: p.avatarUrl,
    verifie: p.isVerified,
    ressourcesPubliees: parVendeur.get(p.userId) ?? 0,
    abonnes: p.followerCount,
  }));
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
