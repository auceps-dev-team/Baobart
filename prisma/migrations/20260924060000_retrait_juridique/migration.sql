-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'SUSPENDED';

-- CreateTable
CREATE TABLE "LegalSuspension" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "previousStatus" "ProductStatus" NOT NULL,
    "suspendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),

    CONSTRAINT "LegalSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalSuspension_productId_liftedAt_idx" ON "LegalSuspension"("productId", "liftedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalSuspension_noticeId_productId_key" ON "LegalSuspension"("noticeId", "productId");

-- AddForeignKey
ALTER TABLE "LegalSuspension" ADD CONSTRAINT "LegalSuspension_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "LegalNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalSuspension" ADD CONSTRAINT "LegalSuspension_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

