/**
 * Les créateurs dans la recherche de l'en-tête (Q-12, recette du 14/11/2026) :
 * « awa » ne trouvait pas la créatrice Awa Diallo. Ne remontent que ceux qui
 * ont une vitrine à montrer — une ressource publiée — et un compte ouvert.
 */
import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { rechercherCreateurs } from "@/lib/feed/queries";

let n = 0;
async function createur(nom: string, opts: { publie?: boolean; suspendu?: boolean } = {}) {
  n += 1;
  const u = await db.user.create({
    data: {
      email: `rc-${n}-${Math.random().toString(36).slice(2, 7)}@baobart.test`,
      suspendedAt: opts.suspendu ? new Date() : null,
      profile: { create: { username: `rc-${n}-${Math.random().toString(36).slice(2, 6)}`, displayName: nom } },
    },
    select: { id: true },
  });
  await db.product.create({
    data: {
      sellerId: u.id,
      name: `Pack ${n}`,
      slug: `pack-rc-${n}-${Math.random().toString(36).slice(2, 7)}`,
      price: 1_000,
      currency: "XOF",
      status: opts.publie === false ? "DRAFT" : "PUBLISHED",
    },
  });
  return u.id;
}

describe("rechercherCreateurs", () => {
  it("trouve une créatrice par une partie de son nom, sans tenir compte de la casse", async () => {
    await createur("Awa Diallo");
    expect((await rechercherCreateurs("diallo")).map((c) => c.nom)).toEqual(["Awa Diallo"]);
  });

  it("écarte un compte sans ressource publiée, et un compte suspendu", async () => {
    await createur("Awa Brouillon", { publie: false });
    await createur("Awa Suspendue", { suspendu: true });
    await createur("Awa Visible");
    expect((await rechercherCreateurs("awa")).map((c) => c.nom)).toEqual(["Awa Visible"]);
  });

  it("une seule lettre ne cherche rien", async () => {
    await createur("Awa Diallo");
    expect(await rechercherCreateurs("a")).toEqual([]);
  });
});
