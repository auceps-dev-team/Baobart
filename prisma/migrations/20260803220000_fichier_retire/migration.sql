-- Retirer un fichier d'une ressource déjà vendue détruisait ses octets : les
-- acheteurs perdaient définitivement ce qu'ils avaient payé, sans recours.
-- La ligne est désormais marquée plutôt qu'effacée, et l'objet reste au
-- stockage (`Deletable` chez Gumroad).
ALTER TABLE "ProductFile" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Les listes filtrent toutes sur « non retiré » : l'index doit le porter.
DROP INDEX IF EXISTS "ProductFile_productId_role_idx";
CREATE INDEX "ProductFile_productId_role_deletedAt_idx"
  ON "ProductFile"("productId", "role", "deletedAt");
