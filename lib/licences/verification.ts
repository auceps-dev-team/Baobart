import "server-only";

import { licenceBienFormee } from "@/lib/checkout/licence";
import { db } from "@/lib/db";

/**
 * Vérifier une clé de licence — pour le créateur qui vend un logiciel, une
 * police ou un greffon, et veut que son programme demande la clé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MODÈLE DE GUMROAD, LU DANS SON DÉPÔT
 *
 * `app/views/help_center/articles/contents/_76-license-keys.html.erb`
 * (antiwork/gumroad, lu le 04/10) : `POST /v2/licenses/verify` avec
 * l'identifiant du produit et la clé, un compteur d'utilisations incrémenté par
 * défaut (`increment_uses_count`), une réponse 404 quand la vérification
 * échoue, et les champs `refunded` / `disputed` pour que le programme décide.
 * « License key enforcement is completely up to the creator » : Baobart dit ce
 * qu'il sait de l'achat, le programme du créateur tranche.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN ÉCART : PAS D'ADRESSE E-MAIL DANS LA RÉPONSE
 *
 * La réponse de Gumroad porte l'e-mail de l'acheteur. Cette route est publique
 * — n'importe qui qui détient une clé peut l'appeler —, et une clé recopiée sur
 * un forum livrerait l'adresse de son acheteur. On rend ce qui sert à décider
 * (valide, combien d'utilisations, remboursée, contestée), rien qui désigne.
 */

export type Verification =
  | {
      ok: true;
      utilisations: number;
      achat: { produitId: string; produit: string; acheteLe: string; rembourse: boolean; conteste: boolean };
    }
  | { ok: false; motif: "INCONNUE" | "DESACTIVEE" };

export async function verifierLicence(input: { produitId: string; cle: string; incrementer: boolean }): Promise<Verification> {
  const cle = input.cle.trim().toUpperCase();
  // Une forme impossible ne mérite pas une requête : c'est aussi ce qui rend
  // le tâtonnement inutile — 31^32 clés possibles.
  if (!licenceBienFormee(cle)) return { ok: false, motif: "INCONNUE" };

  const licence = await db.licenseKey.findUnique({
    where: { serial: cle },
    select: {
      id: true,
      productId: true,
      status: true,
      usesCount: true,
      orderItem: {
        select: {
          state: true,
          price: true,
          quantity: true,
          refundedAmount: true,
          chargebackAt: true,
          chargebackReversedAt: true,
          createdAt: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  // Une clé d'une autre ressource vaut une clé inconnue : le dire apprendrait
  // qu'elle existe ailleurs.
  if (!licence || licence.productId !== input.produitId) return { ok: false, motif: "INCONNUE" };
  if (licence.status !== "ACTIVE") return { ok: false, motif: "DESACTIVEE" };
  const ligne = licence.orderItem;
  if (ligne.state !== "SUCCESSFUL" && ligne.state !== "NOT_CHARGED") return { ok: false, motif: "INCONNUE" };

  const utilisations = input.incrementer
    ? (await db.licenseKey.update({ where: { id: licence.id }, data: { usesCount: { increment: 1 } }, select: { usesCount: true } })).usesCount
    : licence.usesCount;

  const totalPaye = ligne.price * ligne.quantity;
  return {
    ok: true,
    utilisations,
    achat: {
      produitId: licence.productId,
      produit: ligne.product.name,
      acheteLe: ligne.createdAt.toISOString(),
      rembourse: totalPaye > 0 && ligne.refundedAmount >= totalPaye,
      conteste: ligne.chargebackAt !== null && ligne.chargebackReversedAt === null,
    },
  };
}
