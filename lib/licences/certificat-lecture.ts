import "server-only";

import type { LicenseKeyStatus } from "@prisma/client";

import { ETATS_ABOUTIS } from "@/lib/dashboard/historique";
import { db } from "@/lib/db";
import { encaisseDe } from "@/lib/domain/encaisse";
import type { Currency } from "@/lib/domain/prisma-types";
import {
  formaterLicenceCertificat,
  motifsRevocation,
  numeroCommandeCourt,
  numeroDeCertificat,
  type LicenceCertificat,
  type MotifRevocation,
} from "@/lib/licences/certificat";

/**
 * Lecture serveur du certificat de licence d'un achat.
 *
 * Renvoie strictement `null` que la ligne n'existe pas, appartienne à un
 * autre compte ou ne soit pas aboutie : l'appelant répond 404 sans jamais
 * confirmer l'existence d'une commande tierce (anti-IDOR).
 *
 * Écart assumé avec `Doc/SPEC_LICENCES_BAOBART.md` §3 : le certificat ne porte
 * ni QR code ni empreinte cryptographique de vérification (aucune page de
 * vérification publique par numéro ni dépendance QR en place).
 */

export interface CertificatLicence {
  numero: string;
  statut: "VALIDE" | "REVOQUE";
  motifsRevocation: MotifRevocation[];
  acheteLe: Date;
  commande: {
    id: string;
    reference: string;
  };
  montant: number;
  devise: Currency;
  acheteur: {
    nom: string;
    email: string;
  };
  vendeur: {
    nom: string;
    username: string | null;
  };
  ressource: {
    id: string;
    slug: string;
    titre: string;
  };
  licence: LicenceCertificat;
  cle: {
    serial: string;
    status: LicenseKeyStatus;
  } | null;
}

export async function lireCertificat(
  orderItemId: string,
  userId: string,
): Promise<CertificatLicence | null> {
  const ligne = await db.orderItem.findFirst({
    where: {
      id: orderItemId,
      state: { in: [...ETATS_ABOUTIS] },
      order: { buyerId: userId },
    },
    select: {
      id: true,
      state: true,
      price: true,
      quantity: true,
      tipAmount: true,
      refundedAmount: true,
      chargebackAt: true,
      chargebackReversedAt: true,
      accessRevokedAt: true,
      createdAt: true,
      order: {
        select: {
          id: true,
          currency: true,
          buyer: {
            select: {
              email: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      },
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          seller: {
            select: {
              profile: { select: { displayName: true, username: true } },
            },
          },
          licenseType: {
            select: { title: true, description: true, conditions: true },
          },
        },
      },
      licenseKey: {
        select: { serial: true, status: true },
      },
    },
  });

  if (!ligne) return null;

  const motifs = motifsRevocation(ligne);
  const acheteurNom = ligne.order.buyer.profile?.displayName?.trim() || ligne.order.buyer.email;
  const vendeurNom = ligne.product.seller.profile?.displayName ?? "Créateur Baobart";

  return {
    numero: numeroDeCertificat(ligne.id, ligne.createdAt),
    statut: motifs.length > 0 ? "REVOQUE" : "VALIDE",
    motifsRevocation: motifs,
    acheteLe: ligne.createdAt,
    commande: {
      id: ligne.order.id,
      reference: numeroCommandeCourt(ligne.order.id),
    },
    montant: encaisseDe(ligne),
    devise: ligne.order.currency,
    acheteur: {
      nom: acheteurNom,
      email: ligne.order.buyer.email,
    },
    vendeur: {
      nom: vendeurNom,
      username: ligne.product.seller.profile?.username ?? null,
    },
    ressource: {
      id: ligne.product.id,
      slug: ligne.product.slug,
      titre: ligne.product.name,
    },
    licence: formaterLicenceCertificat(ligne.product.licenseType),
    cle: ligne.licenseKey
      ? { serial: ligne.licenseKey.serial, status: ligne.licenseKey.status }
      : null,
  };
}
