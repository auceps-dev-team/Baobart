BEGIN;
INSERT INTO "User" (id,email,"updatedAt") VALUES ('u_test','t@baobart.test',now());
INSERT INTO "Balance" (id,"userId",date,currency,amount,"holdingCurrency","holdingAmount",state,"updatedAt")
  VALUES ('b_test','u_test',CURRENT_DATE,'XOF',10000,'XOF',10000,'UNPAID',now());
\echo '=== 1. UPDATE montant en UNPAID (doit PASSER)'
UPDATE "Balance" SET amount=12000 WHERE id='b_test';
\echo '=== 2. passage en PROCESSING (doit PASSER)'
UPDATE "Balance" SET state='PROCESSING' WHERE id='b_test';
\echo '=== 3. UPDATE montant en PROCESSING (doit ECHOUER)'
SAVEPOINT s3; UPDATE "Balance" SET amount=999999 WHERE id='b_test'; ROLLBACK TO s3;
\echo '=== 4. ecriture au grand livre (doit PASSER)'
INSERT INTO "BalanceTransaction" (id,"userId","balanceId",type,"issuedCurrency","issuedGross","issuedNet","holdingCurrency","holdingGross","holdingNet")
  VALUES ('bt_test','u_test','b_test','SALE','EUR',1000,900,'XOF',655000,589500);
\echo '=== 5. UPDATE du grand livre (doit ECHOUER)'
SAVEPOINT s5; UPDATE "BalanceTransaction" SET "issuedNet"=0 WHERE id='bt_test'; ROLLBACK TO s5;
\echo '=== 6. DELETE du grand livre (doit ECHOUER)'
SAVEPOINT s6; DELETE FROM "BalanceTransaction" WHERE id='bt_test'; ROLLBACK TO s6;
\echo '=== 7. DELETE compte avec ecritures (doit ECHOUER)'
SAVEPOINT s7; DELETE FROM "User" WHERE id='u_test'; ROLLBACK TO s7;
ROLLBACK;
