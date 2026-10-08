-- AlterEnum
ALTER TYPE "PlanCode" ADD VALUE 'LIBRE';

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "includesPaidResources" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "openForSubscription" BOOLEAN NOT NULL DEFAULT false;

