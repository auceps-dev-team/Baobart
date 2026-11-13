-- Les avis notés sur les ressources, et la réponse du créateur (lot 4, 09/11/2026).
--
-- Un avis par compte et par ressource ; une réponse par avis. Les compteurs
-- par étoile ("ratingStars") sont recomptés à chaque écriture, jamais
-- incrémentés (lib/avis/recompte.ts). La note va de 1 à 5 : la base le refuse
-- autrement, quoi que fasse le code.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ratingStars" INTEGER[] DEFAULT ARRAY[0, 0, 0, 0, 0]::INTEGER[];

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReviewResponse" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReviewResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductReview_productId_createdAt_idx" ON "ProductReview"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_authorId_productId_key" ON "ProductReview"("authorId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReviewResponse_reviewId_key" ON "ProductReviewResponse"("reviewId");

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReviewResponse" ADD CONSTRAINT "ProductReviewResponse_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ProductReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReviewResponse" ADD CONSTRAINT "ProductReviewResponse_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- La note entre 1 et 5, au niveau de la base.
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5);

-- Les courriels des avis : au vendeur pour un avis reçu, à l'auteur pour une réponse.
ALTER TYPE "EmailTemplate" ADD VALUE 'AVIS_RECU';
ALTER TYPE "EmailTemplate" ADD VALUE 'REPONSE_AVIS';
