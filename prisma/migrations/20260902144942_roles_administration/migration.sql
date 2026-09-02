-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlatformRole" ADD VALUE 'CONTENT_MANAGER';
ALTER TYPE "PlatformRole" ADD VALUE 'MARKETING';
ALTER TYPE "PlatformRole" ADD VALUE 'MODERATOR';
ALTER TYPE "PlatformRole" ADD VALUE 'SUPPORT';
ALTER TYPE "PlatformRole" ADD VALUE 'ACCOUNTANT';
ALTER TYPE "PlatformRole" ADD VALUE 'COMPLIANCE';
