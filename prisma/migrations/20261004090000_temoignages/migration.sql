-- Témoignages : proposés par les membres, publiés par l'administration (demandé le 04/10).
-- Remplacent les quatre témoignages inventés de la maquette.
-- Généré par prisma migrate diff (base d'ombre baobart_shadow, nommée en clair).

-- CreateEnum
CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "role" TEXT,
    "status" "TestimonialStatus" NOT NULL DEFAULT 'PENDING',
    "refusedReason" TEXT,
    "moderatorId" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "consentAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Testimonial_authorId_key" ON "Testimonial"("authorId");

-- CreateIndex
CREATE INDEX "Testimonial_status_publishedAt_idx" ON "Testimonial"("status", "publishedAt");

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

