/**
 * La file d'attente, contre une vraie base.
 *
 * Ce qui s'y joue ne se simule pas : l'unicité de la clé d'idempotence est une
 * contrainte Postgres, et la réclamation concurrente repose sur
 * `FOR UPDATE SKIP LOCKED`. Les éprouver avec un faux client ne prouverait que
 * la fidélité du faux.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { abandonner, deposer, relancer, vider } from "@/lib/email/outbox";

const CHARGE = { nom: "Awa" };

function depot(cle: string, destinataire = "awa@baobart.test") {
  return { cle, destinataire, modele: "BIENVENUE" as const, charge: CHARGE };
}

const PILOTE_INITIAL = process.env.EMAIL_DRIVER;

beforeEach(() => {
  process.env.EMAIL_DRIVER = "console";
});

afterEach(() => {
  if (PILOTE_INITIAL === undefined) delete process.env.EMAIL_DRIVER;
  else process.env.EMAIL_DRIVER = PILOTE_INITIAL;
});

async function etatDe(cle: string) {
  return db.emailOutbox.findUnique({
    where: { idempotencyKey: cle },
    select: {
      status: true,
      attempts: true,
      sentAt: true,
      lastError: true,
      nextAttemptAt: true,
    },
  });
}

describe("dépôt", () => {
  it("inscrit un message en attente", async () => {
    const r = await deposer(depot("bienvenue-1"));
    expect(r.depose).toBe(true);

    const ligne = await etatDe("bienvenue-1");
    expect(ligne?.status).toBe("PENDING");
    expect(ligne?.attempts).toBe(0);
  });

  it("refuse un second dépôt sous la même clé", async () => {
    // C'est exactement ce que la clé sert à provoquer : un webhook rejoué par
    // l'opérateur ne doit pas envoyer un second reçu.
    await deposer(depot("recu-42"));
    const second = await deposer(depot("recu-42", "autre@baobart.test"));

    expect(second).toEqual({ depose: false, motif: "doublon" });
    expect(await db.emailOutbox.count()).toBe(1);
  });

  it("refuse une adresse invraisemblable avant d'écrire", async () => {
    const r = await deposer(depot("mauvaise", "pas-une-adresse"));
    expect(r).toEqual({ depose: false, motif: "adresse_invalide" });
    expect(await db.emailOutbox.count()).toBe(0);
  });

  it("refuse une adresse porteuse d'un saut de ligne", async () => {
    const r = await deposer(depot("injection", "a@b.test\nBcc: x@y.test"));
    expect(r).toEqual({ depose: false, motif: "adresse_invalide" });
  });

  it("refuse une charge que le modèle ne saurait pas rendre", async () => {
    // Découvrir le trou trois jours plus tard, dans un passage de nuit, ne le
    // rattacherait plus à ce qui l'a produit.
    const r = await deposer({
      cle: "creuse",
      destinataire: "awa@baobart.test",
      modele: "BIENVENUE",
      charge: {},
    });
    expect(r).toEqual({ depose: false, motif: "charge_invalide" });
    expect(await db.emailOutbox.count()).toBe(0);
  });
});

describe("passage", () => {
  it("envoie et marque comme envoyé", async () => {
    await deposer(depot("a-envoyer"));
    const passage = await vider();

    expect(passage.envoyes).toBe(1);
    const ligne = await etatDe("a-envoyer");
    expect(ligne?.status).toBe("SENT");
    expect(ligne?.sentAt).not.toBeNull();
  });

  it("ne reprend pas un message déjà envoyé", async () => {
    await deposer(depot("une-fois"));
    await vider();
    const second = await vider();

    expect(second.traites).toBe(0);
  });

  it("ne réclame pas un message dont l'heure n'est pas venue", async () => {
    await deposer(depot("plus-tard"));
    await db.emailOutbox.update({
      where: { idempotencyKey: "plus-tard" },
      data: { nextAttemptAt: new Date(Date.now() + 3_600_000) },
    });

    expect((await vider()).traites).toBe(0);
  });

  it("reporte sans abandonner quand aucun expéditeur n'est configuré", async () => {
    process.env.EMAIL_DRIVER = "";
    await deposer(depot("sans-pilote"));

    const passage = await vider();
    expect(passage.reportes).toBe(1);

    const ligne = await etatDe("sans-pilote");
    expect(ligne?.status).toBe("PENDING");
    expect(ligne?.attempts).toBe(1);
    // Le recul doit avoir repoussé l'échéance, sinon le passage suivant
    // reprendrait la même ligne en boucle.
    expect(ligne!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("abandonne après le quota de tentatives", async () => {
    process.env.EMAIL_DRIVER = "";
    await deposer(depot("increvable"));

    for (let i = 0; i < 5; i += 1) {
      await db.emailOutbox.updateMany({
        where: { idempotencyKey: "increvable" },
        data: { nextAttemptAt: new Date(0) },
      });
      await vider();
    }

    expect((await etatDe("increvable"))?.status).toBe("FAILED");
  });

  it("isole les échecs : un message fautif n'emporte pas le lot", async () => {
    await deposer(depot("bon-1"));
    await deposer(depot("bon-2", "kofi@baobart.test"));
    await deposer(depot("casse", "chidi@baobart.test"));
    // On casse la charge après coup, comme le ferait un changement de modèle.
    await db.emailOutbox.update({
      where: { idempotencyKey: "casse" },
      data: { payload: {} },
    });

    const passage = await vider();

    expect(passage.envoyes).toBe(2);
    expect(await etatDe("casse")).toMatchObject({ status: "FAILED" });
    expect(await etatDe("bon-1")).toMatchObject({ status: "SENT" });
    expect(await etatDe("bon-2")).toMatchObject({ status: "SENT" });
  });

  it("reprend une réclamation abandonnée par un processus mort", async () => {
    await deposer(depot("orphelin"));
    await db.emailOutbox.update({
      where: { idempotencyKey: "orphelin" },
      data: { status: "SENDING", claimedAt: new Date(Date.now() - 3_600_000) },
    });

    const passage = await vider();
    expect(passage.envoyes).toBe(1);
  });

  it("laisse tranquille une réclamation encore fraîche", async () => {
    await deposer(depot("en-cours"));
    await db.emailOutbox.update({
      where: { idempotencyKey: "en-cours" },
      data: { status: "SENDING", claimedAt: new Date() },
    });

    expect((await vider()).traites).toBe(0);
  });
});

describe("deux passages en même temps", () => {
  it("n'envoie jamais deux fois le même message", async () => {
    // Sans `FOR UPDATE SKIP LOCKED`, les deux passages liraient la même page
    // de résultats et enverraient chacun les dix messages.
    for (let i = 0; i < 10; i += 1) {
      await deposer(depot(`concurrent-${i}`, `p${i}@baobart.test`));
    }

    const [a, b] = await Promise.all([vider(20), vider(20)]);

    expect(a.traites + b.traites).toBe(10);
    expect(a.envoyes + b.envoyes).toBe(10);

    const envoyes = await db.emailOutbox.count({ where: { status: "SENT" } });
    expect(envoyes).toBe(10);

    const tentatives = await db.emailOutbox.findMany({
      select: { attempts: true },
    });
    // Une tentative chacun : deux voudrait dire qu'un message est parti deux fois.
    expect(tentatives.every((l) => l.attempts === 1)).toBe(true);
  });
});

describe("actions d'exploitation", () => {
  it("relance un message abandonné", async () => {
    await deposer(depot("a-relancer"));
    await db.emailOutbox.update({
      where: { idempotencyKey: "a-relancer" },
      data: { status: "FAILED", attempts: 5 },
    });

    const ligne = await db.emailOutbox.findUniqueOrThrow({
      where: { idempotencyKey: "a-relancer" },
    });
    expect(await relancer(ligne.id)).toBe(true);

    const apres = await etatDe("a-relancer");
    expect(apres?.status).toBe("PENDING");
    expect(apres?.attempts).toBe(0);
  });

  it("refuse de relancer un message déjà parti", async () => {
    // Le relancer l'enverrait une seconde fois.
    await deposer(depot("deja-parti"));
    await vider();

    const ligne = await db.emailOutbox.findUniqueOrThrow({
      where: { idempotencyKey: "deja-parti" },
    });
    expect(await relancer(ligne.id)).toBe(false);
    expect((await etatDe("deja-parti"))?.status).toBe("SENT");
  });

  it("abandonne sans prétendre que le message est parti", async () => {
    await deposer(depot("boite-morte"));
    const ligne = await db.emailOutbox.findUniqueOrThrow({
      where: { idempotencyKey: "boite-morte" },
    });

    expect(await abandonner(ligne.id)).toBe(true);
    const apres = await etatDe("boite-morte");
    expect(apres?.status).toBe("ABANDONED");
    expect(apres?.sentAt).toBeNull();
  });

  it("ne réclame plus un message abandonné", async () => {
    await deposer(depot("classe"));
    const ligne = await db.emailOutbox.findUniqueOrThrow({
      where: { idempotencyKey: "classe" },
    });
    await abandonner(ligne.id);

    expect((await vider()).traites).toBe(0);
  });
});
