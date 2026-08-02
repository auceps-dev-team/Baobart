-- CreateEnum
CREATE TYPE "PayoutFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY');

-- AlterEnum
BEGIN;
CREATE TYPE "PayoutStatus_new" AS ENUM ('CREATING', 'PROCESSING', 'UNCLAIMED', 'COMPLETED', 'CANCELLED', 'FAILED', 'RETURNED', 'REVERSED');
ALTER TABLE "public"."Payout" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payout" ALTER COLUMN "status" TYPE "PayoutStatus_new" USING ("status"::text::"PayoutStatus_new");
ALTER TYPE "PayoutStatus" RENAME TO "PayoutStatus_old";
ALTER TYPE "PayoutStatus_new" RENAME TO "PayoutStatus";
DROP TYPE "public"."PayoutStatus_old";
ALTER TABLE "Payout" ALTER COLUMN "status" SET DEFAULT 'CREATING';
COMMIT;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "cycleDate" DATE,
ADD COLUMN     "periodEnd" DATE,
ALTER COLUMN "status" SET DEFAULT 'CREATING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "payoutFrequency" "PayoutFrequency" NOT NULL DEFAULT 'WEEKLY',
ADD COLUMN     "payoutRail" TEXT;

