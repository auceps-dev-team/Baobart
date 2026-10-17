/**
 * Pose la provenance sur les fichiers vendus DÉJÀ en base — point d'entrée.
 *
 *   pnpm provenance:poser                 → dit combien de fichiers, sans rien toucher
 *   pnpm provenance:poser -- --appliquer  → grave le fichier livré, sort les copies de référence
 *
 * Les nouveaux téléversements sont traités à la volée (`lib/upload/service.ts`).
 * Ce script rattrape l'existant : à lancer une fois après ce déploiement, et
 * après tout jeu de démonstration. Il se rejoue sans risque — graver deux fois
 * ajoute un second paquet XMP, sans rien casser, mais mieux vaut ne pas.
 * Voir `lib/upload/provenance.ts`.
 */

import { db } from "@/lib/db";
import { poserLaProvenance } from "@/lib/upload/provenance";

async function principal(): Promise<void> {
  const appliquer = process.argv.includes("--appliquer");

  // Les fichiers VENDUS hébergés chez nous (pas les liens externes), avec leur
  // média : poserLaProvenance écartera de lui-même ceux qui ne sont pas des
  // images gravables.
  const fichiers = await db.productFile.findMany({
    where: { role: "SOURCE", deletedAt: null, externalUrl: null, mediaId: { not: null } },
    select: {
      filename: true,
      media: { select: { id: true, s3Key: true, sizeBytes: true, contentType: true } },
      product: {
        select: {
          licenseType: { select: { title: true } },
          seller: { select: { profile: { select: { username: true } } } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  console.log(`${fichiers.length} fichier(s) source hébergé(s) à examiner.`);
  if (!appliquer) {
    console.log("SIMULATION — rien n'a changé (ajouter --appliquer).");
    return;
  }

  let graves = 0;
  let references = 0;
  for (const f of fichiers) {
    if (!f.media) continue;
    const issue = await poserLaProvenance({
      mediaId: f.media.id,
      s3Key: f.media.s3Key,
      taille: f.media.sizeBytes ?? 0,
      contentType: f.media.contentType,
      pseudo: f.product.seller.profile?.username ?? null,
      licenceTitre: f.product.licenseType?.title ?? null,
    });
    if (issue.grave) graves += 1;
    if (issue.reference) references += 1;
    console.log(
      `${issue.grave ? "gravé   " : "passé   "} ${issue.reference ? "+ réf" : "     "}  ${f.filename}`,
    );
  }

  console.log(`\n${graves} fichier(s) gravé(s), ${references} copie(s) de référence.`);
}

principal()
  .catch((cause) => {
    console.error(cause);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
