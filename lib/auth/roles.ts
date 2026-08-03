import "server-only";

import { db } from "@/lib/db";

/**
 * Progression d'un compte, d'acheteur à créateur.
 *
 * Il n'existe **aucune colonne de rôle** — c'est le principe vérifié dans
 * `user.rb#is_buyer?` chez Gumroad :
 *
 *     def is_buyer?
 *       !links.exists? && purchases.successful.exists?
 *     end
 *
 * On ne devient pas créateur parce qu'on l'a déclaré, mais parce qu'on a fait
 * quelque chose. Deux gestes, deux paliers :
 *
 *   ACHETEUR   rien créé. Le tableau de bord acheteur, plus une seule porte :
 *              « Ajouter un produit ».
 *   ATELIER    au moins un produit, aucun publié. Les entrées créateur
 *              apparaissent, grisées, sauf celles qui servent à travailler le
 *              brouillon — sinon on ne pourrait pas atteindre ce qu'on vient
 *              de créer.
 *   BOUTIQUE   au moins un produit publié. Tout est ouvert, et le profil
 *              public existe.
 *
 * La progression peut REVENIR en arrière : supprimer son unique brouillon
 * ramène à l'état acheteur, plutôt que de laisser une interface morte.
 *
 * ⚠️ Sauf s'il y a de l'argent en jeu. Un compte qui a vendu puis tout retiré
 * garde sa boutique : masquer « Gains » à quelqu'un à qui l'on doit de l'argent
 * serait une faute, pas une simplification. C'est le seul cas où la régression
 * ne s'applique pas.
 */

export type EtapeCompte = "ACHETEUR" | "ATELIER" | "BOUTIQUE";

export interface Progression {
  etape: EtapeCompte;
  /** A au moins un produit, publié ou non. */
  aDesProduits: boolean;
  /** A au moins un produit publié. */
  aPublie: boolean;
  /**
   * A vendu, ou a de l'argent au grand livre. Empêche toute régression :
   * l'historique ne se cache pas.
   */
  aUnHistorique: boolean;
  /** Le profil public n'existe qu'une fois quelque chose publié. */
  profilPublicVisible: boolean;
}

export function deduireProgression(input: {
  produits: number;
  produitsPublies: number;
  ecrituresAuGrandLivre: number;
}): Progression {
  const aDesProduits = input.produits > 0;
  const aPublie = input.produitsPublies > 0;
  const aUnHistorique = input.ecrituresAuGrandLivre > 0;

  const etape: EtapeCompte =
    aPublie || aUnHistorique
      ? "BOUTIQUE"
      : aDesProduits
        ? "ATELIER"
        : "ACHETEUR";

  return {
    etape,
    aDesProduits,
    aPublie,
    aUnHistorique,
    // Une vitrine vide dessert le créateur autant que le visiteur : le profil
    // public n'apparaît qu'avec quelque chose à montrer.
    profilPublicVisible: aPublie,
  };
}

export async function progressionDe(userId: string): Promise<Progression> {
  const [produits, produitsPublies, ecrituresAuGrandLivre] = await Promise.all([
    db.product.count({ where: { sellerId: userId } }),
    db.product.count({ where: { sellerId: userId, status: "PUBLISHED" } }),
    db.balanceTransaction.count({ where: { userId } }),
  ]);

  return deduireProgression({ produits, produitsPublies, ecrituresAuGrandLivre });
}
