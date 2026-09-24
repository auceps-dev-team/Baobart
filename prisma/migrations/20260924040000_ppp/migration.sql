-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "buyerCountry" TEXT,
ADD COLUMN     "pppDiscountBp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "pppEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pppMaxDiscountBp" INTEGER;

-- CreateTable
CREATE TABLE "PppFactor" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "factorBp" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PppFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PppFactor_country_key" ON "PppFactor"("country");

-- CreateIndex
CREATE INDEX "PppFactor_country_idx" ON "PppFactor"("country");

