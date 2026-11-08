-- « Créateur vérifié » : une seule vérité, `UserBadge`, et son reflet sur le
-- profil (`Profile.isVerified`), désormais écrit dans la même transaction
-- (`lib/badges/attribution.ts`).
--
-- Jusqu'au 05/11/2026, les deux vivaient chacun de leur côté : les scripts de
-- démonstration posaient `isVerified` sans badge, et l'écran des statuts (lot 1)
-- posait le badge sans `isVerified`. Les deux requêtes ci-dessous les alignent
-- dans les deux sens, sans rien retirer. Aucune donnée n'est perdue : on ne fait
-- qu'ajouter ce qui manquait de l'un ou de l'autre côté.

-- La ligne `Badge`, si aucun seed ne l'a posée (même nom que le catalogue).
INSERT INTO "Badge" ("id", "code", "name", "description", "criteria")
SELECT gen_random_uuid()::text, 'VERIFIED_CREATOR', 'Créateur vérifié',
       'Vérification manuelle par l''administration : pièce d''identité et cohérence du portfolio.', '{}'
WHERE NOT EXISTS (SELECT 1 FROM "Badge" WHERE "code" = 'VERIFIED_CREATOR');

-- Profil vérifié sans badge : le badge est posé.
INSERT INTO "UserBadge" ("id", "userId", "badgeId", "awardedAt")
SELECT gen_random_uuid()::text, p."userId", b."id", CURRENT_TIMESTAMP
FROM "Profile" p
CROSS JOIN "Badge" b
WHERE b."code" = 'VERIFIED_CREATOR' AND p."isVerified" = true
ON CONFLICT ("userId", "badgeId") DO NOTHING;

-- Badge sans profil vérifié : le reflet est posé.
UPDATE "Profile" p
SET "isVerified" = true
FROM "UserBadge" ub
JOIN "Badge" b ON b."id" = ub."badgeId"
WHERE b."code" = 'VERIFIED_CREATOR' AND ub."userId" = p."userId" AND p."isVerified" = false;
