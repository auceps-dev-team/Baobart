-- AlterTable
ALTER TABLE "OfferCode" ADD COLUMN     "disabledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "listPrice" INTEGER,
ADD COLUMN     "offerCodeId" TEXT;

-- CreateIndex
CREATE INDEX "OfferCode_sellerId_createdAt_idx" ON "OfferCode"("sellerId", "createdAt");

