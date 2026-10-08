"use server";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rendreAcces, retirerAcces } from "@/lib/domain/acces";
import { rembourserUneVente } from "@/lib/ventes/remboursement";

/**
 * Ce qu'un vendeur peut faire sur une de ses ventes.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA GARDE EST ICI, PAS DANS LE BOUTON
 *
 * Un module « use server » expose chacun de ses exports comme un point d'entrée
 * appelable depuis le navigateur. Cacher un bouton ne protège rien : la
 * fonction reste joignable par quiconque connaît son identifiant. Aucune de ces
 * fonctions ne prend d'identifiant de vendeur en paramètre — il est lu depuis
 * la session, sans quoi on offrirait de rembourser au nom d'autrui.
 */

export type EtatVente =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Un seul point d'entrée, aiguillé par la clé du bouton.
 *
 * Le panneau d'opérations est partagé par trois écrans : il appelle toujours la
 * même signature. C'est ici qu'on traduit « rembourser » ou « retirer » en
 * geste, après avoir vérifié qui parle.
 */
export async function agirSurLaVente(
  orderItemId: string,
  cle: string,
  precedent: EtatVente | null,
  donnees: FormData,
): Promise<EtatVente> {
  switch (cle) {
    case "rembourser":
      return rembourserVente(orderItemId, precedent, donnees);
    case "retirer":
      return basculerAcces(orderItemId, true, donnees);
    case "rendre":
      return basculerAcces(orderItemId, false, donnees);
    default:
      return { ok: false, message: "Geste inconnu." };
  }
}

async function basculerAcces(
  orderItemId: string,
  retirer: boolean,
  donnees: FormData,
): Promise<EtatVente> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  // Le motif n'est pas décoratif : retirer un accès déjà payé se justifie,
  // et l'acheteur peut le contester.
  const motif = String(donnees.get("motif") ?? "").trim();
  if (retirer && motif.length < 4) {
    return { ok: false, message: "Écris pourquoi tu retires l'accès." };
  }

  const suite = retirer
    ? await retirerAcces({ orderItemId, vendeurId: utilisateur.id, motif })
    : await rendreAcces({ orderItemId, vendeurId: utilisateur.id });

  revalidatePath("/dashboard/ventes");

  if (!suite.fait) {
    return {
      ok: false,
      message:
        suite.motif === "DEJA_DANS_CET_ETAT"
          ? "L'accès est déjà dans cet état."
          : "Vente introuvable.",
    };
  }

  return {
    ok: true,
    message: retirer ? "Accès retiré." : "Accès rendu.",
  };
}

async function rembourserVente(
  orderItemId: string,
  _precedent: EtatVente | null,
  donnees: FormData,
): Promise<EtatVente> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  const ligne = await db.orderItem.findUnique({
    where: { id: orderItemId },
    select: { product: { select: { sellerId: true } } },
  });
  // Même réponse que pour une vente inexistante : dire « pas à toi »
  // confirmerait qu'elle existe.
  if (!ligne || ligne.product.sellerId !== utilisateur.id) {
    return { ok: false, message: "Vente introuvable." };
  }

  const saisi = String(donnees.get("montant") ?? "").replace(/[^d]/g, "");

  // Le chemin de l'argent vit dans `rembourserUneVente` depuis le 08/10 : la
  // demande de remboursement acceptée passe par le même.
  const suite = await rembourserUneVente({
    orderItemId,
    montant: saisi.length > 0 ? Number(saisi) : undefined,
    parId: utilisateur.id,
    motifInterne: "Remboursement demandé par le vendeur",
  });

  if (!suite.ok) return suite;
  revalidatePath("/dashboard/ventes");
  return { ok: true, message: `Remboursement enregistré. Ton solde est débité de ${suite.montant}.` };
}
