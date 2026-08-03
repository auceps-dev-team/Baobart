import "server-only";

import type { IntentionCompte } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Ce qu'un compte peut faire.
 *
 * Traduit `user.rb#is_buyer?` du dépôt Gumroad :
 *
 *     def is_buyer?
 *       !links.exists? && purchases.successful.exists?
 *     end
 *
 * Autrement dit : **aucune colonne de rôle**. On est acheteur parce qu'on a
 * acheté sans jamais publier ; on est créateur parce qu'on a publié. La capacité
 * se lit dans ce qu'on a fait, pas dans un champ qu'un administrateur pourrait
 * cocher — et personne ne peut donc « être créateur » sans l'être vraiment.
 *
 * L'intention déclarée à l'inscription vit à côté : elle oriente l'accueil,
 * elle n'autorise rien.
 */

export interface Capacites {
  /** A publié au moins une ressource. */
  estCreateur: boolean;
  /** A acheté sans jamais publier — la définition de Gumroad. */
  estAcheteur: boolean;
  /** Ce que la personne a déclaré vouloir faire en s'inscrivant. */
  intention: IntentionCompte;
  /** Tableau de bord d'arrivée. */
  vueParDefaut: "acheteur" | "createur";
}

export async function capacitesDe(userId: string): Promise<Capacites> {
  const [compte, produitsPublies, achatsReussis] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { intention: true },
    }),
    db.product.count({
      where: { sellerId: userId, status: "PUBLISHED" },
    }),
    db.orderItem.count({
      where: {
        state: { in: ["SUCCESSFUL", "NOT_CHARGED"] },
        order: { buyerId: userId },
      },
    }),
  ]);

  const estCreateur = produitsPublies > 0;

  return {
    estCreateur,
    estAcheteur: !estCreateur && achatsReussis > 0,
    intention: compte.intention,
    // Qui a publié voit sa boutique, quoi qu'il ait déclaré à l'inscription :
    // le fait l'emporte sur l'intention. Sinon un créateur inscrit « acheteur »
    // atterrirait sur un tableau de bord qui ignore ses ventes.
    vueParDefaut:
      estCreateur || compte.intention === "CREATEUR" ? "createur" : "acheteur",
  };
}

/** Version sans requête, pour les cas où l'on a déjà les compteurs. */
export function deduireCapacites(input: {
  produitsPublies: number;
  achatsReussis: number;
  intention: IntentionCompte;
}): Capacites {
  const estCreateur = input.produitsPublies > 0;

  return {
    estCreateur,
    estAcheteur: !estCreateur && input.achatsReussis > 0,
    intention: input.intention,
    vueParDefaut:
      estCreateur || input.intention === "CREATEUR" ? "createur" : "acheteur",
  };
}
