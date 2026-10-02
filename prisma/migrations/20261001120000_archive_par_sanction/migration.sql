-- AlterTable
-- Marque les ressources qu'une suspension de compte a archivées, pour que la
-- levée les rende — et elles seules. Sans cette marque, la levée ne pouvait rien
-- rendre : on ne savait pas ce que le créateur avait retiré lui-même (mesuré le
-- 25/09, Qualitytest S5 : 7 ressources restées archivées après la levée).
ALTER TABLE "Product" ADD COLUMN "archivedByRiskAt" TIMESTAMP(3);
