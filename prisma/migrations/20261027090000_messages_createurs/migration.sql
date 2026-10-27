-- Le bouton « Contact » de la vitrine (Baobart Accueil.dc.html, PROFIL CREATEUR).
--
-- Un message laissé à un créateur est relayé par courriel, l'adresse de
-- l'expéditeur en « Répondre à » : celle du créateur n'est montrée à personne.
-- La table garde chaque envoi pour deux raisons : retrouver un abus signalé à
-- l'équipe par sa référence, et borner les envois par expéditeur
-- (lib/contact/createur.ts). `acceptsMessages` ouvert par défaut, comme la
-- maquette dessine le bouton ; le créateur le ferme depuis son profil.

-- AlterEnum
ALTER TYPE "EmailTemplate" ADD VALUE 'MESSAGE_CREATEUR';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "acceptsMessages" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CreatorMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorMessage_senderId_createdAt_idx" ON "CreatorMessage"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "CreatorMessage_recipientId_createdAt_idx" ON "CreatorMessage"("recipientId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreatorMessage" ADD CONSTRAINT "CreatorMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorMessage" ADD CONSTRAINT "CreatorMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

