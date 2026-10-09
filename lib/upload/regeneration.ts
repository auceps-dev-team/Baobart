import "server-only";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { ancienneCleDApercu, produireApercu } from "@/lib/upload/apercu";
import { pseudoDe } from "@/lib/upload/service";
import { listerObjets, PREFIXE_PUBLIC, supprimerObjet, urlPublique } from "@/lib/upload/storage";

/**
 * Refait les aperçus publiés avant le filigrane (v1.86.0).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI IL NE SUFFIT PAS DE CHANGER LA RECETTE
 *
 * Les aperçus déjà publiés restent ce qu'ils étaient — 1 400 px, sans marque —
 * à une adresse publique, servie « immutable » pour un an. Tant qu'ils
 * existent, la protection ne protège que les envois à venir. Celui-ci refait
 * chaque ancien aperçu sous sa nouvelle clé, repointe la couverture, puis
 * SUPPRIME l'ancien objet : une adresse connue d'un robot ne doit plus rien
 * rendre.
 *
 * Un ancien aperçu qu'on ne sait pas refaire (source disparue, format qui ne
 * s'y prête plus) n'est PAS supprimé : la couverture deviendrait vide sans
 * que personne l'ait décidé. Il est rapporté, nommément.
 */

export type Issue =
  | { cle: string; issue: "REFAIT"; couvertures: number }
  | { cle: string; issue: "ORPHELIN_SUPPRIME" }
  | { cle: string; issue: "ECHEC"; raison: string };

/** `public/apercus/<id>.webp`, sans suffixe de version : l'ancienne recette. */
const ANCIENNE = new RegExp(`^${PREFIXE_PUBLIC}apercus/([^/]+?)\\.webp$`);

export function mediaDeLAncienneCle(cle: string): string | null {
  const id = ANCIENNE.exec(cle)?.[1];
  return id && !/-v\d+$/.test(id) ? id : null;
}

export async function regenererApercus(options: { appliquer: boolean }): Promise<Issue[]> {
  const anciennes = (await listerObjets(`${PREFIXE_PUBLIC}apercus/`))
    .map((o) => o.cle)
    .filter((cle) => mediaDeLAncienneCle(cle) !== null);

  const issues: Issue[] = [];

  for (const cle of anciennes) {
    const mediaId = mediaDeLAncienneCle(cle)!;
    const ancienneUrl = urlPublique(ancienneCleDApercu(mediaId));
    const ouCouverture = { OR: [{ coverImageId: mediaId }, { coverUrl: ancienneUrl }] };

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
      const enUsage = await db.product.count({ where: ouCouverture });
      if (enUsage > 0) {
        issues.push({ cle, issue: "ECHEC", raison: "média disparu, mais encore en couverture" });
        continue;
      }
      if (options.appliquer) await supprimerObjet(cle);
      issues.push({ cle, issue: "ORPHELIN_SUPPRIME" });
      continue;
    }

    const nomFichier = media.productFiles[0]?.filename;
    if (!nomFichier) {
      issues.push({ cle, issue: "ECHEC", raison: "aucun fichier rattaché : format inconnu" });
      continue;
    }

    if (!options.appliquer) {
      const couvertures = await db.product.count({ where: ouCouverture });
      issues.push({ cle, issue: "REFAIT", couvertures });
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
      issues.push({ cle, issue: "ECHEC", raison: "aperçu non produit (voir le journal)" });
      continue;
    }

    const { count: couvertures } = await db.product.updateMany({
      where: ouCouverture,
      data: { coverUrl: apercu.url, coverImageId: media.id },
    });
    await supprimerObjet(cle);
    issues.push({ cle, issue: "REFAIT", couvertures });
  }

  journal.info("régénération des aperçus", {
    appliquer: options.appliquer,
    anciennes: anciennes.length,
    refaits: issues.filter((i) => i.issue === "REFAIT").length,
    echecs: issues.filter((i) => i.issue === "ECHEC").length,
  });

  return issues;
}
