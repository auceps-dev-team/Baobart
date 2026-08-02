-- AlterTable
ALTER TABLE "User" ADD COLUMN     "refundsDisabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RiskStateChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromState" "UserRiskState" NOT NULL,
    "toState" "UserRiskState" NOT NULL,
    "author" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskStateChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskStateChange_userId_createdAt_idx" ON "RiskStateChange"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskStateChange_userId_author_createdAt_idx" ON "RiskStateChange"("userId", "author", "createdAt");

-- AddForeignKey
ALTER TABLE "RiskStateChange" ADD CONSTRAINT "RiskStateChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

