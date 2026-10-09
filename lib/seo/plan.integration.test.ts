/**
 * Le plan du site contre une vraie base.
 *
 * Le test unitaire vérifie la forme des adresses ; celui-ci vérifie le tri,
 * c'est-à-dire la seule chose qui puisse mal tourner en silence : une URL de
 * brouillon ou de compte suspendu dans le plan répond 404, et un moteur qui en
 * rencontre assez cesse de croire le plan entier.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { planDuSite } from "@/lib/seo/plan";

const AVANT = process.env.APP_URL;

beforeEach(() => {
  process.env.APP_URL = "https://baobart.test";
});

afterEach(() => {
  if (AVANT === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = AVANT;
});

let n = 0;

async function compte(opts: { suspendu?: boolean } = {}) {
  n += 1;
  return db.user.create({
    data: {
      email: `seo-${n}@baobart.test`,
      suspendedAt: opts.suspendu ? new Date() : null,
      profile: { create: { username: `seo-${n}`, displayName: `Seo ${n}` } },
    },
    select: { id: true },
  });
}

async function ressource(
  sellerId: string,
  status: "PUBLISHED" | "DRAFT",
): Promise<string> {
  n += 1;
  const slug = `seo-ressource-${n}`;
  await db.product.create({
    data: { sellerId, name: slug, slug, price: 1_000, currency: "XOF", status },
  });
  return slug;
}

async function urls(): Promise<string[]> {
  return (await planDuSite()).map((e) => e.url);
}

describe("ce que le plan du site retient", () => {
  it("liste une ressource publiée et la vitrine de son créateur", async () => {
    const vendeur = await compte();
    const slug = await ressource(vendeur.id, "PUBLISHED");

    const liste = await urls();
    expect(liste).toContain(`https://baobart.test/products/${slug}`);
    expect(liste).toContain(`https://baobart.test/createurs/seo-${n - 1}`);
  });

  it("écarte un brouillon, et l'acheteur qui n'a que des brouillons", async () => {
    const auteur = await compte();
    const nom = `seo-${n}`;
    const slug = await ressource(auteur.id, "DRAFT");

    const liste = await urls();
    expect(liste).not.toContain(`https://baobart.test/products/${slug}`);
    expect(liste).not.toContain(`https://baobart.test/createurs/${nom}`);
  });

  it("écarte la vitrine d'un compte suspendu", async () => {
    const suspendu = await compte({ suspendu: true });
    const nom = `seo-${n}`;
    await ressource(suspendu.id, "PUBLISHED");

    expect(await urls()).not.toContain(`https://baobart.test/createurs/${nom}`);
  });

  it("liste un article publié, pas un brouillon", async () => {
    const auteur = await compte();
    await db.blogPost.createMany({
      data: [
        { authorId: auteur.id, title: "Publié", slug: `seo-pub-${n}`, body: "x", state: "PUBLIE", publishedAt: new Date() },
        { authorId: auteur.id, title: "Brouillon", slug: `seo-brouillon-${n}`, body: "x" },
      ],
    });

    const liste = await urls();
    expect(liste).toContain(`https://baobart.test/blog/seo-pub-${n}`);
    expect(liste).not.toContain(`https://baobart.test/blog/seo-brouillon-${n}`);
  });

  it("ne rend rien sans APP_URL plutôt que de deviner le domaine", async () => {
    delete process.env.APP_URL;
    expect(await planDuSite()).toEqual([]);
  });
});
