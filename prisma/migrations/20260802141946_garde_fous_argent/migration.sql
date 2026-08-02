-- DropForeignKey
ALTER TABLE "Balance" DROP CONSTRAINT "Balance_userId_fkey";

-- DropForeignKey
ALTER TABLE "BalanceTransaction" DROP CONSTRAINT "BalanceTransaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_userId_fkey";

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceTransaction" ADD CONSTRAINT "BalanceTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- GARDE-FOUS DU GRAND LIVRE
-- Ces règles ne sont pas exprimables dans le schéma Prisma. Elles sont posées
-- ici parce qu'une invariante monétaire qui ne vit que dans le code applicatif
-- finit toujours par être contournée par un script, une migration ou un job.
-- ============================================================================

-- 1. Les montants d'un solde sont FIGÉS dès qu'il quitte l'état UNPAID.
--    Porté de balance.rb (validate_amounts_are_only_changed_when_unpaid).
--    Sans ça, une vente tardive peut modifier un versement déjà en cours.
CREATE OR REPLACE FUNCTION baobart_balance_amounts_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.state <> 'UNPAID'
     AND (NEW.amount IS DISTINCT FROM OLD.amount
          OR NEW."holdingAmount" IS DISTINCT FROM OLD."holdingAmount") THEN
    RAISE EXCEPTION
      'Solde %: les montants ne sont modifiables qu''en etat UNPAID (etat actuel: %)',
      OLD.id, OLD.state;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER balance_amounts_frozen
BEFORE UPDATE ON "Balance"
FOR EACH ROW EXECUTE FUNCTION baobart_balance_amounts_frozen();

-- 2. Le grand livre est IMMUABLE : ni UPDATE ni DELETE.
--    Une erreur se corrige par une écriture inverse, jamais par réécriture.
--    C'est aussi ce qui rend un audit possible.
CREATE OR REPLACE FUNCTION baobart_balance_transaction_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'BalanceTransaction est immuable: ni UPDATE ni DELETE. Corriger par une ecriture inverse.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER balance_transaction_immutable
BEFORE UPDATE OR DELETE ON "BalanceTransaction"
FOR EACH ROW EXECUTE FUNCTION baobart_balance_transaction_immutable();
