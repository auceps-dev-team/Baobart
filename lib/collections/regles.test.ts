import { describe, expect, it } from "vitest";

import { peutModifier, peutVoir, validerCollection } from "@/lib/collections/regles";

const privee = { proprietaireId: "awa", communauteId: null, publique: false };
const partagee = { proprietaireId: "awa", communauteId: "studio-kaay", publique: false };
const publique = { proprietaireId: "awa", communauteId: null, publique: true };
const visiteur = (id: string, communautes: string[] = []) => ({ id, communautes: new Set(communautes) });

describe("qui voit une collection", () => {
  it("son propriétaire, toujours", () => {
    expect(peutVoir(privee, visiteur("awa"))).toBe(true);
  });

  it("les membres de la communauté avec laquelle elle est partagée, et eux seuls", () => {
    // Le partage ne rend pas publique : `isPublic` et `communityId` répondent
    // à deux questions différentes (lib/forum/collections.ts).
    expect(peutVoir(partagee, visiteur("kofi", ["studio-kaay"]))).toBe(true);
    expect(peutVoir(partagee, visiteur("yao", ["autre"]))).toBe(false);
  });

  it("tout membre connecté si elle est publique, personne sans session", () => {
    expect(peutVoir(publique, visiteur("yao"))).toBe(true);
    expect(peutVoir(publique, null)).toBe(false);
  });
});

describe("qui la modifie", () => {
  it("son propriétaire seul, même partagée", () => {
    expect(peutModifier(partagee, visiteur("awa"))).toBe(true);
    expect(peutModifier(partagee, visiteur("kofi", ["studio-kaay"]))).toBe(false);
  });
});

describe("une collection créée", () => {
  it("a un nom, une description facultative, et reste privée par défaut", () => {
    expect(validerCollection({ titre: "  Inspiration   wax ", description: "", publique: false })).toEqual({
      ok: true,
      collection: { title: "Inspiration wax", description: null, isPublic: false },
    });
    expect(validerCollection({ titre: "x", description: "", publique: false })).toMatchObject({ ok: false, champ: "titre" });
    expect(validerCollection({ titre: "Typos", description: "y".repeat(201), publique: false })).toMatchObject({ ok: false, champ: "description" });
  });
});
