/**
 * Ce que l'écran de supervision lit, contre une vraie base.
 *
 * Les règles de gravité sont éprouvées séparément dans `supervision.test.ts`.
 * Ici on vérifie le comptage : que les bons états entrent dans les bons
 * compteurs, et que les filtres découpent ce qu'ils annoncent.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { vueDeLaFile } from "@/lib/email/lecture";

type Etat = "PENDING" | "SENDING" | "SENT" | "FAILED" | "ABANDONED";

let compteur = 0;

async function poser(input: {
  statut: Etat;
  ageMinutes?: number;
  envoyeIlYaMinutes?: number;
  reclameIlYaMinutes?: number;
}) {
  compteur += 1;
  const cree = new Date(Date.now() - (input.ageMinutes ?? 1) * 60_000);

  return db.emailOutbox.create({
    data: {
      idempotencyKey: `cle-${compteur}`,
      recipient: `destinataire${compteur}@baobart.test`,
      template: "BIENVENUE",
      payload: { nom: "Awa" },
      status: input.statut,
      createdAt: cree,
      sentAt:
        input.envoyeIlYaMinutes === undefined
          ? null
          : new Date(Date.now() - input.envoyeIlYaMinutes * 60_000),
      claimedAt:
        input.reclameIlYaMinutes === undefined
          ? null
          : new Date(Date.now() - input.reclameIlYaMinutes * 60_000),
    },
    select: { id: true },
  });
}

function valeur(vue: Awaited<ReturnType<typeof vueDeLaFile>>, cle: string) {
  return vue.compteurs.find((c) => c.cle === cle)?.valeur;
}

beforeEach(() => {
  compteur = 0;
});

describe("compteurs", () => {
  it("ne compte en attente que ce qui attend vraiment", async () => {
    await poser({ statut: "PENDING" });
    await poser({ statut: "SENDING" });
    await poser({ statut: "FAILED" });

    expect(valeur(await vueDeLaFile(), "attente")).toBe("1");
  });

  it("ne compte les envoyés que sur les dernières vingt-quatre heures", async () => {
    await poser({ statut: "SENT", envoyeIlYaMinutes: 60 });
    await poser({ statut: "SENT", envoyeIlYaMinutes: 60 * 30 });

    expect(valeur(await vueDeLaFile(), "envoyes")).toBe("1");
  });

  it("ne compte pas un abandon comme un échec", async () => {
    // Abandonner est une décision, pas une panne. Les confondre ferait
    // clignoter l'écran en rouge pour des lignes qu'on a déjà traitées.
    await poser({ statut: "FAILED" });
    await poser({ statut: "ABANDONED" });

    const vue = await vueDeLaFile();
    expect(valeur(vue, "echecs")).toBe("1");
    expect(vue.echecs).toBe(1);
  });

  it("mesure l'âge du plus ancien en attente, pas du plus ancien tout court", async () => {
    await poser({ statut: "SENT", ageMinutes: 600 });
    await poser({ statut: "PENDING", ageMinutes: 45 });

    expect(valeur(await vueDeLaFile(), "age")).toBe("45 min");
  });

  it("annonce une file vide plutôt qu'un âge de zéro", async () => {
    await poser({ statut: "SENT", envoyeIlYaMinutes: 5 });

    const vue = await vueDeLaFile();
    expect(valeur(vue, "age")).toBe("—");
    expect(vue.gravite).toBe("ok");
  });
});

describe("filtres", () => {
  beforeEach(async () => {
    await poser({ statut: "PENDING" });
    await poser({ statut: "SENDING" });
    await poser({ statut: "SENT", envoyeIlYaMinutes: 5 });
    await poser({ statut: "FAILED" });
    await poser({ statut: "ABANDONED" });
  });

  it("rend toute la file par défaut", async () => {
    const vue = await vueDeLaFile();
    expect(vue.lignes).toHaveLength(5);
    expect(vue.total).toBe(5);
  });

  it.each([
    ["En attente", 1],
    ["En cours", 1],
    ["Envoyés", 1],
  ] as const)("« %s » n'en rend que %i", async (filtre, attendu) => {
    expect((await vueDeLaFile(filtre)).lignes).toHaveLength(attendu);
  });

  it("regroupe échoués et abandonnés — ce qui ne repartira pas seul", async () => {
    expect((await vueDeLaFile("Échoués")).lignes).toHaveLength(2);
  });

  it("garde le total général, pour distinguer « rien » de « rien de ce genre »", async () => {
    const vue = await vueDeLaFile("En attente");
    expect(vue.total).toBe(1);
    expect(vue.totalGeneral).toBe(5);
  });
});

describe("lignes", () => {
  it("rend la plus récente en premier", async () => {
    await poser({ statut: "PENDING", ageMinutes: 120 });
    const recent = await poser({ statut: "PENDING", ageMinutes: 1 });

    expect((await vueDeLaFile()).lignes[0]?.id).toBe(recent.id);
  });

  it("signale une réclamation qui traîne, pas une fraîche", async () => {
    await poser({ statut: "SENDING", reclameIlYaMinutes: 1 });
    const vueFraiche = await vueDeLaFile("En cours");
    expect(vueFraiche.lignes[0]?.libelleStatut).toBe("EN COURS");

    await db.emailOutbox.updateMany({
      data: { claimedAt: new Date(Date.now() - 40 * 60_000) },
    });
    const vueBloquee = await vueDeLaFile("En cours");
    expect(vueBloquee.lignes[0]?.libelleStatut).toBe("EN COURS (bloqué)");
    expect(vueBloquee.lignes[0]?.gravite).toBe("panne");
  });

  it("ne propose de relance que sur un échec", async () => {
    await poser({ statut: "SENT", envoyeIlYaMinutes: 5 });
    await poser({ statut: "FAILED" });

    const vue = await vueDeLaFile();
    const parStatut = Object.fromEntries(
      vue.lignes.map((l) => [l.statut, l.relancable]),
    );
    // Relancer un message parti l'enverrait une seconde fois.
    expect(parStatut.SENT).toBe(false);
    expect(parStatut.FAILED).toBe(true);
  });

  it("ne remonte jamais la charge utile", async () => {
    // Elle porte des liens de téléchargement personnels et des liens de
    // réinitialisation. Une capture d'écran d'incident circule et reste.
    await poser({ statut: "PENDING" });

    const ligne = (await vueDeLaFile()).lignes[0]!;
    expect(Object.keys(ligne)).not.toContain("payload");
    expect(JSON.stringify(ligne)).not.toContain("Awa");
  });
});
