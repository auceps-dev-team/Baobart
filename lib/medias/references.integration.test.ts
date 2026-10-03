/**
 * Les références de médias, lues dans une vraie base : la requête qui décide
 * de ce qui survit au balayage.
 */

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { nomsCites } from "@/lib/medias/balayage";
import { adressesRangees, textesCitantDesMedias } from "@/lib/medias/references";

const BASE = "http://localhost:9000/baobart-media/public";
const IMAGE_ARTICLE = "0b2c4d6e-1111-4a2b-9c3d-000000000001.jpg";
const COUVERTURE = "0b2c4d6e-2222-4a2b-9c3d-000000000002.webp";
const IMAGE_PUB = "0b2c4d6e-3333-4a2b-9c3d-000000000003.png";
const RECOPIEE = "0b2c4d6e-4444-4a2b-9c3d-000000000004.jpg";

describe("les médias cités", () => {
  it("se trouvent dans les articles, les bannières, et partout où l'on colle une image", async () => {
    const auteur = await db.user.create({
      data: { email: "medias-auteur@baobart.test", profile: { create: { username: "medias-auteur", displayName: "A" } } },
      select: { id: true },
    });
    await db.blogPost.create({
      data: {
        authorId: auteur.id,
        title: "Le wax",
        slug: "le-wax-medias",
        body: `Le wax.\n\n![](${BASE}/blog/${IMAGE_ARTICLE})\n\nFin.`,
        coverUrl: `${BASE}/blog/${COUVERTURE}`,
      },
    });
    await db.ad.create({
      data: {
        title: "Pub",
        imageUrl: `${BASE}/pubs/${IMAGE_PUB}`,
        imageWidth: 10,
        imageHeight: 10,
        linkUrl: "/explore",
        frequency: 10,
        createdById: "test",
      },
    });
    // Une image d'article recopiée dans la description d'une ressource : elle
    // doit survivre, même si l'article disparaît.
    await db.product.create({
      data: {
        sellerId: auteur.id,
        name: "Pack",
        slug: "pack-medias",
        price: 0,
        currency: "XOF",
        description: `Voir ![](${BASE}/blog/${RECOPIEE})`,
      },
    });

    const cites = nomsCites(await textesCitantDesMedias());
    for (const nom of [IMAGE_ARTICLE, COUVERTURE, IMAGE_PUB, RECOPIEE]) expect(cites, nom).toContain(nom);
  });

  it("vérifient les adresses de notre stockage, et elles seules", async () => {
    const auteur = await db.user.create({
      data: { email: "medias-auteur2@baobart.test", profile: { create: { username: "medias-auteur2", displayName: "A" } } },
      select: { id: true },
    });
    await db.blogPost.create({
      data: { authorId: auteur.id, title: "Ailleurs", slug: "ailleurs-medias", body: "x", coverUrl: "https://images.example/blog/couverture.jpg" },
    });
    await db.blogPost.create({
      data: { authorId: auteur.id, title: "Chez nous", slug: "chez-nous-medias", body: "x", coverUrl: `${BASE}/blog/${COUVERTURE}` },
    });

    // Une couverture extérieure n'a rien à prouver : l'exiger arrêterait le
    // balayage pour toujours.
    expect(await adressesRangees()).toEqual([`${BASE}/blog/${COUVERTURE}`]);
  });
});
