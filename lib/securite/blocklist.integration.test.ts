/**
 * La liste de blocage, contre une vraie base.
 *
 * Trois choses se vérifient ici et nulle part ailleurs :
 *
 *   — l'**expiration lue**, qui ne peut pas se tester sans une colonne `date`
 *     et une comparaison SQL ;
 *   — la **normalisation**, dont tout l'intérêt est que la base compare des
 *     octets et pas des intentions ;
 *   — le **câblage au moteur de confiance**, où l'ordre des effets fait qu'une
 *     lecture au mauvais moment trouve une table déjà vidée.
 *
 * Le troisième est le seul qui aurait attrapé le défaut réel : le blocage
 * d'adresse posé après `INVALIDER_SESSIONS` ne bloquait rien, sans erreur.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { appliquerEvenementRisque } from "@/lib/domain/risque";
import {
  DUREE_BLOCAGE_IP_MS,
  bloquer,
  debloquer,
  debloquerPourCompte,
  estBloque,
  listerBlocages,
  normaliser,
  premierBlocage,
  purgerExpirees,
} from "@/lib/securite/blocklist";

let n = 0;
const suffixe = () => `${Date.now()}-${++n}`;

async function creerCompte(etat: "COMPLIANT" | "NOT_REVIEWED" = "COMPLIANT") {
  return db.user.create({
    data: {
      email: `bloc-${suffixe()}@baobart.test`,
      riskState: etat,
      kycStatus: "VERIFIED",
    },
  });
}

describe("poser et lire un blocage", () => {
  beforeEach(async () => {
    await db.blockedObject.deleteMany({});
  });

  it("bloque une adresse, puis la laisse passer une fois débloquée", async () => {
    await bloquer({ type: "IP", valeur: "203.0.113.7", raison: "essai" });
    expect(await estBloque("IP", "203.0.113.7")).toBe(true);

    await debloquer("IP", "203.0.113.7");
    expect(await estBloque("IP", "203.0.113.7")).toBe(false);
  });

  it("compare des courriels normalisés, pas des octets", async () => {
    // Le cas qui rend un blocage silencieusement inopérant : posé avec des
    // majuscules, vérifié en minuscules. La table dirait « bloqué », la
    // connexion passerait.
    await bloquer({ type: "EMAIL", valeur: "  Fraude@EXAMPLE.Com " });

    expect(await estBloque("EMAIL", "fraude@example.com")).toBe(true);
    expect(await estBloque("EMAIL", "FRAUDE@example.COM")).toBe(true);
  });

  it("ne bloque pas sur une valeur vide", async () => {
    // Une ligne vide posée par accident bloquerait tous les visiteurs dont on
    // n'a pas l'adresse.
    await bloquer({ type: "IP", valeur: "   " });

    expect(await db.blockedObject.count()).toBe(0);
    expect(await estBloque("IP", "")).toBe(false);
  });

  it("repose un blocage existant au lieu d'échouer", async () => {
    await bloquer({ type: "EMAIL", valeur: "a@b.test", raison: "premier" });
    await bloquer({ type: "EMAIL", valeur: "a@b.test", raison: "second" });

    const lignes = await db.blockedObject.findMany({
      where: { objectType: "EMAIL", objectValue: "a@b.test" },
    });

    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.reason).toBe("second");
  });
});

describe("expiration", () => {
  beforeEach(async () => {
    await db.blockedObject.deleteMany({});
  });

  it("ne bloque plus quand la date est passée, sans attendre le ménage", async () => {
    await bloquer({ type: "IP", valeur: "198.51.100.4", dureeMs: -1000 });

    // La ligne est bien là…
    expect(await db.blockedObject.count()).toBe(1);
    // …et elle ne bloque personne.
    expect(await estBloque("IP", "198.51.100.4")).toBe(false);
  });

  it("bloque indéfiniment quand aucune durée n'est donnée", async () => {
    // Le piège du filtre : écrire `expiresAt: { gt: maintenant }` tout seul
    // exclurait les `null`, c'est-à-dire les blocages permanents — les plus
    // graves.
    await bloquer({ type: "EMAIL", valeur: "permanent@baobart.test" });

    const ligne = await db.blockedObject.findFirst({
      where: { objectValue: "permanent@baobart.test" },
    });
    expect(ligne!.expiresAt).toBeNull();
    expect(await estBloque("EMAIL", "permanent@baobart.test")).toBe(true);
  });

  it("le ménage retire les expirées et garde les autres", async () => {
    await bloquer({ type: "IP", valeur: "1.1.1.1", dureeMs: -1000 });
    await bloquer({ type: "IP", valeur: "2.2.2.2", dureeMs: 60_000 });
    await bloquer({ type: "EMAIL", valeur: "c@d.test" });

    expect(await purgerExpirees()).toBe(1);

    const restantes = await db.blockedObject.findMany({
      select: { objectValue: true },
      orderBy: { objectValue: "asc" },
    });
    expect(restantes.map((r) => r.objectValue)).toEqual(["2.2.2.2", "c@d.test"]);
  });

  it("montre les lignes expirées, marquées comme telles", async () => {
    // Les cacher ferait chercher ailleurs pourquoi quelqu'un est repassé.
    await bloquer({ type: "IP", valeur: "3.3.3.3", dureeMs: -1000 });

    const lignes = await listerBlocages();
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.expiree).toBe(true);
  });
});

describe("premierBlocage", () => {
  beforeEach(async () => {
    await db.blockedObject.deleteMany({});
  });

  it("rend le type qui a fermé la porte", async () => {
    await bloquer({ type: "IP", valeur: "203.0.113.9" });

    const touche = await premierBlocage([
      { type: "EMAIL", valeur: "libre@baobart.test" },
      { type: "IP", valeur: "203.0.113.9" },
    ]);

    expect(touche).toBe("IP");
  });

  it("rend null quand rien n'est bloqué", async () => {
    expect(
      await premierBlocage([{ type: "EMAIL", valeur: "libre@baobart.test" }]),
    ).toBeNull();
  });
});

describe("câblage au moteur de confiance", () => {
  beforeEach(async () => {
    await db.blockedObject.deleteMany({});
  });

  it("bloque les adresses de session à la suspension, malgré leur suppression", async () => {
    // ══════════════════════════════════════════════════════════════════════
    // LE TEST QUI COMPTE
    //
    // `effetsPour` émet `INVALIDER_SESSIONS` AVANT `BLOQUER_IP`. Une lecture
    // des adresses faite au moment du blocage trouverait une table vide et
    // bloquerait zéro adresse — sans erreur, sans trace, avec une transaction
    // validée.
    //
    // Ici on pose deux sessions, on suspend, et on exige que les deux
    // adresses soient bloquées ET que les sessions aient bien disparu. Les
    // deux assertions ensemble : l'une sans l'autre laisserait passer une
    // version qui ne supprime plus les sessions.
    const compte = await creerCompte();

    await db.session.createMany({
      data: [
        {
          userId: compte.id,
          token: `t1-${suffixe()}`,
          expiresAt: new Date(Date.now() + 86_400_000),
          ipAddress: "203.0.113.10",
        },
        {
          userId: compte.id,
          token: `t2-${suffixe()}`,
          expiresAt: new Date(Date.now() + 86_400_000),
          ipAddress: "203.0.113.11",
        },
        {
          // Sans adresse : ne doit rien poser, et surtout pas une ligne vide.
          userId: compte.id,
          token: `t3-${suffixe()}`,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      ],
    });

    const suite = await appliquerEvenementRisque({
      userId: compte.id,
      event: "SUSPEND_FRAUD",
      auteur: "test",
    });
    expect(suite.applique).toBe(true);

    expect(await db.session.count({ where: { userId: compte.id } })).toBe(0);
    expect(await estBloque("IP", "203.0.113.10")).toBe(true);
    expect(await estBloque("IP", "203.0.113.11")).toBe(true);

    const posees = await db.blockedObject.findMany({
      where: { userId: compte.id },
    });
    expect(posees).toHaveLength(2);
    // Six mois, à la minute près : on vérifie l'ordre de grandeur, pas
    // l'horloge.
    const ecart = posees[0]!.expiresAt!.getTime() - Date.now();
    expect(ecart).toBeGreaterThan(DUREE_BLOCAGE_IP_MS - 60_000);
    expect(ecart).toBeLessThanOrEqual(DUREE_BLOCAGE_IP_MS);
  });

  it("lève les blocages à la levée de suspension", async () => {
    const compte = await creerCompte();

    await db.session.create({
      data: {
        userId: compte.id,
        token: `t-${suffixe()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        ipAddress: "203.0.113.12",
      },
    });

    await appliquerEvenementRisque({
      userId: compte.id,
      event: "SUSPEND_FRAUD",
      auteur: "test",
    });
    expect(await estBloque("IP", "203.0.113.12")).toBe(true);

    await appliquerEvenementRisque({
      userId: compte.id,
      event: "MARK_COMPLIANT",
      auteur: "test",
      clearSuspension: true,
    });

    expect(await estBloque("IP", "203.0.113.12")).toBe(false);
  });

  it("ne lève que les blocages du compte concerné", async () => {
    // `debloquerPourCompte` cherche par `userId`. S'il cherchait par autre
    // chose — ou pas du tout — une levée rendrait la place à tout le monde.
    const a = await creerCompte();
    const b = await creerCompte();

    await bloquer({ type: "IP", valeur: "4.4.4.4", userId: a.id });
    await bloquer({ type: "IP", valeur: "5.5.5.5", userId: b.id });

    expect(await debloquerPourCompte(a.id)).toBe(1);

    expect(await estBloque("IP", "4.4.4.4")).toBe(false);
    expect(await estBloque("IP", "5.5.5.5")).toBe(true);
  });

  it("journalise sans échouer quand aucune adresse n'est connue", async () => {
    // Le cas du développement : personne ne s'est connecté, aucune session.
    // La suspension doit aboutir quand même.
    const compte = await creerCompte();

    const suite = await appliquerEvenementRisque({
      userId: compte.id,
      event: "SUSPEND_TOS",
      auteur: "test",
    });

    expect(suite.applique).toBe(true);
    expect(await db.blockedObject.count({ where: { userId: compte.id } })).toBe(
      0,
    );
  });
});

describe("normaliser", () => {
  it("ne touche pas à la casse d'une adresse", () => {
    // Une IPv6 est insensible à la casse, mais on ne réécrit pas une notation
    // qu'on ne valide pas : mieux vaut comparer ce qu'on a reçu.
    expect(normaliser("IP", " 2001:DB8::1 ")).toBe("2001:DB8::1");
  });

  it("met les courriels en minuscules", () => {
    expect(normaliser("EMAIL", " A@B.TEST ")).toBe("a@b.test");
  });
});
