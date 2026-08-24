-- ============================================================================
-- INTÉGRITÉ DES COLLECTIONS
-- Une sauvegarde cible soit un shot, soit un produit, jamais les deux et jamais
-- aucun. Prisma ne sait pas exprimer cette contrainte XOR ; Postgres oui.
-- ============================================================================

ALTER TABLE "Save"
ADD CONSTRAINT "Save_exactly_one_target"
CHECK (num_nonnulls("workItemId", "productId") = 1);
