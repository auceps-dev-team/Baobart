import "server-only";

import type { Prisma, ProductStatus } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Ce qu'un retrait juridique retire vraiment.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MODULE EXISTE PARCE QUE LE RETRAIT N'EN ÉTAIT PAS UN
 *
 * Mesuré le 24 septembre 2026, en lisant `retirerProvisoirement` ligne à
 * ligne : il changeait l'état du dossier, écrivait une ligne d'audit
 * `contenu.retirer`, et notifiait le créateur « Un de tes contenus a été
 * retiré ». Il ne touchait pas au produit, qui restait `PUBLISHED`, dans le
 * fil, et achetable.
 *
 * Trois choses annonçaient un retrait qui n'avait pas lieu — l'état du
 * dossier, le journal, et le message à l'auteur. Aucune erreur nulle part :
 * c'est le défaut qui réussit en ne faisant rien, sur une obligation légale
 * (loi ivoirienne n° 2013-451, art. 46 : agir promptement dès la connaissance
 * acquise).
 *
 * L'en-tête de `dossier.ts` affirmait « le contenu lui-même est masqué par la
 * modération ». C'était vrai pour le forum (`retirerParLaPlateforme`), le blog
 * et les événements. Ça ne l'était pas pour les produits — c'est-à-dire pour
 * le cas qu'une notification pour marque ou image volée vise réellement.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON RETIRE CE QUE LE DOSSIER DÉSIGNE, PAS CE QU'ON DEVINE
 *
 * L'article 47 exige « la localisation précise sur le réseau », et la
 * validation refuse déjà « tout mon site ». Ces URL sont donc la seule chose
 * du dossier qui désigne un contenu — `targetUserId` désigne une personne, ce
 * qui n'est pas la même chose : retirer tout ce qu'un compte publie parce
 * qu'une de ses ressources est contestée serait une sanction de compte, et
 * c'est le rôle de `lib/domain/risque.ts`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL DIT CE QU'IL N'A PAS RETIRÉ
 *
 * Une URL qui ne correspond à aucune ressource n'est pas une erreur : un
 * dossier peut viser un message de forum, un article, un profil. Mais la
 * taire ferait du retrait un succès silencieux de plus — « geste posé, rien
 * retiré » se lirait comme « geste posé ».
 *
 * `BilanRetrait.nonResolues` remonte donc jusqu'à l'écran, et le modérateur
 * voit ce que son clic n'a pas atteint.
 */

/** Ce qu'un geste de retrait a effectivement fait. */
export interface BilanRetrait {
  /** Les slugs des ressources réellement passées en `SUSPENDED`. */
  suspendus: string[];
  /**
   * Les lignes de `targetUrls` qu'aucune ressource ne porte.
   *
   * Vide ne veut pas dire « tout a été retiré » : une URL de forum s'y
   * trouvera, et c'est normal. C'est au modérateur de lire.
   */
  nonResolues: string[];
}

/**
 * Les slugs de ressources que ces URL désignent.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX CHEMINS MÈNENT À UNE RESSOURCE
 *
 * `/products/<slug>` est la fiche ; `/acheter/<slug>` est son passage en
 * caisse. Un notifiant copie l'adresse de sa barre d'URL, et rien ne garantit
 * laquelle il avait sous les yeux. N'en accepter qu'une ferait échouer le
 * retrait sur une URL parfaitement valide, en silence.
 *
 * Pure, et exportée pour ça : c'est la seule partie de ce module qu'on peut
 * éprouver sans base, et c'est celle qui a le plus de formes à traverser.
 */
export function slugsDesUrls(brut: string): {
  slugs: string[];
  /**
   * La ligne d'où vient chaque slug.
   *
   * Elle existe pour que ce qui n'a pas été retiré soit rendu au modérateur
   * **tel qu'il l'a reçu**. Reconstruire `/products/<slug>` perdrait l'hôte et
   * tout ce que le notifiant avait écrit après — et l'obligerait à deviner
   * laquelle de ses lignes a échoué.
   */
  origine: Record<string, string>;
  nonResolues: string[];
} {
  const lignes = brut
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const slugs: string[] = [];
  const origine: Record<string, string> = {};
  const nonResolues: string[] = [];

  for (const ligne of lignes) {
    // Le slug s'arrête au premier caractère qui n'en fait pas partie : `/`,
    // `?`, `#`, ou la fin. `slugifier` ne produit que [a-z0-9-], donc on
    // n'accepte que ça — une casse ou un accent dans l'URL ne désignerait
    // aucune ressource, et l'accepter ferait chercher un slug qui n'existe pas.
    const trouve = /\/(?:products|acheter)\/([a-z0-9-]+)/.exec(ligne);

    if (trouve?.[1]) {
      slugs.push(trouve[1]);
      // La première ligne gagne : la fiche et la caisse désignent la même
      // ressource, et en citer deux pour un seul échec n'aide personne.
      origine[trouve[1]] ??= ligne;
    } else {
      nonResolues.push(ligne);
    }
  }

  return { slugs: [...new Set(slugs)], origine, nonResolues };
}

/**
 * Le bilan d'un retrait, reconstitué depuis ce qui est enregistré.
 *
 * Le bilan rendu par `suspendreLesProduits` vivait dans l'état d'un composant,
 * démonté dès que le dossier changeait d'état : le modérateur ne le voyait
 * jamais (mesuré le 25/09, Qualitytest O6, P10.6, S31, S54). Tout est pourtant
 * en base — les lignes `LegalSuspension` disent ce qui a été retiré, et
 * `targetUrls` ce qui était visé. Une adresse visée que rien n'a retirée est
 * « non atteinte », quelle qu'en soit la raison.
 */
export function bilanEnregistre(targetUrls: string, retirees: string[]): BilanRetrait {
  const { slugs, origine, nonResolues } = slugsDesUrls(targetUrls);
  const faites = new Set(retirees);
  return {
    suspendus: [...faites],
    nonResolues: [
      ...nonResolues,
      ...slugs.filter((s) => !faites.has(s)).map((s) => origine[s] ?? s),
    ],
  };
}

/** Ce que le modérateur lit : combien a été retiré, et ce qui ne l'a pas été. */
export function texteDuBilan(bilan: BilanRetrait): string {
  const debut =
    bilan.suspendus.length === 0
      ? "Aucune ressource retirée."
      : `${bilan.suspendus.length} ressource(s) retirée(s) : ${bilan.suspendus.join(", ")}.`;
  if (bilan.nonResolues.length === 0) return debut;
  return (
    `${debut} Ces adresses ne désignent aucune ressource de Baobart — ` +
    `elles visent peut-être un message de forum ou un article, à traiter ` +
    `ailleurs :\n${bilan.nonResolues.join("\n")}`
  );
}

/**
 * Retire les ressources qu'un dossier désigne.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'ÉTAT D'AVANT EST DANS LE `WHERE`, COMME PARTOUT ICI
 *
 * Deux modérateurs qui tranchent en même temps ne doivent pas poser deux
 * lignes de suspension avec deux états d'origine différents. Le `updateMany`
 * ne réussit que si la ressource est encore dans l'état qu'on a lu.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UNE RESSOURCE DÉJÀ SUSPENDUE N'EMPILE PAS SON ÉTAT
 *
 * Si un second dossier vise une ressource que le premier retient déjà,
 * enregistrer `previousStatus: SUSPENDED` la condamnerait : la levée du
 * second la rendrait à « suspendue », et plus rien ne la sortirait de là.
 *
 * On recopie donc l'état d'origine de la suspension qui court. C'est le genre
 * de cas qu'on ne rencontre qu'une fois en production, deux ans plus tard, et
 * qu'on ne comprend jamais.
 */
export async function suspendreLesProduits(
  tx: Prisma.TransactionClient,
  input: { noticeId: string; targetUrls: string },
): Promise<BilanRetrait> {
  const { slugs, origine, nonResolues } = slugsDesUrls(input.targetUrls);
  if (slugs.length === 0) return { suspendus: [], nonResolues };

  const produits = await tx.product.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, status: true },
  });

  const trouves = new Set(produits.map((p) => p.slug));
  const suspendus: string[] = [];

  for (const produit of produits) {
    const aRendre = await etatARendre(tx, produit.id, produit.status);

    const ecrit = await tx.product.updateMany({
      where: { id: produit.id, status: produit.status },
      data: { status: "SUSPENDED" },
    });

    if (ecrit.count !== 1) continue;

    // `upsert` et non `create` : le même dossier peut être retiré puis
    // re-prononcé après une contestation rejetée, et la clé unique
    // (dossier, ressource) refuserait la seconde ligne.
    await tx.legalSuspension.upsert({
      where: {
        noticeId_productId: { noticeId: input.noticeId, productId: produit.id },
      },
      update: { liftedAt: null, suspendedAt: new Date(), previousStatus: aRendre },
      create: {
        noticeId: input.noticeId,
        productId: produit.id,
        previousStatus: aRendre,
      },
    });

    suspendus.push(produit.slug);
  }

  return {
    suspendus,
    // Une URL bien formée dont aucune ressource ne porte le slug est aussi
    // « non résolue » : c'est une faute de frappe du notifiant, et le
    // modérateur doit la voir avant de croire le contenu retiré.
    nonResolues: [
      ...nonResolues,
      // Rendue telle qu'écrite dans le dossier — voir `origine`.
      ...slugs.filter((s) => !trouves.has(s)).map((s) => origine[s] ?? s),
    ],
  };
}

/** L'état qu'il faudra rendre : le sien, ou celui qu'une suspension garde déjà. */
async function etatARendre(
  tx: Prisma.TransactionClient,
  productId: string,
  actuel: ProductStatus,
): Promise<ProductStatus> {
  if (actuel !== "SUSPENDED") return actuel;

  const enCours = await tx.legalSuspension.findFirst({
    where: { productId, liftedAt: null },
    select: { previousStatus: true },
    orderBy: { suspendedAt: "asc" },
  });

  // Suspendue sans ligne qui l'explique : on ne peut pas inventer un état.
  // `DRAFT` est le seul choix qui ne publie rien par surprise.
  return enCours?.previousStatus ?? "DRAFT";
}

/**
 * Rend les ressources qu'un dossier retenait.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ON NE REND QUE CE QUE PLUS PERSONNE NE RETIENT
 *
 * Deux dossiers peuvent viser la même ressource. Lever le premier sans
 * regarder le second la remettrait en ligne alors qu'une notification tient
 * toujours — et ce serait invisible, parce que le second dossier continuerait
 * d'afficher « retrait provisoire ».
 */
export async function retablirLesProduits(
  tx: Prisma.TransactionClient,
  noticeId: string,
): Promise<string[]> {
  const lignes = await tx.legalSuspension.findMany({
    where: { noticeId, liftedAt: null },
    select: { id: true, productId: true, previousStatus: true },
  });

  const rendus: string[] = [];

  for (const ligne of lignes) {
    await tx.legalSuspension.update({
      where: { id: ligne.id },
      data: { liftedAt: new Date() },
    });

    // Après la levée, jamais avant : compter d'abord laisserait passer une
    // suspension qu'on est en train de lever.
    const encoreRetenue = await tx.legalSuspension.count({
      where: { productId: ligne.productId, liftedAt: null },
    });

    if (encoreRetenue > 0) continue;

    const ecrit = await tx.product.updateMany({
      where: { id: ligne.productId, status: "SUSPENDED" },
      data: { status: ligne.previousStatus },
    });

    if (ecrit.count === 1) {
      const produit = await tx.product.findUnique({
        where: { id: ligne.productId },
        select: { slug: true },
      });
      if (produit) rendus.push(produit.slug);
    }
  }

  return rendus;
}

/**
 * Les dossiers qui retiennent cette ressource, pour l'écran du créateur.
 *
 * Sans elle, une ressource suspendue serait grisée dans le tableau de bord
 * sans que son auteur sache pourquoi — et il ouvrirait un ticket plutôt que
 * `/dashboard/mes-dossiers`.
 */
export async function dossiersQuiRetiennent(
  productId: string,
): Promise<Array<{ reference: string; suspendedAt: Date }>> {
  const lignes = await db.legalSuspension.findMany({
    where: { productId, liftedAt: null },
    select: { suspendedAt: true, notice: { select: { reference: true } } },
    orderBy: { suspendedAt: "asc" },
  });

  return lignes.map((l) => ({
    reference: l.notice.reference,
    suspendedAt: l.suspendedAt,
  }));
}
