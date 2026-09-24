-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('FIXED', 'LIBRE');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "tipAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "minPrice" INTEGER,
ADD COLUMN     "pricingMode" "PricingMode" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "suggestedPrices" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tipsEnabled" BOOLEAN NOT NULL DEFAULT false;

