"use server";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import { lireUnEntier } from "@/lib/commerce/montant";
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

  // ══════════════════════════════════════════════════════════════════════════
  // LE MONTANT SE LIT AVEC LE LECTEUR DE L'ACHAT, ET UN CHAMP VIDE EST REFUSÉ
  //
  // Jusqu'au 31/10/2026, le montant passait par `.replace(/[^d]/g, "")` :
  // l'antislash de `\d`, présent avant, s'est perdu quand ce code a été
  // déplacé (v1.79.0, 08/10). Mesuré le 31/10 : « 1000 » devenait « », le
  // montant arrivait absent, et `rembourserUneVente` rendait TOUT le restant —
  // 5 000 F rendus pour 1 000 demandés, avec « Remboursement enregistré ».
  //
  // Même avec son antislash, la règle aurait lu « 1000.5 » comme 10 005.
  // `lireUnEntier` est celui de l'achat, corrigé de ce défaut le 25/09.
  //
  // Un champ vide ne veut plus dire « tout » : le champ arrive prérempli avec
  // le restant, le vider est une erreur, et c'est l'erreur qui coûte le plus.
  const montant = lireUnEntier(String(donnees.get("montant") ?? ""));
  if (montant === null || montant <= 0) {
    return { ok: false, message: "Indique le montant à rembourser, en francs entiers (par exemple 2 500)." };
  }

  // Le chemin de l'argent vit dans `rembourserUneVente` depuis le 08/10 : la
  // demande de remboursement acceptée passe par le même.
  const suite = await rembourserUneVente({
    orderItemId,
    montant,
    parId: utilisateur.id,
    motifInterne: "Remboursement demandé par le vendeur",
  });

  if (!suite.ok) return suite;
  revalidatePath("/dashboard/ventes");
  return { ok: true, message: `Remboursement enregistré. Ton solde est débité de ${suite.montant}.` };
}
