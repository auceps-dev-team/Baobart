import "server-only";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { produireApercu } from "@/lib/upload/apercu";
import { pseudoDe } from "@/lib/upload/service";
import { listerObjets, PREFIXE_PUBLIC, supprimerObjet, urlPublique } from "@/lib/upload/storage";
import { mediaDUneClePerimee, VERSION_APERCU } from "@/lib/upload/vignette";

/**
 * Refait les aperçus fabriqués par une recette périmée.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI IL NE SUFFIT PAS DE CHANGER LA RECETTE
 *
 * Les aperçus déjà publiés restent ce qu'ils étaient, à une adresse publique
 * servie « immutable » pour un an : 1 400 px sans marque avant v1.86.0, sans
 * vignette du fil ni métadonnées avant v1.87.0. Tant qu'ils existent, la
 * protection ne protège que les envois à venir. Celui-ci refait chaque média
 * une fois, sous les clés de la recette courante, repointe les couvertures,
 * puis SUPPRIME toutes ses anciennes clés : une adresse connue d'un robot ne
 * doit plus rien rendre.
 *
 * Un média qu'on ne sait pas refaire (source disparue, format qui ne s'y prête
 * plus) garde ses anciens aperçus : supprimer viderait une couverture sans que
 * personne l'ait décidé. Il est rapporté, nommément.
 */

export type Issue =
  | { media: string; cles: string[]; issue: "REFAIT"; couvertures: number }
  | { media: string; cles: string[]; issue: "ORPHELIN_SUPPRIME" }
  | { media: string; cles: string[]; issue: "ECHEC"; raison: string };

export async function regenererApercus(options: { appliquer: boolean }): Promise<Issue[]> {
  // Les clés périmées, regroupées par média : un média de v1.86.0 a sa clé
  // `-v2`, un plus ancien sa clé nue — certains ont les deux.
  const parMedia = new Map<string, string[]>();
  for (const { cle } of await listerObjets(`${PREFIXE_PUBLIC}apercus/`)) {
    const media = mediaDUneClePerimee(cle);
    if (media) parMedia.set(media, [...(parMedia.get(media) ?? []), cle]);
  }

  const issues: Issue[] = [];

  for (const [mediaId, cles] of parMedia) {
    const anciennesUrls = cles.map(urlPublique);
    const ouCouverture = { OR: [{ coverImageId: mediaId }, { coverUrl: { in: anciennesUrls } }] };
    const toutSupprimer = async () => {
      for (const cle of cles) await supprimerObjet(cle);
    };

    const media = await db.mediaAsset.findUnique({
      where: { id: mediaId },
      select: {
        id: true,
        ownerId: true,
        s3Key: true,
        sizeBytes: true,
        productFiles: { select: { filename: true }, take: 1 },
      },
    });

    if (!media) {
      // Plus aucun média : rien ne peut être refait. On ne supprime que si
      // aucune couverture ne pointe encore dessus.
      if ((await db.product.count({ where: ouCouverture })) > 0) {
        issues.push({ media: mediaId, cles, issue: "ECHEC", raison: "média disparu, mais encore en couverture" });
        continue;
      }
      if (options.appliquer) await toutSupprimer();
      issues.push({ media: mediaId, cles, issue: "ORPHELIN_SUPPRIME" });
      continue;
    }

    const nomFichier = media.productFiles[0]?.filename;
    if (!nomFichier) {
      issues.push({ media: mediaId, cles, issue: "ECHEC", raison: "aucun fichier rattaché : format inconnu" });
      continue;
    }

    if (!options.appliquer) {
      const couvertures = await db.product.count({ where: ouCouverture });
      issues.push({ media: mediaId, cles, issue: "REFAIT", couvertures });
      continue;
    }

    const apercu = await produireApercu({
      mediaId: media.id,
      cleSource: media.s3Key,
      nomFichier,
      taille: media.sizeBytes,
      pseudo: await pseudoDe(media.ownerId),
    });
    if (!apercu) {
      issues.push({ media: mediaId, cles, issue: "ECHEC", raison: "aperçu non produit (voir le journal)" });
      continue;
    }

    const { count: couvertures } = await db.product.updateMany({
      where: ouCouverture,
      data: { coverUrl: apercu.url, coverImageId: media.id },
    });
    await toutSupprimer();
    issues.push({ media: mediaId, cles, issue: "REFAIT", couvertures });
  }

  journal.info("régénération des aperçus", {
    appliquer: options.appliquer,
    version: VERSION_APERCU,
    medias: parMedia.size,
    refaits: issues.filter((i) => i.issue === "REFAIT").length,
    echecs: issues.filter((i) => i.issue === "ECHEC").length,
  });

  return issues;
}
