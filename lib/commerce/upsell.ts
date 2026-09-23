import "server-only";

import { db } from "@/lib/db";

/**
 * Upsell post-achat — §3.4-B.
 *
 * Traduit `upsell.rb` (antiwork/gumroad, MIT, lu comme spécification). Le
 * modèle `Upsell` existait depuis le premier schéma sans qu'aucune ligne ne le
 * lise.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * APRÈS L'ACHAT, PAS PENDANT
 *
 * Gumroad propose l'offre au moment de payer. On la propose **après** que le
 * paiement a abouti, et ce n'est pas un détail d'implémentation.
 *
 * En mobile money, le passage en caisse est déjà un parcours à deux temps :
 * on quitte le site, on tape un code sur son téléphone, on revient. Y glisser
 * une seconde décision ferait abandonner les deux achats au lieu d'en gagner
 * un — et l'abandon de paiement est déjà le problème que la relance existe
 * pour rattraper.
 *
 * L'offre s'affiche donc sur la page de retour, quand l'argent est arrivé.
 * Elle ne coûte rien à qui l'ignore.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE NE S'AFFICHE JAMAIS SUR CE QU'ON POSSÈDE DÉJÀ
 *
 * C'est la seule règle qui demande une vraie lecture, et la seule dont
 * l'oubli serait invisible côté vendeur : proposer à quelqu'un d'acheter ce
 * qu'il vient d'acquérir ne produit aucune erreur, aucune vente, et beaucoup
 * de doute sur le sérieux de la plateforme.
 */

export interface OffreUpsell {
  upsellId: string;
  produitId: string;
  nom: string;
  slug: string;
  /** Le prix affiché, sans remise. */
  prix: number;
  devise: string;
  /** La remise en pourcentage, quand il y en a une. */
  remisePourcent: number | null;
  /** Ce qu'il paiera, remise comprise. */
  prixFinal: number;
  couverture: string | null;
}

/**
 * L'offre à proposer après l'achat de cette ressource, s'il y en a une.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UNE SEULE, LA PLUS RÉCENTE
 *
 * Un vendeur peut déclarer plusieurs upsells sur le même déclencheur. En
 * afficher trois transformerait une page de remerciement en catalogue, et
 * personne ne cliquerait sur aucun.
 *
 * La plus récemment créée gagne : c'est celle que le vendeur vient de décider,
 * et c'est le comportement qu'il attend en en ajoutant une.
 */
export async function offreApresAchat(input: {
  produitAchete: string;
  acheteurId: string;
}): Promise<OffreUpsell | null> {
  const upsells = await db.upsell.findMany({
    where: { triggerProductId: input.produitAchete, isActive: true },
    orderBy: { id: "desc" },
    take: 10,
  });

  if (upsells.length === 0) return null;

  // Ce que l'acheteur possède déjà, parmi les ressources proposées. Une seule
  // requête pour toutes : une par upsell ferait dix allers-retours sur une
  // page que l'acheteur regarde une seconde.
  const proposes = upsells.map((u) => u.offerProductId);

  const dejaAcquis = await db.orderItem.findMany({
    where: {
      productId: { in: proposes },
      order: { buyerId: input.acheteurId },
      state: { in: ["SUCCESSFUL", "NOT_CHARGED", "IN_PROGRESS"] },
      accessRevokedAt: null,
    },
    select: { productId: true },
  });

  const possedes = new Set(dejaAcquis.map((l) => l.productId));

  for (const upsell of upsells) {
    if (possedes.has(upsell.offerProductId)) continue;

    const produit = await db.product.findUnique({
      where: { id: upsell.offerProductId },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        currency: true,
        status: true,
        coverUrl: true,
        sellerId: true,
        _count: { select: { files: { where: { role: "SOURCE", deletedAt: null } } } },
      },
    });

    // Les mêmes conditions que l'achat lui-même : dépubliée, sans fichier, ou
    // gratuite, la ressource ne s'achète pas. Proposer un bouton qui mène à un
    // refus est pire que ne rien proposer.
    if (!produit || produit.status !== "PUBLISHED") continue;
    if (produit._count.files === 0) continue;
    if (produit.price === 0) continue;
    if (produit.sellerId === input.acheteurId) continue;

    // La remise est bornée à 100 % côté lecture aussi : le schéma ne la
    // contraint pas, et un `discountPercent` de 150 poserait un prix négatif.
    const remise =
      upsell.discountPercent !== null && upsell.discountPercent > 0
        ? Math.min(100, upsell.discountPercent)
        : null;

    const prixFinal =
      remise === null
        ? produit.price
        : produit.price - Math.floor((produit.price * remise) / 100);

    return {
      upsellId: upsell.id,
      produitId: produit.id,
      nom: produit.name,
      slug: produit.slug,
      prix: produit.price,
      devise: produit.currency,
      remisePourcent: remise,
      prixFinal,
      couverture: produit.coverUrl,
    };
  }

  return null;
}

export interface LigneUpsell {
  id: string;
  declencheur: { id: string; nom: string } | null;
  offre: { id: string; nom: string } | null;
  remisePourcent: number | null;
  actif: boolean;
  /** Vraie quand une des deux ressources n'existe plus. */
  orpheline: boolean;
}

/**
 * Les upsells d'un vendeur, pour son écran.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LES ORPHELINES SONT MONTRÉES, PAS CACHÉES
 *
 * `Upsell` porte des identifiants nus, sans relation Prisma — l'audit du
 * 28 août appelait cela des « clés étrangères scalaires ». Supprimer une
 * ressource laisse donc une règle qui ne déclenchera jamais, sans que rien ne
 * l'efface.
 *
 * La cacher ferait chercher pourquoi l'offre ne s'affiche pas. On la montre
 * marquée, ce qui laisse au vendeur le choix de la retirer.
 */
export async function listerLesUpsells(
  vendeurId: string,
): Promise<LigneUpsell[]> {
  const upsells = await db.upsell.findMany({
    where: { sellerId: vendeurId },
    orderBy: { id: "desc" },
    take: 100,
  });

  if (upsells.length === 0) return [];

  const ids = [
    ...new Set(upsells.flatMap((u) => [u.triggerProductId, u.offerProductId])),
  ];

  const produits = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });

  const parId = new Map(produits.map((p) => [p.id, p]));

  const nommer = (id: string) => {
    const p = parId.get(id);
    return p ? { id: p.id, nom: p.name } : null;
  };

  return upsells.map((u) => {
    const declencheur = nommer(u.triggerProductId);
    const offre = nommer(u.offerProductId);

    return {
      id: u.id,
      declencheur,
      offre,
      remisePourcent: u.discountPercent,
      actif: u.isActive,
      orpheline: declencheur === null || offre === null,
    };
  });
}

export type SuiteUpsell =
  | { ok: true; id: string }
  | {
      ok: false;
      motif:
        | "RESSOURCE_ETRANGERE"
        | "MEME_RESSOURCE"
        | "REMISE_INVALIDE"
        | "DEJA_DECLAREE";
    };

/**
 * Déclare un upsell.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LES DEUX RESSOURCES DOIVENT ÊTRE À CE VENDEUR
 *
 * Sans ce contrôle, on pourrait déclencher sur la ressource d'un concurrent —
 * et proposer la sienne à ses acheteurs. Le modèle ne l'empêche pas : il porte
 * un `sellerId` que personne ne confronte aux deux autres champs.
 */
export async function declarerUnUpsell(input: {
  vendeurId: string;
  declencheurId: string;
  offreId: string;
  remisePourcent?: number | null;
}): Promise<SuiteUpsell> {
  if (input.declencheurId === input.offreId) {
    return { ok: false, motif: "MEME_RESSOURCE" };
  }

  const remise = input.remisePourcent ?? null;
  if (
    remise !== null &&
    (!Number.isInteger(remise) || remise <= 0 || remise > 100)
  ) {
    return { ok: false, motif: "REMISE_INVALIDE" };
  }

  const siennes = await db.product.count({
    where: {
      id: { in: [input.declencheurId, input.offreId] },
      sellerId: input.vendeurId,
    },
  });
  if (siennes !== 2) return { ok: false, motif: "RESSOURCE_ETRANGERE" };

  const deja = await db.upsell.findFirst({
    where: {
      sellerId: input.vendeurId,
      triggerProductId: input.declencheurId,
      offerProductId: input.offreId,
    },
    select: { id: true },
  });
  if (deja) return { ok: false, motif: "DEJA_DECLAREE" };

  const cree = await db.upsell.create({
    data: {
      sellerId: input.vendeurId,
      triggerProductId: input.declencheurId,
      offerProductId: input.offreId,
      discountPercent: remise,
    },
    select: { id: true },
  });

  return { ok: true, id: cree.id };
}

/**
 * Active ou désactive un upsell.
 *
 * `updateMany` avec le vendeur dans le `WHERE` : sans cela, connaître un
 * identifiant suffirait à couper l'offre d'un concurrent.
 */
export async function basculerUnUpsell(
  vendeurId: string,
  upsellId: string,
  actif: boolean,
): Promise<boolean> {
  const { count } = await db.upsell.updateMany({
    where: { id: upsellId, sellerId: vendeurId },
    data: { isActive: actif },
  });

  return count > 0;
}
