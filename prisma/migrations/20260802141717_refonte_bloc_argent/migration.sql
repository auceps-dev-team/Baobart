-- CreateEnum
CREATE TYPE "PurchaseState" AS ENUM ('IN_PROGRESS', 'SUCCESSFUL', 'FAILED', 'NOT_CHARGED');

-- CreateEnum
CREATE TYPE "BalanceState" AS ENUM ('UNPAID', 'PROCESSING', 'PAID', 'FORFEITED');

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';
COMMIT;

-- DropIndex
DROP INDEX "Balance_userId_key";

-- DropIndex
DROP INDEX "BalanceTransaction_userId_createdAt_idx";

-- DropIndex
DROP INDEX "BalanceTransaction_userId_status_idx";

-- AlterTable
ALTER TABLE "Balance" DROP COLUMN "held",
DROP COLUMN "paid",
DROP COLUMN "unpaid",
ADD COLUMN     "amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "date" DATE NOT NULL,
ADD COLUMN     "holdingAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "holdingCurrency" "Currency" NOT NULL DEFAULT 'XOF',
ADD COLUMN     "payoutId" TEXT,
ADD COLUMN     "state" "BalanceState" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "BalanceTransaction" DROP COLUMN "amount",
DROP COLUMN "currency",
DROP COLUMN "status",
ADD COLUMN     "balanceId" TEXT NOT NULL,
ADD COLUMN     "holdingCurrency" "Currency" NOT NULL,
ADD COLUMN     "holdingGross" INTEGER NOT NULL,
ADD COLUMN     "holdingNet" INTEGER NOT NULL,
ADD COLUMN     "issuedCurrency" "Currency" NOT NULL,
ADD COLUMN     "issuedGross" INTEGER NOT NULL,
ADD COLUMN     "issuedNet" INTEGER NOT NULL,
ADD COLUMN     "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "refundId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "affiliateFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "processorFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "state" "PurchaseState" NOT NULL DEFAULT 'IN_PROGRESS',
ADD COLUMN     "taxAmount" INTEGER NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "BalanceTransactionStatus";

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'XOF',
    "reason" TEXT,
    "processorRef" TEXT,
    "refundedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refund_orderItemId_idx" ON "Refund"("orderItemId");

-- CreateIndex
CREATE INDEX "Refund_createdAt_idx" ON "Refund"("createdAt");

-- CreateIndex
CREATE INDEX "Balance_state_date_idx" ON "Balance"("state", "date");

-- CreateIndex
CREATE INDEX "Balance_userId_state_idx" ON "Balance"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Balance_userId_date_holdingCurrency_key" ON "Balance"("userId", "date", "holdingCurrency");

-- CreateIndex
CREATE INDEX "BalanceTransaction_userId_occurredAt_idx" ON "BalanceTransaction"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "BalanceTransaction_balanceId_idx" ON "BalanceTransaction"("balanceId");

-- CreateIndex
CREATE INDEX "BalanceTransaction_orderItemId_idx" ON "BalanceTransaction"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderItem_state_createdAt_idx" ON "OrderItem"("state", "createdAt");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceTransaction" ADD CONSTRAINT "BalanceTransaction_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "Balance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

