-- Like et Comment portaient sur WorkItem seulement. Une ressource déposée par
-- le formulaire « Publier » n'a pas de WorkItem : elle était donc impossible à
-- aimer ou à commenter. On leur donne la forme polymorphe déjà retenue pour
-- `Save`.

-- ── Like ────────────────────────────────────────────────────────────────────
ALTER TABLE "Like" ALTER COLUMN "workItemId" DROP NOT NULL;
ALTER TABLE "Like" ADD COLUMN "productId" TEXT;

ALTER TABLE "Like"
  ADD CONSTRAINT "Like_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Like_userId_productId_key" ON "Like"("userId", "productId");
CREATE INDEX "Like_productId_idx" ON "Like"("productId");
CREATE INDEX "Like_userId_createdAt_idx" ON "Like"("userId", "createdAt");

-- Exactement une cible. Prisma ne sait pas exprimer cette règle ; sans elle,
-- un like sans cible — ou avec les deux — passerait, et les compteurs
-- dénormalisés dériveraient sans qu'on sache d'où.
ALTER TABLE "Like"
  ADD CONSTRAINT "Like_cible_unique"
  CHECK (num_nonnulls("workItemId", "productId") = 1);

-- ── Comment ─────────────────────────────────────────────────────────────────
ALTER TABLE "Comment" ALTER COLUMN "workItemId" DROP NOT NULL;
ALTER TABLE "Comment" ADD COLUMN "productId" TEXT;
-- Un commentaire retiré laisse sa place : effacer la ligne emporterait par
-- cascade les réponses qui s'y accrochent.
ALTER TABLE "Comment" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Comment_productId_createdAt_idx" ON "Comment"("productId", "createdAt");

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_cible_unique"
  CHECK (num_nonnulls("workItemId", "productId") = 1);

-- ── Compteurs dénormalisés ──────────────────────────────────────────────────
ALTER TABLE "Product" ADD COLUMN "likesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "commentsCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD COLUMN "followersCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "followingCount" INTEGER NOT NULL DEFAULT 0;

-- Les comptes existants ont peut-être déjà des abonnés : on part du réel
-- plutôt que de zéro, sinon le premier suivi ferait tomber le compteur à 1.
UPDATE "User" u SET
  "followersCount" = (SELECT COUNT(*) FROM "Follow" f WHERE f."followingId" = u.id),
  "followingCount" = (SELECT COUNT(*) FROM "Follow" f WHERE f."followerId"  = u.id);

-- On ne peut pas se suivre soi-même. La règle est aussi appliquée côté code,
-- mais elle vaut d'être garantie ici : c'est une impossibilité, pas une
-- préférence d'interface.
ALTER TABLE "Follow"
  ADD CONSTRAINT "Follow_pas_soi_meme"
  CHECK ("followerId" <> "followingId");
