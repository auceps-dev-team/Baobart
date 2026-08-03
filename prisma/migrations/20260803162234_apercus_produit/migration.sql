-- CreateEnum
CREATE TYPE "ProductFileRole" AS ENUM ('SOURCE', 'PREVIEW');

-- DropIndex
DROP INDEX "ProductFile_productId_idx";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "previewKind" TEXT,
ADD COLUMN     "previewUrl" TEXT;

-- AlterTable
ALTER TABLE "ProductFile" ADD COLUMN     "role" "ProductFileRole" NOT NULL DEFAULT 'SOURCE';

-- CreateIndex
CREATE INDEX "ProductFile_productId_role_idx" ON "ProductFile"("productId", "role");
