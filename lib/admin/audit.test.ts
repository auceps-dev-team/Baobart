import { describe, expect, it, vi } from "vitest";

/**
 * La seule propriété du journal d'audit qui ne se voit pas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CONSIGNER NE DOIT JAMAIS FAIRE ÉCHOUER L'ACTE
 *
 * Un administrateur qui suspend un compte frauduleux ne doit pas voir son geste
 * refusé parce que l'écriture d'audit n'est pas passée : l'acte a eu lieu, il
 * est trop tard pour le défaire, et propager l'erreur transformerait un
 * incident de base en panne d'exploitation.
 *
 * Le revers est assumé — une trace peut manquer —, d'où le cri dans le journal
 * applicatif que ce test vérifie aussi.
 */

const create = vi.fn();
const erreur = vi.fn();

vi.mock("@/lib/db", () => ({ db: { auditLog: { create } } }));
vi.mock("@/lib/observabilite/journal", () => ({
  journal: { erreur, info: vi.fn(), avertissement: vi.fn() },
}));

const { consigner, ressource } = await import("@/lib/admin/audit");

describe("consigner", () => {
  it("ne lève pas quand la base refuse", async () => {
    create.mockRejectedValueOnce(new Error("base injoignable"));

    await expect(
      consigner({
        acteurId: "clx-admin",
        action: "compte.suspendre",
        ressource: ressource("user", "clx-cible"),
      }),
    ).resolves.toBeUndefined();
  });

  it("crie la trace perdue plutôt que de l'avaler", async () => {
    // Un audit qui perd des lignes en silence ne vaut rien : le jour où l'on
    // conclut sur un dossier, il faut savoir que la liste peut être trouée.
    erreur.mockClear();
    create.mockRejectedValueOnce(new Error("base injoignable"));

    await consigner({
      acteurId: "clx-admin",
      action: "risque.changer",
      ressource: ressource("user", "clx-cible"),
    });

    expect(erreur).toHaveBeenCalledOnce();
    const [message, contexte] = erreur.mock.calls[0]!;
    expect(String(message)).toContain("AUDIT");
    expect(contexte).toMatchObject({ action: "risque.changer" });
  });

  it("écrit un détail vide plutôt que rien", async () => {
    // `details` est un JSON non nullable au schéma : l'omettre ferait échouer
    // l'écriture de toutes les actions qui n'ont rien à préciser.
    create.mockClear();
    create.mockResolvedValueOnce({});

    await consigner({
      acteurId: "clx-admin",
      action: "courriel.rejouer",
      ressource: ressource("email", "clx-1"),
    });

    expect(create.mock.calls[0]![0].data.details).toEqual({});
  });
});

describe("ressource", () => {
  it("préfixe par le type", () => {
    // Un identifiant nu ne dit pas de quelle table il vient — et l'on cherche
    // souvent « tout ce qui a touché ce compte ».
    expect(ressource("user", "clx1")).toBe("user:clx1");
  });
});
