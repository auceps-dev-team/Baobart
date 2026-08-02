-- CreateEnum
CREATE TYPE "ProductFamily" AS ENUM ('ILLUSTRATION', 'PHOTO', 'MOCKUP', 'FONT', 'ICONE', 'LOGO', 'PACK', 'ART', 'AUDIO', 'VIDEO');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "family" "ProductFamily";

-- CreateIndex
CREATE INDEX "Product_status_family_createdAt_id_idx" ON "Product"("status", "family", "createdAt", "id");

