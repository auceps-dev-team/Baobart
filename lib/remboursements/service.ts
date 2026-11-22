import "server-only";

import type { Currency, RefundRequestStatus } from "@prisma/client";

import { rolesAyant } from "@/lib/auth/administration";
import { db } from "@/lib/db";
import { encaisseDe } from "@/lib/domain/encaisse";
import { formatMoney } from "@/lib/i18n/money";
import { notifier } from "@/lib/notifications/aiguilleur";
import {
  JOURS_AVANT_SUPPORT,
  REFUS_MIN,
  delaiValide,
  eligibilite,
  motifValide,
  passeAuSupportLe,
  type Eligibilite,
  type Refus,
} from "@/lib/remboursements/regles";
import { rembourserUneVente } from "@/lib/ventes/remboursement";

/**
 * Les demandes de remboursement des acheteurs — voir `regles.ts` pour ce qui
 * est décidé et d'où ça vient.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ACCEPTER, C'EST D'ABORD RÉSERVER LA DEMANDE
 *
 * Le créateur et le support peuvent cliquer en même temps sur la même
 * demande. Rembourser deux fois serait rendre deux fois l'argent par
 * l'opérateur — le plafond du grand livre arrêterait la seconde écriture, pas
 * le second virement. La décision passe donc d'abord PENDING → ACCEPTED par une
 * écriture conditionnelle ; seul celui qui l'obtient rembourse. Si le
 * remboursement échoue (opérateur injoignable, remboursements suspendus), la
 * demande redevient PENDING, et rien n'est perdu.
 */

const JOUR = 86_400_000;

/** Le délai qui vaut pour une ligne : celui figé à l'achat, sinon celui du créateur aujourd'hui. */
function delaiDe(ligne: { refundWindowDays: number | null; product: { seller: { refundWindowDays: number } } }): number {
  return ligne.refundWindowDays ?? ligne.product.seller.refundWindowDays;
}

/** L'encaissement, lu au grand livre ; à défaut, la création de la ligne. */
async function payeLe(orderItemId: string, repli: Date): Promise<Date> {
  const vente = await db.balanceTransaction.findFirst({
    where: { orderItemId, type: "SALE" },
    orderBy: { occurredAt: "asc" },
    select: { occurredAt: true },
  });
  return vente?.occurredAt ?? repli;
}

const SELECT_LIGNE = {
  id: true,
  state: true,
  price: true,
  quantity: true,
  tipAmount: true,
  refundedAmount: true,
  chargebackAt: true,
  chargebackReversedAt: true,
  refundWindowDays: true,
  createdAt: true,
  order: { select: { buyerId: true, currency: true } },
  product: { select: { name: true, slug: true, sellerId: true, seller: { select: { refundWindowDays: true } } } },
  demandeDeRemboursement: { select: { id: true, status: true, refusalReason: true, createdAt: true, decidedAt: true, decidedBySupport: true } },
} as const;

async function eligibiliteDe(
  ligne: {
    id: string;
    state: string;
    price: number;
    quantity: number;
    tipAmount: number;
    refundedAmount: number;
    chargebackAt: Date | null;
    chargebackReversedAt: Date | null;
    refundWindowDays: number | null;
    createdAt: Date;
    product: { seller: { refundWindowDays: number } };
    demandeDeRemboursement: { id: string } | null;
  },
  maintenant: Date,
): Promise<Eligibilite> {
  return eligibilite(
    {
      etat: ligne.state,
      paye: encaisseDe(ligne),
      rembourse: ligne.refundedAmount,
      conteste: ligne.chargebackAt !== null && ligne.chargebackReversedAt === null,
      delaiJours: delaiDe(ligne),
      payeLe: await payeLe(ligne.id, ligne.createdAt),
      dejaDemande: ligne.demandeDeRemboursement !== null,
    },
    maintenant,
  );
}

// ═══════════════════════════════════════════════════════════════ acheteur ══

export interface AchatRemboursable {
  orderItemId: string;
  ressource: string;
  slug: string;
  montant: string;
  /** Jusqu'à quand demander, quand on peut. */
  jusquA: Date | null;
  /** Pourquoi on ne peut pas, quand on ne peut pas. */
  refus: Refus | null;
  demande: {
    statut: RefundRequestStatus;
    motifRefus: string | null;
    parLeSupport: boolean;
    le: Date;
    /**
     * En attente, et passée à l'équipe (Q-39) : l'acheteur lisait « En attente
     * du créateur » au huitième jour comme au premier.
     */
    chezLEquipe: boolean;
  } | null;
}

export async function achatsRemboursables(acheteurId: string, maintenant: Date = new Date()): Promise<AchatRemboursable[]> {
  const lignes = await db.orderItem.findMany({
    where: { order: { buyerId: acheteurId }, state: { in: ["SUCCESSFUL", "NOT_CHARGED"] }, price: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: SELECT_LIGNE,
  });

  const rendu: AchatRemboursable[] = [];
  for (const l of lignes) {
    const e = await eligibiliteDe(l, maintenant);
    const d = l.demandeDeRemboursement;
    rendu.push({
      orderItemId: l.id,
      ressource: l.product.name,
      slug: l.product.slug,
      montant: formatMoney(encaisseDe(l), l.order.currency),
      jusquA: e.ok ? e.jusquA : null,
      refus: e.ok ? null : e.motif,
      demande: d
        ? {
            statut: d.status,
            motifRefus: d.refusalReason,
            parLeSupport: d.decidedBySupport,
            le: d.decidedAt ?? d.createdAt,
            chezLEquipe: d.status === "PENDING" && passeAuSupportLe(d.createdAt).getTime() <= maintenant.getTime(),
          }
        : null,
    });
  }
  return rendu;
}

export type Demande = { ok: true; demandeId: string } | { ok: false; motif: Refus | "INTROUVABLE" | "MOTIF" };

export async function demander(input: { acheteurId: string; orderItemId: string; motif: string; maintenant?: Date }): Promise<Demande> {
  const maintenant = input.maintenant ?? new Date();
  if (!motifValide(input.motif)) return { ok: false, motif: "MOTIF" };

  const ligne = await db.orderItem.findUnique({ where: { id: input.orderItemId }, select: SELECT_LIGNE });
  // Pas « ce n'est pas ton achat » : dire qu'il existe en dirait déjà trop.
  if (!ligne || ligne.order.buyerId !== input.acheteurId) return { ok: false, motif: "INTROUVABLE" };

  const e = await eligibiliteDe(ligne, maintenant);
  if (!e.ok) return { ok: false, motif: e.motif };

  try {
    return await db.$transaction(async (tx) => {
      const cree = await tx.refundRequest.create({
        data: { orderItemId: ligne.id, buyerId: input.acheteurId, reason: input.motif.trim() },
        select: { id: true },
      });
      const montant = formatMoney(encaisseDe(ligne), ligne.order.currency);
      await notifier(
        {
          destinataireId: ligne.product.sellerId,
          evenement: "DEMANDE_REMBOURSEMENT",
          cle: `demande-remboursement-${cree.id}`,
          titre: `Demande de remboursement — ${ligne.product.name}`,
          corps: `Un acheteur demande le remboursement de ${montant}. Réponds sous ${JOURS_AVANT_SUPPORT} jours : sans réponse, le support tranchera.`,
          lien: "/dashboard/ventes/remboursements",
          charge: { ressource: ligne.product.name, montant, motif: input.motif.trim().slice(0, 500), jours: JOURS_AVANT_SUPPORT },
        },
        tx,
      );
      return { ok: true, demandeId: cree.id } as const;
    });
  } catch (cause) {
    // La contrainte d'unicité : deux envois rapprochés de la même demande.
    if (typeof cause === "object" && cause !== null && "code" in cause && (cause as { code: string }).code === "P2002") {
      return { ok: false, motif: "DEJA_DEMANDE" };
    }
    throw cause;
  }
}

// ═══════════════════════════════════════════════════ créateur et support ══

export interface DemandeRecue {
  id: string;
  orderItemId: string;
  ressource: string;
  montant: string;
  motif: string;
  statut: RefundRequestStatus;
  motifRefus: string | null;
  parLeSupport: boolean;
  demandeeLe: Date;
  /** Quand elle passe (ou est passée) au support. */
  supportLe: Date;
  acheteur: string;
}

const SELECT_DEMANDE = {
  id: true,
  reason: true,
  status: true,
  refusalReason: true,
  decidedBySupport: true,
  createdAt: true,
  orderItemId: true,
  orderItem: { select: { price: true, quantity: true, tipAmount: true, order: { select: { currency: true } }, product: { select: { name: true, sellerId: true } } } },
  buyer: { select: { email: true, profile: { select: { displayName: true } } } },
} as const;

function enDemandeRecue(d: {
  id: string;
  reason: string;
  status: RefundRequestStatus;
  refusalReason: string | null;
  decidedBySupport: boolean;
  createdAt: Date;
  orderItemId: string;
  orderItem: { price: number; quantity: number; tipAmount: number; order: { currency: Currency }; product: { name: string } };
  buyer: { email: string; profile: { displayName: string } | null };
}): DemandeRecue {
  return {
    id: d.id,
    orderItemId: d.orderItemId,
    ressource: d.orderItem.product.name,
    montant: formatMoney(encaisseDe(d.orderItem), d.orderItem.order.currency),
    motif: d.reason,
    statut: d.status,
    motifRefus: d.refusalReason,
    parLeSupport: d.decidedBySupport,
    demandeeLe: d.createdAt,
    supportLe: passeAuSupportLe(d.createdAt),
    // Le même nom que voit le créateur sur ses ventes : affiché, sinon l'adresse.
    acheteur: d.buyer.profile?.displayName ?? d.buyer.email,
  };
}

export async function demandesRecues(vendeurId: string): Promise<DemandeRecue[]> {
  const lignes = await db.refundRequest.findMany({
    where: { orderItem: { product: { sellerId: vendeurId } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: SELECT_DEMANDE,
  });
  return lignes.map(enDemandeRecue);
}

/** Les demandes restées sans réponse du créateur au-delà du délai. */
export async function demandesPourLeSupport(maintenant: Date = new Date()): Promise<DemandeRecue[]> {
  const lignes = await db.refundRequest.findMany({
    where: { status: "PENDING", createdAt: { lte: new Date(maintenant.getTime() - JOURS_AVANT_SUPPORT * JOUR) } },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: SELECT_DEMANDE,
  });
  return lignes.map(enDemandeRecue);
}

/**
 * Q-39 (recette du 14/11/2026, décidé le 21/11) : au huitième jour, prévenir.
 *
 * « Sans réponse sous sept jours, l'équipe tranche » est écrit sur cinq écrans.
 * Mesuré à la recette : au huitième jour, la demande était bien sur l'écran
 * « Remboursements à trancher » — et personne ne le savait. Il fallait penser
 * à ouvrir cet écran ; sinon, la demande attendait sans fin.
 *
 * Rien ne SE PRODUIT au huitième jour : la liste de l'équipe se recalcule à
 * chaque lecture (`demandesPourLeSupport`). D'où ce passage, appelé chaque nuit
 * par l'ordonnanceur des commandes. Le responsable a décidé qui prévenir :
 *
 *   — **le créateur**, qui apprend que la demande passe à l'équipe — et qu'il
 *     peut encore y répondre, `trancher` ne fermant pas la porte au créateur ;
 *   — **l'équipe** : chaque compte dont le rôle porte `traiter_les_litiges`,
 *     c'est-à-dire ceux qui ont la main sur l'écran où l'on tranche. Ni un
 *     compte suspendu, ni un compte effacé.
 *
 * Une fois par demande et par personne : les clés portent la demande, et
 * l'aiguilleur refuse une clé déjà posée. Une demande dont le créateur a déjà
 * été prévenu est sautée sans rien appeler, pour qu'une demande oubliée des
 * mois ne coûte pas un passage complet chaque nuit.
 */
export async function prevenirDemandesEchues(
  maintenant: Date = new Date(),
): Promise<{ demandes: number; avis: number }> {
  const echues = await db.refundRequest.findMany({
    where: { status: "PENDING", createdAt: { lte: new Date(maintenant.getTime() - JOURS_AVANT_SUPPORT * JOUR) } },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      orderItem: {
        select: {
          price: true,
          quantity: true,
          tipAmount: true,
          order: { select: { currency: true } },
          product: {
            select: { name: true, sellerId: true },
          },
        },
      },
    },
  });
  if (echues.length === 0) return { demandes: 0, avis: 0 };

  // La cloche range ses clés sous `in-app:<clé>` (`aiguilleur.ts`). Un avis
  // impératif y est toujours écrit : sa présence dit « déjà prévenu ».
  const cleVendeur = (id: string) => `demande-transmise-${id}`;
  const deja = new Set(
    (
      await db.notification.findMany({
        where: { cle: { in: echues.map((d) => `in-app:${cleVendeur(d.id)}`) } },
        select: { cle: true },
      })
    ).map((n) => n.cle),
  );
  const aPrevenir = echues.filter((d) => !deja.has(`in-app:${cleVendeur(d.id)}`));
  if (aPrevenir.length === 0) return { demandes: 0, avis: 0 };

  const equipe = await db.user.findMany({
    where: {
      platformRole: { in: rolesAyant("traiter_les_litiges") },
      suspendedAt: null,
      anonymizedAt: null,
    },
    select: { id: true },
  });

  let avis = 0;
  for (const d of aPrevenir) {
    const ligne = d.orderItem;
    const ressource = ligne.product.name;
    const montant = formatMoney(encaisseDe(ligne), ligne.order.currency);

    const auVendeur = await notifier({
      destinataireId: ligne.product.sellerId,
      evenement: "DEMANDE_TRANSMISE",
      cle: cleVendeur(d.id),
      titre: `Demande transmise à l'équipe — ${ressource}`,
      corps: `Sans réponse sous ${JOURS_AVANT_SUPPORT} jours, la demande de remboursement de ${montant} passe à l'équipe Baobart, qui va trancher. Tu peux encore y répondre tant qu'elle ne l'a pas fait.`,
      lien: "/dashboard/ventes/remboursements",
      charge: { ressource, montant, jours: JOURS_AVANT_SUPPORT },
    });
    avis += auVendeur.canaux.length > 0 ? 1 : 0;

    for (const membre of equipe) {
      const aLEquipe = await notifier({
        destinataireId: membre.id,
        evenement: "DEMANDE_A_TRANCHER",
        cle: `demande-a-trancher-${d.id}-${membre.id}`,
        titre: `Remboursement à trancher — ${ressource}`,
        // Sans le nom du créateur : écrit ici, il survivrait à l'effacement de
        // son compte (la purge retire les avis par destinataire). L'écran où
        // l'on tranche le montre, à jour.
        corps: `Le créateur n'a pas répondu sous ${JOURS_AVANT_SUPPORT} jours à une demande de remboursement de ${montant}. L'acheteur attend.`,
        lien: "/dashboard/remboursements-a-trancher",
        charge: { ressource, montant, jours: JOURS_AVANT_SUPPORT },
      });
      avis += aLEquipe.canaux.length > 0 ? 1 : 0;
    }
  }

  return { demandes: aPrevenir.length, avis };
}

export type Decision = "ACCEPTER" | "REFUSER";
export type Tranchage =
  | { ok: true; message: string }
  | { ok: false; motif: "INTROUVABLE" | "PAS_ENCORE_AU_SUPPORT" | "DEJA_TRANCHEE" | "MOTIF_REQUIS"; message?: undefined }
  | { ok: false; motif: "REMBOURSEMENT_IMPOSSIBLE"; message: string };

export async function trancher(input: {
  demandeId: string;
  parId: string;
  qualite: "CREATEUR" | "SUPPORT";
  decision: Decision;
  motif?: string;
  maintenant?: Date;
}): Promise<Tranchage> {
  const maintenant = input.maintenant ?? new Date();
  const d = await db.refundRequest.findUnique({ where: { id: input.demandeId }, select: SELECT_DEMANDE });
  if (!d) return { ok: false, motif: "INTROUVABLE" };
  if (input.qualite === "CREATEUR" && d.orderItem.product.sellerId !== input.parId) return { ok: false, motif: "INTROUVABLE" };
  if (input.qualite === "SUPPORT" && passeAuSupportLe(d.createdAt).getTime() > maintenant.getTime()) {
    return { ok: false, motif: "PAS_ENCORE_AU_SUPPORT" };
  }

  const motif = (input.motif ?? "").trim();
  if (input.decision === "REFUSER" && motif.length < REFUS_MIN) return { ok: false, motif: "MOTIF_REQUIS" };

  // La réservation : une seule décision l'emporte.
  const { count } = await db.refundRequest.updateMany({
    where: { id: d.id, status: "PENDING" },
    data: {
      status: input.decision === "ACCEPTER" ? "ACCEPTED" : "REFUSED",
      refusalReason: input.decision === "REFUSER" ? motif : null,
      decidedById: input.parId,
      decidedBySupport: input.qualite === "SUPPORT",
      decidedAt: maintenant,
    },
  });
  if (count !== 1) return { ok: false, motif: "DEJA_TRANCHEE" };

  if (input.decision === "ACCEPTER") {
    const suite = await rembourserUneVente({
      orderItemId: d.orderItemId,
      parId: input.parId,
      motifInterne: input.qualite === "SUPPORT" ? "Demande de remboursement tranchée par le support" : "Demande de remboursement acceptée par le vendeur",
      raison: d.reason.slice(0, 500),
    });
    if (!suite.ok) {
      // Rien n'est parti : la demande redevient décidable.
      await db.refundRequest.updateMany({
        where: { id: d.id, status: "ACCEPTED", decidedById: input.parId },
        data: { status: "PENDING", decidedById: null, decidedBySupport: false, decidedAt: null },
      });
      return { ok: false, motif: "REMBOURSEMENT_IMPOSSIBLE", message: suite.message };
    }
    // L'acheteur est prévenu par le remboursement lui-même (COMMANDE_REMBOURSEE).
    // Le créateur, lui, ne l'était pas quand l'équipe tranchait à sa place
    // (Q-40) : il l'apprenait par une ligne « Tu dois » sur l'écran des gains.
    if (input.qualite === "SUPPORT") {
      // `suite.montant` est un NOMBRE (relevé par le test : le courriel était
      // refusé, « expected string ») : on le met en forme, dans la devise payée.
      const rendu = formatMoney(suite.montant, d.orderItem.order.currency);
      await notifier({
        destinataireId: d.orderItem.product.sellerId,
        evenement: "REMBOURSE_PAR_EQUIPE",
        cle: `rembourse-par-equipe-${d.id}`,
        titre: `Remboursement fait par l'équipe — ${d.orderItem.product.name}`,
        corps: `Sans réponse de ta part, l'équipe a accepté la demande : ${rendu} rendus, ton solde est débité.`,
        lien: "/dashboard/ventes/remboursements",
        charge: { ressource: d.orderItem.product.name, montant: rendu, motif: d.reason.slice(0, 500) },
      });
    }
    return { ok: true, message: "Remboursé." };
  }

  const acheteurId = (await db.refundRequest.findUniqueOrThrow({ where: { id: d.id }, select: { buyerId: true } })).buyerId;
  const par = input.qualite === "SUPPORT" ? "l'équipe Baobart" : "le créateur";
  await notifier({
    destinataireId: acheteurId,
    evenement: "REMBOURSEMENT_REFUSE",
    cle: `refus-remboursement-${d.id}`,
    titre: `Remboursement refusé — ${d.orderItem.product.name}`,
    corps: `Ta demande a été refusée par ${par} : « ${motif} »`,
    lien: "/dashboard/remboursements",
    charge: { ressource: d.orderItem.product.name, motif, par },
  });
  return { ok: true, message: "Demande refusée. L'acheteur est prévenu, avec ton motif." };
}

// ═══════════════════════════════════════════════════════════ le réglage ══

export async function definirDelai(vendeurId: string, jours: number): Promise<boolean> {
  if (!delaiValide(jours)) return false;
  await db.user.update({ where: { id: vendeurId }, data: { refundWindowDays: jours } });
  return true;
}
