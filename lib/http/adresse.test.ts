import { describe, expect, it } from "vitest";

import { avecProtocole } from "./adresse";

describe("avecProtocole (Q-24)", () => {
  it("complète une adresse écrite sans protocole", () => {
    expect(avecProtocole("drive.google.com/file/d/1AbC")).toBe("https://drive.google.com/file/d/1AbC");
    expect(avecProtocole("  www.behance.net/awa ")).toBe("https://www.behance.net/awa");
  });

  it("laisse une adresse qui a déjà un protocole, quel qu'il soit : la vérification décide ensuite", () => {
    for (const a of ["https://x.ci/a", "http://x.ci/a", "javascript:alert(1)", "data:text/html,x", "ftp://x.ci"]) {
      expect(avecProtocole(a)).toBe(a);
    }
  });

  it("laisse le vide vide", () => {
    expect(avecProtocole("   ")).toBe("");
  });
});
