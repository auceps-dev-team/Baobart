-- Les réseaux sociaux d'une vitrine : deux colonnes deviennent une table.
--
-- `Profile.instagram` et `Profile.behance` rangeaient un pseudo nu. La maquette
-- (Design System, « 05 · Logos réseaux ») en dessine douze, et une adresse
-- complète dit mieux où mène un lien qu'un pseudo (LinkedIn `/in/` ou
-- `/company/`, YouTube `@chaine` ou `/channel/`).
--
-- L'ordre compte : la table d'abord, la recopie ensuite, les colonnes en
-- dernier. Prisma proposait l'inverse, et la recopie n'aurait plus rien lu.

-- CreateEnum
CREATE TYPE "SocialNetwork" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'DRIBBBLE', 'FIGMA', 'TIKTOK', 'BEHANCE', 'YOUTUBE', 'X', 'PINTEREST', 'WHATSAPP', 'THREADS');

-- CreateTable
CREATE TABLE "ProfileLink" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "network" "SocialNetwork" NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileLink_profileId_network_key" ON "ProfileLink"("profileId", "network");

-- AddForeignKey
ALTER TABLE "ProfileLink" ADD CONSTRAINT "ProfileLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les pseudos déjà rangés, recopiés en adresses. Mêmes formes que
-- `lib/reseaux/reseaux.ts` (pseudo nu → adresse). Une valeur qui n'a pas la
-- forme d'un pseudo n'est pas recopiée : on ne saurait pas où elle mène, et
-- c'est précisément ce qu'une pastille ne doit pas faire.
INSERT INTO "ProfileLink" ("id", "profileId", "network", "url", "updatedAt")
SELECT gen_random_uuid()::text, p."id", 'INSTAGRAM',
       'https://www.instagram.com/' || regexp_replace(btrim(p."instagram"), '^@', '') || '/',
       CURRENT_TIMESTAMP
FROM "Profile" p
WHERE regexp_replace(btrim(coalesce(p."instagram", '')), '^@', '') ~ '^[A-Za-z0-9._]{1,30}$';

INSERT INTO "ProfileLink" ("id", "profileId", "network", "url", "updatedAt")
SELECT gen_random_uuid()::text, p."id", 'BEHANCE',
       'https://www.behance.net/' || regexp_replace(btrim(p."behance"), '^@', ''),
       CURRENT_TIMESTAMP
FROM "Profile" p
WHERE regexp_replace(btrim(coalesce(p."behance", '')), '^@', '') ~ '^[A-Za-z0-9_-]{3,40}$';

-- Le domaine de chaque réseau, seule l'application le connaît. La base garde
-- au moins ceci : rien d'autre que du https sous un logo.
ALTER TABLE "ProfileLink" ADD CONSTRAINT "ProfileLink_url_https" CHECK ("url" LIKE 'https://%');

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "behance",
DROP COLUMN "instagram";
