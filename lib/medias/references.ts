import "server-only";

import { db } from "@/lib/db";

/**
 * Où un média du blog ou d'une bannière peut être cité.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA LISTE EST LARGE À DESSEIN
 *
 * Relevée le 03/10 dans `prisma/schema.prisma` : toutes les colonnes de texte
 * où quelqu'un peut coller une adresse d'image — corps d'articles, de
 * publications et de messages, descriptions, couvertures, avatars. Une image
 * d'article recopiée dans un événement doit survivre à l'article ; oublier une
 * colonne ferait disparaître une image en silence, et seul un lecteur
 * attentif verrait le trou.
 *
 * Ce que ça implique : une colonne ajoutée plus tard au schéma, et qui
 * accepte une adresse d'image, doit être ajoutée ici. Rien ne le rappellera
 * d'office — le test d'intégration ne couvre que les colonnes listées.
 *
 * Le filtre `LIKE` reste en base : on ne rapatrie que les textes qui citent
 * l'un des deux dossiers.
 */
export async function textesCitantDesMedias(): Promise<(string | null)[]> {
  const lignes = await db.$queryRaw<{ t: string | null }[]>`
    SELECT t FROM (
      SELECT "body" AS t FROM "BlogPost"
      UNION ALL SELECT "coverUrl" FROM "BlogPost"
      UNION ALL SELECT "imageUrl" FROM "Ad"
      UNION ALL SELECT "videoUrl" FROM "Ad"
      UNION ALL SELECT "description" FROM "Event"
      UNION ALL SELECT "coverUrl" FROM "Event"
      UNION ALL SELECT "description" FROM "JobPosting"
      UNION ALL SELECT "description" FROM "ServiceOffer"
      UNION ALL SELECT "description" FROM "Product"
      UNION ALL SELECT "coverUrl" FROM "Product"
      UNION ALL SELECT "previewUrl" FROM "Product"
      UNION ALL SELECT "avatarUrl" FROM "Profile"
      UNION ALL SELECT "bannerUrl" FROM "Profile"
      UNION ALL SELECT "body" FROM "Post"
      UNION ALL SELECT "body" FROM "ForumPost"
      UNION ALL SELECT "body" FROM "Comment"
      UNION ALL SELECT "body" FROM "CommunityChatMessage"
      UNION ALL SELECT "description" FROM "Community"
      UNION ALL SELECT "description" FROM "Board"
      UNION ALL SELECT "corps" FROM "Notification"
      UNION ALL SELECT "factsDescription" FROM "LegalNotice"
      UNION ALL SELECT "body" FROM "LegalNoticeReply"
    ) x
    WHERE t LIKE '%/pubs/%' OR t LIKE '%/blog/%'`;
  return lignes.map((l) => l.t);
}

/**
 * Les adresses qui désignent à coup sûr un fichier de notre stockage — la
 * vérification de `balayerLesMedias`. Seulement celles qui portent le
 * préfixe du stockage : une couverture d'article peut être une adresse
 * extérieure, et elle n'a rien à prouver ici.
 */
export async function adressesRangees(): Promise<string[]> {
  const [pubs, articles] = await Promise.all([
    db.ad.findMany({ select: { imageUrl: true, videoUrl: true } }),
    db.blogPost.findMany({ where: { coverUrl: { not: null } }, select: { coverUrl: true } }),
  ]);
  return [
    ...pubs.flatMap((p) => [p.imageUrl, p.videoUrl]),
    ...articles.map((a) => a.coverUrl),
  ].filter((a): a is string => typeof a === "string" && /\/public\/(?:pubs|blog)\//.test(a));
}
