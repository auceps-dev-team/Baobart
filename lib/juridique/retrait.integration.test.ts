/**
 * Le retrait juridique retire-t-il quelque chose — contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EXISTE
 *
 * Jusqu'au 24 septembre 2026, non. `retirerProvisoirement` changeait l'état du
 * dossier, écrivait une ligne d'audit « contenu.retirer », et envoyait au
 * créateur « Un de tes contenus a été retiré ». La ressource restait
 * `PUBLISHED`, dans le fil, et achetable.
 *
 * Rien ne plantait. Trois écrans disaient vrai sur le dossier et faux sur le
 * monde. C'est le défaut qui réussit en ne faisant rien, sur une obligation
 * légale — loi ivoirienne n° 2013-451, article 46.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE QUE CE FICHIER TIENT
 *
 *   — le retrait passe la ressource en SUSPENDED, et garde l'état d'avant ;
 *   — « provisoire » est tenu : la restauration rend l'état PRIS, pas
 *     `PUBLISHED` par défaut — un brouillon retiré revient brouillon ;
 *   — un classement sans suite rend aussi, un retrait définitif ne rend pas ;
 *   — deux dossiers sur la même ressource : lever l'un ne la rend pas tant
 *     que l'autre la retient ;
 *   — ce que le geste n'a pas atteint est DIT, pas tu.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE QUE CE FICHIER NE TIENT PAS
 *
 * La garde qui empêche le créateur de défaire le retrait — publier, dépublier,
 * modifier, supprimer — vit dans `lib/products/actions.ts`, un module
 * `"use server"`. Tout ce qu'il exporte devient une URL appelable depuis le
 * navigateur, donc la garde ne peut pas être exportée pour être testée, et les
 * quatre actions exigent une session.
 *
 * Elle repose donc sur le typage seul : `refuserSiRetiree` prend un
 * `{ status: string }`, et retirer `status` du `select` de `ressourceDe` ferait
 * échouer la compilation plutôt que désarmer la garde en silence. C'est moins
 * qu'un test, et c'est écrit ici plutôt que supposé.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import type { ProductStatus } from "@/lib/domain/prisma-types";
import { autoriserTelechargement } from "@/lib/domain/downloads";
import { retirerProvisoirement, trancher } from "@/lib/juridique/dossier";
import {
  dossiersQuiRetiennent,
  slugsDesUrls,
} from "@/lib/juridique/retrait";

let n = 0;

beforeEach(() => {
  n = 0;
});

async function vendeur() {
  n += 1;
  return db.user.create({
    data: {
      email: `retrait-${n}-${Date.now()}@baobart.test`,
      profile: {
        create: { username: `retrait-${n}-${Date.now()}`, displayName: `V ${n}` },
      },
    },
    select: { id: true },
  });
}

async function ressource(slug: string, status: ProductStatus = "PUBLISHED") {
  const v = await vendeur();
  return db.product.create({
    data: {
      sellerId: v.id,
      slug,
      name: `Ressource ${slug}`,
      price: 5_000,
      status,
    },
    select: { id: true, slug: true, status: true },
  });
}

/**
 * Un dossier prêt à être retiré, écrit directement en base.
 *
 * On ne passe pas par `deposer` : il valide l'article 47, ce qui est le sujet
 * d'un autre fichier. Ici on veut un dossier en état `RECUE` qui vise des URL
 * précises, et rien d'autre.
 */
async function dossier(urls: string, reference = `NOT-2026-${100 + n}`) {
  n += 1;
  return db.legalNotice.create({
    data: {
      reference: `${reference}-${n}`,
      state: "RECUE",
      notifierKind: "PERSONNE_PHYSIQUE",
      notifierEmail: "awa@exemple.ci",
      notifierName: "Diallo",
      notifierAddress: "Cocody, Abidjan",
      targetName: "Mensah",
      factsDescription: "Reproduction sans accord.",
      targetUrls: urls,
      legalGrounds: "Droit d'auteur.",
      priorContact: "Écrit le 2 septembre, sans réponse.",
    },
    select: { id: true, reference: true },
  });
}

async function statutDe(id: string): Promise<ProductStatus> {
  const p = await db.product.findUniqueOrThrow({
    where: { id },
    select: { status: true },
  });
  return p.status;
}

// ════════════════════════════════════════════════════════════ les URL ══

describe("lire les adresses visées", () => {
  it("reconnaît la fiche et le passage en caisse", () => {
    // Le notifiant copie ce qu'il a dans sa barre d'adresse. `/acheter/` est
    // une URL de ressource aussi valable que `/products/` ; n'en accepter
    // qu'une ferait échouer le retrait sur une adresse parfaitement correcte.
    const { slugs } = slugsDesUrls(
      "https://baobart.ci/products/mon-visuel\nhttps://baobart.ci/acheter/autre",
    );

    expect(slugs).toEqual(["mon-visuel", "autre"]);
  });

  it("ignore ce qui suit le slug", () => {
    const { slugs } = slugsDesUrls(
      [
        "https://baobart.ci/products/a?utm_source=mail",
        "https://baobart.ci/products/b#apercu",
        "https://baobart.ci/products/c/",
      ].join("\n"),
    );

    expect(slugs).toEqual(["a", "b", "c"]);
  });

  it("ne rend pas deux fois le même slug", () => {
    // Deux URL de la même ressource — la fiche et la caisse — ne doivent pas
    // produire deux tentatives de suspension.
    const { slugs } = slugsDesUrls(
      "https://baobart.ci/products/x\nhttps://baobart.ci/acheter/x",
    );

    expect(slugs).toEqual(["x"]);
  });

  it("range à part ce qui ne désigne pas une ressource", () => {
    // Un dossier peut viser un message de forum ou un profil. Ce n'est pas une
    // erreur — mais le taire ferait croire le retrait complet.
    const { slugs, nonResolues } = slugsDesUrls(
      "https://baobart.ci/products/ok\nhttps://baobart.ci/communautes/design/42",
    );

    expect(slugs).toEqual(["ok"]);
    expect(nonResolues).toEqual(["https://baobart.ci/communautes/design/42"]);
  });
});

// ═══════════════════════════════════════════════════════ le retrait ══

describe("retirer provisoirement", () => {
  it("passe la ressource en SUSPENDED", async () => {
    const produit = await ressource("copie-litigieuse");
    const d = await dossier("https://baobart.ci/products/copie-litigieuse");

    const suite = await retirerProvisoirement({
      reference: d.reference,
      parId: (await vendeur()).id,
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;

    expect(suite.retrait.suspendus).toEqual(["copie-litigieuse"]);
    expect(await statutDe(produit.id)).toBe("SUSPENDED");
  });

  it("garde l'état d'avant, et ne le devine pas", async () => {
    const produit = await ressource("brouillon-vise", "DRAFT");
    const d = await dossier("https://baobart.ci/products/brouillon-vise");

    await retirerProvisoirement({
      reference: d.reference,
      parId: (await vendeur()).id,
    });

    const ligne = await db.legalSuspension.findFirstOrThrow({
      where: { productId: produit.id },
      select: { previousStatus: true, liftedAt: true },
    });

    expect(ligne.previousStatus).toBe("DRAFT");
    expect(ligne.liftedAt).toBeNull();
  });

  it("dit les adresses qu'il n'a pas atteintes", async () => {
    await ressource("existe");
    const d = await dossier(
      [
        "https://baobart.ci/products/existe",
        "https://baobart.ci/products/faute-de-frappe",
        "https://baobart.ci/communautes/design/7",
      ].join("\n"),
    );

    const suite = await retirerProvisoirement({
      reference: d.reference,
      parId: (await vendeur()).id,
    });

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;

    expect(suite.retrait.suspendus).toEqual(["existe"]);
    // Une URL bien formée dont aucune ressource ne porte le slug compte comme
    // non résolue : c'est une faute de frappe du notifiant, et le modérateur
    // doit la voir avant de croire le contenu retiré.
    expect(suite.retrait.nonResolues).toContain(
      "https://baobart.ci/products/faute-de-frappe",
    );
    expect(suite.retrait.nonResolues).toContain(
      "https://baobart.ci/communautes/design/7",
    );
  });

  it("nomme les dossiers qui retiennent une ressource", async () => {
    const produit = await ressource("retenue");
    const d = await dossier("https://baobart.ci/products/retenue");

    await retirerProvisoirement({
      reference: d.reference,
      parId: (await vendeur()).id,
    });

    const retenus = await dossiersQuiRetiennent(produit.id);

    expect(retenus).toHaveLength(1);
    expect(retenus[0]?.reference).toBe(d.reference);
  });
});

// ════════════════════════════════════════════════════ la restauration ══

describe("trancher", () => {
  async function retiree(slug: string, statusInitial: ProductStatus) {
    const produit = await ressource(slug, statusInitial);
    const d = await dossier(`https://baobart.ci/products/${slug}`);
    await retirerProvisoirement({
      reference: d.reference,
      parId: (await vendeur()).id,
    });
    return { produit, d };
  }

  it("rend l'état pris, pas PUBLISHED par défaut", async () => {
    // Le cas qui fait la différence : une ressource en brouillon au moment du
    // retrait. La rendre « publiée » la mettrait en ligne sans que son auteur
    // l'ait demandé — et « provisoire » deviendrait un mensonge dans l'autre
    // sens.
    const { produit, d } = await retiree("brouillon-rendu", "DRAFT");

    const suite = await trancher({
      reference: d.reference,
      parId: (await vendeur()).id,
      sens: "RESTAUREE",
      motif: "La notification ne tient pas.",
    });

    expect(suite.ok).toBe(true);
    expect(await statutDe(produit.id)).toBe("DRAFT");
  });

  it("rend aussi sur un classement sans suite", async () => {
    // « Classée » est l'abandon de la notification. Laisser le contenu retiré
    // ferait de ce classement une décision contre l'auteur, que personne n'a
    // prise.
    const { produit, d } = await retiree("classee", "PUBLISHED");

    await trancher({
      reference: d.reference,
      parId: (await vendeur()).id,
      sens: "CLASSEE",
      motif: "Le notifiant s'est désisté.",
    });

    expect(await statutDe(produit.id)).toBe("PUBLISHED");
  });

  it("laisse retirée sur un retrait définitif", async () => {
    const { produit, d } = await retiree("definitive", "PUBLISHED");

    await trancher({
      reference: d.reference,
      parId: (await vendeur()).id,
      sens: "RETIREE",
      motif: "La notification est fondée.",
    });

    expect(await statutDe(produit.id)).toBe("SUSPENDED");

    // La ligne reste ouverte : c'est elle qui empêchera un autre dossier de
    // remettre la ressource en ligne par sa propre levée.
    const ouvertes = await db.legalSuspension.count({
      where: { productId: produit.id, liftedAt: null },
    });
    expect(ouvertes).toBe(1);
  });
});

// ═════════════════════════════════════════════ deux dossiers, une ressource ══

describe("deux dossiers sur la même ressource", () => {
  it("lever le premier ne rend pas ce que le second retient", async () => {
    const produit = await ressource("doublement-visee", "PUBLISHED");
    const url = "https://baobart.ci/products/doublement-visee";

    const premier = await dossier(url, "NOT-2026-801");
    const second = await dossier(url, "NOT-2026-802");
    const moderateur = (await vendeur()).id;

    await retirerProvisoirement({ reference: premier.reference, parId: moderateur });
    await retirerProvisoirement({ reference: second.reference, parId: moderateur });

    // Le second a trouvé la ressource déjà SUSPENDED. Il ne doit pas
    // enregistrer SUSPENDED comme état à rendre — sinon sa levée la
    // condamnerait pour toujours.
    const ligneSeconde = await db.legalSuspension.findFirstOrThrow({
      where: { noticeId: second.id },
      select: { previousStatus: true },
    });
    expect(ligneSeconde.previousStatus).toBe("PUBLISHED");

    await trancher({
      reference: premier.reference,
      parId: moderateur,
      sens: "RESTAUREE",
      motif: "Premier dossier infondé.",
    });

    expect(await statutDe(produit.id)).toBe("SUSPENDED");

    await trancher({
      reference: second.reference,
      parId: moderateur,
      sens: "RESTAUREE",
      motif: "Second dossier infondé aussi.",
    });

    expect(await statutDe(produit.id)).toBe("PUBLISHED");
  });
});

// ════════════════════════════════════════════ ce qui n'est plus servi ══

describe("le téléchargement d'une ressource retirée", () => {
  /** Une ressource offerte, avec un fichier source : elle se télécharge sans commande. */
  async function offerteAvecFichier(slug: string) {
    const v = await vendeur();

    const media = await db.mediaAsset.create({
      data: {
        ownerId: v.id,
        purpose: "product",
        s3Key: `test/${slug}-${Date.now()}`,
        checksum: "x".repeat(32),
        sizeBytes: 1024,
        contentType: "image/png",
        status: "READY",
      },
      select: { id: true },
    });

    const produit = await db.product.create({
      data: {
        sellerId: v.id,
        slug,
        name: `Offerte ${slug}`,
        // Zéro : le droit de télécharger ne dépend alors d'aucune commande, ce
        // qui isole ce que ce test mesure — le statut, et rien d'autre.
        price: 0,
        status: "PUBLISHED",
        files: {
          create: { mediaId: media.id, filename: `${slug}.png`, sizeBytes: 1024 },
        },
      },
      select: { id: true, files: { select: { id: true } } },
    });

    return { produit, fichierId: produit.files[0]!.id, vendeurId: v.id };
  }

  it("autorise tant que la ressource est en ligne", async () => {
    // Le témoin. Sans lui, le refus du test suivant pourrait venir de
    // n'importe quoi — une commande absente, un fichier mal posé — et on
    // croirait avoir éprouvé le retrait.
    const { fichierId } = await offerteAvecFichier("offerte-libre");
    const acheteur = await vendeur();

    const suite = await autoriserTelechargement({
      userId: acheteur.id,
      productFileId: fichierId,
    });

    expect(suite.decision.autorise).toBe(true);
  });

  it("refuse dès que la ressource est retirée", async () => {
    // Ce contrôle manquait. La fiche rendait 404 et le fil ne montrait plus
    // rien, mais qui possédait déjà l'identifiant du fichier — c'est-à-dire
    // quiconque l'avait acheté — continuait de le tirer. Le contenu litigieux
    // restait distribué à exactement les gens à qui il l'était déjà.
    const { produit, fichierId } = await offerteAvecFichier("offerte-retiree");
    const d = await dossier("https://baobart.ci/products/offerte-retiree");

    await retirerProvisoirement({
      reference: d.reference,
      parId: (await vendeur()).id,
    });

    expect(await statutDe(produit.id)).toBe("SUSPENDED");

    const suite = await autoriserTelechargement({
      userId: (await vendeur()).id,
      productFileId: fichierId,
    });

    expect(suite.decision).toEqual({
      autorise: false,
      raison: "RETRAIT_JURIDIQUE",
    });
    expect(suite.fichier).toBeNull();
  });

  it("sert à nouveau après une remise en ligne", async () => {
    const { produit, fichierId } = await offerteAvecFichier("offerte-rendue");
    const d = await dossier("https://baobart.ci/products/offerte-rendue");
    const moderateur = (await vendeur()).id;

    await retirerProvisoirement({ reference: d.reference, parId: moderateur });
    await trancher({
      reference: d.reference,
      parId: moderateur,
      sens: "RESTAUREE",
      motif: "Notification infondée.",
    });

    expect(await statutDe(produit.id)).toBe("PUBLISHED");

    const suite = await autoriserTelechargement({
      userId: (await vendeur()).id,
      productFileId: fichierId,
    });

    expect(suite.decision.autorise).toBe(true);
  });
});
