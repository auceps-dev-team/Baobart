-- Recompte salesCount depuis les lignes encaissées.
--
-- La colonne était lue par les statistiques, le profil public et les cartes du
-- fil, et écrite par aucun code : « 0 ventes » sur les 127 ressources (mesuré le
-- 25/09, Qualitytest S34). encaisserLigne la tient à jour désormais ; cette
-- migration rattrape le passé, une fois. Idempotente : la relancer ne change rien.
UPDATE "Product" AS p
SET "salesCount" = COALESCE(v.n, 0)
FROM "Product" AS q
LEFT JOIN (
  SELECT "productId", COUNT(*)::int AS n
  FROM "OrderItem"
  WHERE "state" IN ('SUCCESSFUL', 'NOT_CHARGED')
  GROUP BY "productId"
) AS v ON v."productId" = q."id"
WHERE p."id" = q."id"
  AND p."salesCount" IS DISTINCT FROM COALESCE(v.n, 0);
