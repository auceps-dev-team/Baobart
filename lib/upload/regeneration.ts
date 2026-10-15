import "server-only";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { apercuPossible, produireApercu } from "@/lib/upload/apercu";
import { pseudoDe } from "@/lib/upload/service";
import { lireObjet, listerObjets, PREFIXE_PUBLIC, supprimerObjet, urlPublique } from "@/lib/upload/storage";
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
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE SECOND PASSAGE : LES COUVERTURES QUI N'ONT JAMAIS ÉTÉ DES APERÇUS
 *
 * Le premier passage ne voit que les clés sous `public/apercus/` : il refait
 * ce que la fabrique a déjà fabriqué. Une couverture posée par un autre chemin
 * — un jeu de démonstration, une adresse externe — lui échappe entièrement.
 * Mesuré le 15/10/2026 sur la base de développement : 102 couvertures
 * publiées sur 102 dans ce cas, servies en pleine taille sans filigrane, et un
 * test au navigateur les a téléchargées sans que rien ne proteste.
 *
 * Le second passage tire un aperçu du fichier image de la ressource (l'aperçu
 * choisi d'abord, sinon la source) et repointe la couverture. Il ne supprime
 * JAMAIS l'ancienne image : elle n'est pas à nous — une image du dépôt, un
 * objet partagé par plusieurs fiches, une adresse ailleurs.
 */

export type Issue =
  | { media: string; cles: string[]; issue: "REFAIT"; couvertures: number }
  | { media: string; cles: string[]; issue: "ORPHELIN_SUPPRIME" }
  | { media: string; cles: string[]; issue: "ECHEC"; raison: string }
  | { produit: string; ancienne: string; issue: "COUVERTURE_PROTEGEE"; media: string }
  | { produit: string; ancienne: string; issue: "COUVERTURE_ECHEC"; raison: string };

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

  issues.push(...(await protegerLesCouvertures(options)));

  journal.info("régénération des aperçus", {
    appliquer: options.appliquer,
    version: VERSION_APERCU,
    medias: parMedia.size,
    refaits: issues.filter((i) => i.issue === "REFAIT").length,
    echecs: issues.filter((i) => i.issue === "ECHEC").length,
    couverturesProtegees: issues.filter((i) => i.issue === "COUVERTURE_PROTEGEE").length,
    couverturesEnEchec: issues.filter((i) => i.issue === "COUVERTURE_ECHEC").length,
  });

  return issues;
}

/**
 * Le second passage — voir l'en-tête : les couvertures étrangères à
 * `public/apercus/`, refaites depuis le fichier image de leur ressource.
 *
 * Sans `appliquer`, rapporte ce qu'il ferait (`COUVERTURE_PROTEGEE` annoncé)
 * sans rien fabriquer ni écrire — mais après avoir vérifié que la source
 * existe : une simulation qui annonce un succès que l'application démentira
 * est le défaut même que ce passage corrige.
 */
async function protegerLesCouvertures(options: { appliquer: boolean }): Promise<Issue[]> {
  const produits = await db.product.findMany({
    where: { coverUrl: { not: null }, NOT: { coverUrl: { contains: `/${PREFIXE_PUBLIC}apercus/` } } },
    select: {
      id: true,
      coverUrl: true,
      sellerId: true,
      files: {
        where: { deletedAt: null },
        // `desc` sur le rôle : PREVIEW avant SOURCE — l'aperçu choisi par le
        // créateur l'emporte, comme dans `rendreLaVitrineCoherente`.
        orderBy: [{ role: "desc" }, { position: "asc" }],
        select: { filename: true, media: { select: { id: true, s3Key: true, sizeBytes: true } } },
      },
    },
    orderBy: { id: "asc" },
  });

  const issues: Issue[] = [];

  for (const produit of produits) {
    const ancienne = produit.coverUrl!;
    const fichier = produit.files.find((f) => f.media && apercuPossible(f.filename, f.media.sizeBytes));
    if (!fichier?.media) {
      issues.push({ produit: produit.id, ancienne, issue: "COUVERTURE_ECHEC", raison: "aucun fichier image dont tirer un aperçu" });
      continue;
    }

    if (!options.appliquer) {
      issues.push(
        (await lireObjet(fichier.media.s3Key))
          ? { produit: produit.id, ancienne, issue: "COUVERTURE_PROTEGEE", media: fichier.media.id }
          : { produit: produit.id, ancienne, issue: "COUVERTURE_ECHEC", raison: "source absente ou illisible (voir le journal)" },
      );
      continue;
    }

    const apercu = await produireApercu({
      mediaId: fichier.media.id,
      cleSource: fichier.media.s3Key,
      nomFichier: fichier.filename,
      taille: fichier.media.sizeBytes,
      pseudo: await pseudoDe(produit.sellerId),
    });
    if (!apercu) {
      issues.push({ produit: produit.id, ancienne, issue: "COUVERTURE_ECHEC", raison: "source absente ou illisible (voir le journal)" });
      continue;
    }

    await db.product.update({
      where: { id: produit.id },
      data: { coverUrl: apercu.url, coverImageId: fichier.media.id },
    });
    issues.push({ produit: produit.id, ancienne, issue: "COUVERTURE_PROTEGEE", media: fichier.media.id });
  }

  return issues;
}
