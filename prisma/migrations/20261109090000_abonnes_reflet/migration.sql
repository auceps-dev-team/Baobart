-- Les compteurs d'abonnés, réalignés sur les lignes `Follow` (inventaire B8).
--
-- `lib/social/service.ts` recomptait les abonnés à chaque suivi et écrivait
-- `User.followersCount` — mais la vitrine, l'annuaire, les collections et le
-- tableau de bord lisent `Profile.followerCount`, que personne n'écrivait.
-- Relevé le 08/11/2026 par la relecture d'Argon : Aya Kouassi, 1 abonné en
-- base, en affichait 0. Le service écrit désormais les deux ; ceci aligne
-- l'existant. Rejouable : on recompte, on n'ajoute pas.

UPDATE "Profile" p
SET "followerCount" = (SELECT count(*) FROM "Follow" f WHERE f."followingId" = p."userId");

UPDATE "User" u
SET "followersCount" = (SELECT count(*) FROM "Follow" f WHERE f."followingId" = u."id");
