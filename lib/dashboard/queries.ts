import "server-only";

import { db } from "@/lib/db";
import {
  debutDuMois,
  etatCommande,
  formatsLisibles,
  type EtatCommande,
  type FiltreAchats,
  type FiltreTelechargements,
} from "@/lib/dashboard/historique";
import type { Currency } from "@/lib/i18n/money";

/**
 * Les deux historiques de l'acheteur, lus en base.
 *
 * Les décisions vivent dans `historique.ts` ; ici on ne fait que chercher et
 * assembler. La séparation tient parce qu'un état de commande se raisonne sur
 * quatre nombres, pas sur une jointure.
 */

export interface CommandeHistorique {
  id: string;
  /** Numéro court affiché — « Commande #10428 » dans la maquette. */
  reference: string;
  passeeLe: Date;
  total: number;
  devise: Currency;
  etat: EtatCommande;
  articles: number;
  /** Couverture du premier article, pour la vignette de la ligne. */
  visuel: string | null;
}

export interface AbonnementHistorique {
  id: string;
  nom: string;
  prixMensuel: number;
  devise: Currency;
  actif: boolean;
  prochainPrelevement: Date;
}

export interface Achats {
  /** Commandes retenues par le filtre — ce que la liste affiche. */
  commandes: CommandeHistorique[];
  abonnements: AbonnementHistorique[];
  /**
   * Bilan du compte, **jamais filtré**.
   *
   * Un filtre restreint la liste, pas ce qu'on annonce du compte : afficher
   * « abonnement : aucun » parce qu'on regarde les commandes payées serait
   * faux, et c'est le genre de faux qu'on croit.
   */
  bilan: {
    commandes: number;
    totalDepense: number;
    abonnementActif: boolean;
  };
  devise: Currency;
}

export async function historiqueDesAchats(
  userId: string,
  filtre: FiltreAchats,
): Promise<Achats> {
  const brutes = await db.order.findMany({
    where: { buyerId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      total: true,
      currency: true,
      items: {
        select: {
          state: true,
          price: true,
          quantity: true,
          refundedAmount: true,
          product: { select: { coverUrl: true } },
        },
      },
    },
  });

  const toutesLesCommandes = brutes
    .map((o) => ({
      id: o.id,
      // Les huit derniers caractères d'un cuid : assez pour distinguer deux
      // commandes à l'œil sans exposer un compteur global.
      reference: `#${o.id.slice(-6).toUpperCase()}`,
      passeeLe: o.createdAt,
      total: o.total,
      devise: o.currency,
      etat: etatCommande(o.items),
      articles: o.items.length,
      visuel: o.items.find((i) => i.product.coverUrl)?.product.coverUrl ?? null,
    }));

  const tousLesAbonnements = (
    await db.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        cycleEnd: true,
        plan: { select: { name: true, priceMonthly: true } },
      },
    })
  ).map((s) => ({
    id: s.id,
    nom: `Abonnement ${s.plan.name}`,
    prixMensuel: s.plan.priceMonthly,
    devise: "XOF" as Currency,
    actif: s.status === "ACTIVE",
    prochainPrelevement: s.cycleEnd,
  }));

  // Ce qui a réellement quitté la poche : les commandes abouties, moins ce qui
  // a été rendu. Additionner les totaux compterait aussi les paniers
  // abandonnés.
  const totalDepense = brutes.reduce((somme, o) => {
    const abouties = o.items.filter(
      (i) => i.state === "SUCCESSFUL" || i.state === "NOT_CHARGED",
    );
    const paye = abouties.reduce((s, i) => s + i.price * i.quantity, 0);
    const rendu = abouties.reduce((s, i) => s + i.refundedAmount, 0);
    return somme + Math.max(0, paye - rendu);
  }, 0);

  return {
    commandes:
      filtre === "Abonnement"
        ? []
        : toutesLesCommandes.filter((c) =>
            filtre === "Payées" ? c.etat === "PAYÉE" : true,
          ),
    abonnements: filtre === "Payées" ? [] : tousLesAbonnements,
    bilan: {
      commandes: toutesLesCommandes.length,
      totalDepense,
      abonnementActif: tousLesAbonnements.some((a) => a.actif),
    },
    devise: brutes[0]?.currency ?? "XOF",
  };
}

export interface RessourceTelechargee {
  produitId: string;
  slug: string;
  titre: string;
  formats: string;
  dernierRetrait: Date;
  repetitions: number;
  gratuite: boolean;
  visuel: string | null;
  /** Fichier proposé au re-téléchargement, ou `null` s'il n'y en a plus. */
  fichierId: string | null;
}

export interface Telechargements {
  /** Ressources retenues par le filtre. */
  ressources: RessourceTelechargee[];
  /** Bilan du compte, hors filtre — même raison que pour les achats. */
  totalCeMois: number;
  totalGeneral: number;
  ressourcesDistinctes: number;
  quota: { utilises: number; limite: number | null } | null;
}

export async function historiqueDesTelechargements(
  userId: string,
  filtre: FiltreTelechargements,
  now: Date = new Date(),
): Promise<Telechargements> {
  // `ConsumptionEvent` est un journal : il ne porte aucune relation, pour que
  // l'écriture reste indépendante de ce qu'elle décrit. On rapproche donc les
  // ressources en une seconde requête plutôt que par une jointure.
  const evenements = await db.consumptionEvent.findMany({
    where: { userId },
    orderBy: { consumedAt: "desc" },
    take: 500,
    select: { productId: true, consumedAt: true },
  });

  const debut = debutDuMois(now);
  const totalCeMois = evenements.filter(
    (e) => e.consumedAt.getTime() >= debut.getTime(),
  ).length;

  const produits = await db.product.findMany({
    where: { id: { in: [...new Set(evenements.map((e) => e.productId))] } },
    select: {
      id: true,
      slug: true,
      name: true,
      price: true,
      coverUrl: true,
      files: {
        where: { role: "SOURCE" },
        orderBy: { position: "asc" },
        select: { id: true, filename: true },
      },
    },
  });

  const parId = new Map(produits.map((p) => [p.id, p]));

  // Regroupé par ressource, comme la maquette : elle annonce « 3 fois », pas
  // trois lignes identiques.
  const parRessource = new Map<string, RessourceTelechargee>();

  for (const e of evenements) {
    const dejaLa = parRessource.get(e.productId);
    if (dejaLa) {
      dejaLa.repetitions += 1;
      continue;
    }

    // Une ressource supprimée depuis laisse son événement derrière elle : on
    // ne peut plus rien en dire, on ne l'affiche pas.
    const produit = parId.get(e.productId);
    if (!produit) continue;

    parRessource.set(e.productId, {
      produitId: e.productId,
      slug: produit.slug,
      titre: produit.name,
      formats: formatsLisibles(produit.files.map((f) => f.filename)),
      // Les événements arrivent du plus récent au plus ancien : le premier vu
      // est le dernier retrait.
      dernierRetrait: e.consumedAt,
      repetitions: 1,
      gratuite: produit.price === 0,
      visuel: produit.coverUrl,
      fichierId: produit.files[0]?.id ?? null,
    });
  }

  const ressourcesDistinctes = parRessource.size;

  let ressources = [...parRessource.values()];

  if (filtre === "Ce mois") {
    ressources = ressources.filter(
      (r) => r.dernierRetrait.getTime() >= debut.getTime(),
    );
  } else if (filtre === "Gratuits") {
    ressources = ressources.filter((r) => r.gratuite);
  } else if (filtre === "Achetés") {
    ressources = ressources.filter((r) => !r.gratuite);
  }

  const abonnement = await db.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, plan: { select: { downloadsPerMonth: true } } },
  });

  let quota: Telechargements["quota"] = null;

  if (abonnement) {
    const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const compteur = await db.downloadQuota.findUnique({
      where: {
        subscriptionId_period: { subscriptionId: abonnement.id, period: periode },
      },
      select: { used: true, limit: true },
    });

    quota = {
      utilises: compteur?.used ?? 0,
      limite: compteur?.limit ?? abonnement.plan.downloadsPerMonth,
    };
  }

  return {
    ressources,
    totalCeMois,
    totalGeneral: evenements.length,
    ressourcesDistinctes,
    quota,
  };
}
