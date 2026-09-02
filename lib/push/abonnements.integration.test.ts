/**
 * Les appareils d'une personne, contre la vraie base.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX DÉFAUTS QUE CE FICHIER EXISTE POUR ATTRAPER
 *
 *   — **le doublon.** Un navigateur renouvelle son abonnement tout seul. Si le
 *     même endpoint créait une seconde ligne, la personne recevrait chaque
 *     relance deux fois — et se désabonnerait ;
 *   — **la suppression par autrui.** Un endpoint est une chaîne qu'on peut
 *     recopier. Sans la condition sur le propriétaire, qui la connaîtrait
 *     pourrait couper les notifications de quelqu'un d'autre.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  appareilsDe,
  desinscrire,
  envoyerA,
  inscrire,
} from "@/lib/push/abonnements";

const AVANT = { ...process.env };

beforeEach(() => {
  delete process.env.PUSH_DRIVER;
});

afterEach(() => {
  process.env = { ...AVANT };
});

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: {
      email: `push-${n}@baobart.test`,
      profile: { create: { username: `push-${n}`, displayName: `Awa ${n}` } },
    },
    select: { id: true },
  });
}

function inscription(suffixe: string) {
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${suffixe}`,
    p256dh: "cle-publique-du-navigateur",
    auth: "secret-d-authentification",
    appareil: "Mozilla/5.0 (Linux; Android 14)",
  };
}

describe("inscrire un navigateur", () => {
  it("enregistre l'appareil", async () => {
    const u = await personne();

    expect((await inscrire(u.id, inscription("a"))).ok).toBe(true);
    expect(await appareilsDe(u.id)).toHaveLength(1);
  });

  it("garde plusieurs appareils pour la même personne", async () => {
    // Un téléphone ET un ordinateur. N'en garder qu'un ferait arriver la
    // relance sur celui resté dans un tiroir.
    const u = await personne();

    await inscrire(u.id, inscription("telephone"));
    await inscrire(u.id, inscription("ordinateur"));

    expect(await appareilsDe(u.id)).toHaveLength(2);
  });

  it("ne dédouble pas un endpoint réenregistré", async () => {
    // LE défaut de ce fichier : les navigateurs renouvellent leur abonnement
    // tout seuls, et une seconde ligne ferait recevoir chaque relance en
    // double.
    const u = await personne();

    await inscrire(u.id, inscription("a"));
    await inscrire(u.id, { ...inscription("a"), p256dh: "nouvelle-cle" });

    const appareils = await appareilsDe(u.id);
    expect(appareils).toHaveLength(1);

    const ligne = await db.pushSubscription.findUniqueOrThrow({
      where: { id: appareils[0]! },
      select: { p256dh: true },
    });
    // Et les clés sont bien celles du dernier enregistrement : garder les
    // anciennes ferait échouer le chiffrement à chaque envoi.
    expect(ligne.p256dh).toBe("nouvelle-cle");
  });

  it("suit un appareil qui change de main", async () => {
    // Un téléphone partagé, une session qui change. Laisser l'ancien
    // propriétaire lui ferait recevoir les relances de quelqu'un d'autre —
    // montants compris.
    const un = await personne();
    const deux = await personne();

    await inscrire(un.id, inscription("partage"));
    await inscrire(deux.id, inscription("partage"));

    expect(await appareilsDe(un.id)).toHaveLength(0);
    expect(await appareilsDe(deux.id)).toHaveLength(1);
  });

  it("refuse ce qui ne vient pas d'un navigateur", async () => {
    const u = await personne();

    expect(
      (await inscrire(u.id, { ...inscription("a"), endpoint: "http://ailleurs" }))
        .ok,
    ).toBe(false);
    expect(
      (await inscrire(u.id, { ...inscription("a"), p256dh: "" })).ok,
    ).toBe(false);

    expect(await appareilsDe(u.id)).toHaveLength(0);
  });

  it("tronque la chaîne d'agent", async () => {
    // Assez pour reconnaître son appareil dans une liste, pas assez pour
    // constituer une empreinte.
    const u = await personne();
    await inscrire(u.id, { ...inscription("a"), appareil: "x".repeat(400) });

    const ligne = await db.pushSubscription.findFirstOrThrow({
      where: { userId: u.id },
      select: { appareil: true },
    });
    expect(ligne.appareil!.length).toBeLessThanOrEqual(120);
  });
});

describe("retirer un navigateur", () => {
  it("retire le sien", async () => {
    const u = await personne();
    await inscrire(u.id, inscription("a"));

    expect((await desinscrire(u.id, inscription("a").endpoint)).ok).toBe(true);
    expect(await appareilsDe(u.id)).toHaveLength(0);
  });

  it("ne retire pas celui d'un autre", async () => {
    // La garde qui compte : un endpoint est une chaîne, et qui la connaîtrait
    // pourrait sinon couper les notifications de quelqu'un d'autre.
    const un = await personne();
    const deux = await personne();
    await inscrire(un.id, inscription("a"));

    expect((await desinscrire(deux.id, inscription("a").endpoint)).ok).toBe(false);
    expect(await appareilsDe(un.id)).toHaveLength(1);
  });
});

describe("envoyer", () => {
  it("ne prétend rien quand aucun service n'est configuré", async () => {
    // `false` fait que Ndank NE NOTE PAS la relance : l'abonné sera repris
    // demain plutôt que coupé sans avoir été prévenu.
    const u = await personne();
    await inscrire(u.id, inscription("a"));

    const parti = await envoyerA(await appareilsDe(u.id), {
      titre: "x",
      corps: "y",
      lien: "/dashboard/forfait",
    });

    expect(parti).toBe(false);
  });

  it("ne tente rien sans appareil", async () => {
    expect(
      await envoyerA([], { titre: "x", corps: "y", lien: "/" }),
    ).toBe(false);
  });
});
