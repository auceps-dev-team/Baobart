-- Rien ne disait où envoyer l'argent d'un créateur : `Payout.accountRef`
-- existait, mais aucune table ne portait le numéro mobile money ou l'IBAN.
-- Un modèle à part plutôt qu'un champ sur User : un numéro change, et savoir
-- quand il a changé est ce qui permet de repérer le schéma classique — le
-- changer juste avant un versement.
CREATE TABLE "PayoutAccount" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "method"     "PayoutMethod" NOT NULL,
  "provider"   TEXT NOT NULL,
  "accountRef" TEXT NOT NULL,
  "holderName" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "deletedAt"  TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayoutAccount_userId_deletedAt_idx" ON "PayoutAccount"("userId", "deletedAt");

ALTER TABLE "PayoutAccount"
  ADD CONSTRAINT "PayoutAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Arrêter de payer quelqu'un sans couper sa boutique. Confondre les deux
-- obligerait à suspendre un créateur — donc à retirer ses produits — pour
-- retenir un virement le temps d'une enquête.
ALTER TABLE "User" ADD COLUMN "payoutsPausedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "payoutsPausedReason" TEXT;
