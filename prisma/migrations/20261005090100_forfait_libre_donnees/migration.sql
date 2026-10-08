-- Le forfait Accès libre (décidé le 05/10) : gratuit, ouvert à la
-- souscription, « tout sauf le payant ». Une donnée de référence, posée par la
-- migration pour exister partout, et reprise par prisma/seed.ts.
--
-- À part du schéma : PostgreSQL refuse d'employer une valeur d'énumération
-- dans la transaction qui vient de l'ajouter.
INSERT INTO "Plan" ("id", "code", "name", "priceMonthly", "downloadsPerMonth", "licenseIncluded", "shieldLevel", "features", "openForSubscription", "includesPaidResources")
VALUES ('plan_acces_libre', 'LIBRE', 'Accès libre', 0, NULL, NULL, 'NONE', '{}', true, false)
ON CONFLICT ("code") DO UPDATE SET "openForSubscription" = true, "includesPaidResources" = false;
