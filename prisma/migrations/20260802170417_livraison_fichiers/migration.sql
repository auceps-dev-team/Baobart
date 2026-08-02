-- CreateEnum
CREATE TYPE "Plateforme" AS ENUM ('ANDROID', 'IPHONE', 'AUTRE');

-- AlterEnum
BEGIN;
CREATE TYPE "ConsumptionType_new" AS ENUM ('DOWNLOAD', 'DOWNLOAD_ALL', 'FOLDER_DOWNLOAD', 'LISTEN', 'READ', 'VIEW', 'WATCH');
ALTER TABLE "ConsumptionEvent" ALTER COLUMN "eventType" TYPE "ConsumptionType_new" USING ("eventType"::text::"ConsumptionType_new");
ALTER TYPE "ConsumptionType" RENAME TO "ConsumptionType_old";
ALTER TYPE "ConsumptionType_new" RENAME TO "ConsumptionType";
DROP TYPE "public"."ConsumptionType_old";
COMMIT;

-- AlterTable
ALTER TABLE "ConsumptionEvent" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "orderItemId" TEXT,
ADD COLUMN     "productFileId" TEXT,
DROP COLUMN "platform",
ADD COLUMN     "platform" "Plateforme" NOT NULL DEFAULT 'AUTRE';

-- CreateIndex
CREATE INDEX "ConsumptionEvent_orderItemId_idx" ON "ConsumptionEvent"("orderItemId");

