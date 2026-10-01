-- Recompte participantsCount depuis les inscriptions réelles.
--
-- L'effacement RGPD supprimait les inscriptions sans rendre les places : un
-- événement pouvait se dire complet avec des places libres (mesuré le 25/09,
-- Qualitytest S9 et S39). anonymiser() les rend désormais ; cette migration
-- rattrape les écarts déjà en base, une fois. Idempotente.
UPDATE "Event" AS e
SET "participantsCount" = COALESCE(r.n, 0)
FROM "Event" AS f
LEFT JOIN (
  SELECT "eventId", COUNT(*)::int AS n
  FROM "EventRegistration"
  GROUP BY "eventId"
) AS r ON r."eventId" = f."id"
WHERE e."id" = f."id"
  AND e."participantsCount" IS DISTINCT FROM COALESCE(r.n, 0);
