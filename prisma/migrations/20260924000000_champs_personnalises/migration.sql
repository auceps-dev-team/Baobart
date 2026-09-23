-- DropIndex
DROP INDEX "CustomField_productId_idx";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "customFields" JSONB;

-- CreateIndex
CREATE INDEX "CustomField_productId_position_idx" ON "CustomField"("productId", "position");

