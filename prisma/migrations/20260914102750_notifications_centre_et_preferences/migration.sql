-- Le centre de notifications, et les preferences par (evenement x canal).
--
-- Les trois colonnes ajoutees a "Notification" sont NOT NULL sans valeur par
-- defaut, ce qui echouerait sur une table peuplee. Elle ne l'est pas : elle
-- existait depuis le premier schema et n'a jamais ete ecrite par le code --
-- c'est d'ailleurs le manque que cette version comble. Si la migration
-- echoue ici, c'est qu'une ligne y a ete posee a la main : la lire avant de
-- decider, plutot que de forcer.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "cle" TEXT NOT NULL,
ADD COLUMN     "corps" TEXT NOT NULL,
ADD COLUMN     "lien" TEXT,
ADD COLUMN     "titre" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "evenement" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_evenement_canal_key" ON "NotificationPreference"("userId", "evenement", "canal");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_cle_key" ON "Notification"("cle");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

