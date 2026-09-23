/**
 * WebAuthn — ce qui nous appartient, pas ce que la bibliothèque fait.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE CES TESTS NE COUVRENT PAS, ET POURQUOI
 *
 * La vérification cryptographique — CBOR, clé COSE, signature — est le travail
 * de `@simplewebauthn/server`, qui a ses propres tests. La refaire ici
 * demanderait de fabriquer des réponses signées, c'est-à-dire de réimplémenter
 * l'authentificateur : on éprouverait notre imitation, pas la vraie chose.
 *
 * Ce qui nous appartient, en revanche, n'est couvert par personne :
 *
 *   — le défi est-il bien consommé, et une seule fois ?
 *   — un défi d'enrôlement peut-il servir à la connexion ?
 *   — peut-on retirer la clé de quelqu'un d'autre ?
 *   — l'identifiant de site est-il bien le domaine, et pas l'URL entière ?
 *
 * La boucle complète — vrai navigateur, vrai authentificateur — est éprouvée
 * séparément, avec l'authentificateur virtuel de Chrome.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  identifiantDuSite,
  listerLesCles,
  optionsConnexion,
  optionsEnrolement,
  origineAttendue,
  purgerDefisWebauthn,
  retirerUneCle,
  verifierConnexion,
} from "@/lib/auth/webauthn";
import { db } from "@/lib/db";

let n = 0;
const suffixe = () => `${Date.now()}-${++n}`;

async function creerCompte() {
  return db.user.create({
    data: { email: `wa-${suffixe()}@baobart.test`, riskState: "COMPLIANT" },
    select: { id: true, email: true },
  });
}

async function poserUneCle(userId: string, libelle = "Téléphone") {
  return db.passkey.create({
    data: {
      userId,
      credentialId: `cred-${suffixe()}`,
      publicKey: Buffer.from("cle-publique-factice").toString("base64url"),
      counter: 3,
      transports: "internal,hybrid",
      label: libelle,
    },
    select: { id: true, credentialId: true },
  });
}

describe("l'identité du site", () => {
  const origine = process.env.APP_URL;

  afterEach(() => {
    if (origine === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = origine;
  });

  it("rend le domaine seul, pas l'URL", () => {
    // C'est ce qui lie une clé à un site. S'y tromper ne lève rien : les clés
    // déjà enregistrées cessent d'être proposées, et le navigateur dit
    // simplement « aucune clé disponible ».
    process.env.APP_URL = "https://baobart.com/quelque/part";

    expect(identifiantDuSite()).toBe("baobart.com");
    expect(origineAttendue()).toBe("https://baobart.com");
  });

  it("distingue l'origine de l'identifiant", () => {
    // L'origine porte le port ; l'identifiant, jamais. Les confondre ferait
    // refuser toutes les clés en développement.
    process.env.APP_URL = "http://localhost:3100";

    expect(identifiantDuSite()).toBe("localhost");
    expect(origineAttendue()).toBe("http://localhost:3100");
  });

  it("retombe sur localhost quand la variable manque ou ment", () => {
    delete process.env.APP_URL;
    expect(identifiantDuSite()).toBe("localhost");

    process.env.APP_URL = "pas une url";
    expect(identifiantDuSite()).toBe("localhost");
  });
});

describe("le défi", () => {
  beforeEach(async () => {
    await db.webauthnChallenge.deleteMany({});
  });

  it("est posé à la demande d'options d'enrôlement", async () => {
    const compte = await creerCompte();

    const options = await optionsEnrolement(compte.id, compte.email, "Aya");

    const defi = await db.webauthnChallenge.findUnique({
      where: { challenge: options.challenge },
    });

    expect(defi).not.toBeNull();
    expect(defi!.usage).toBe("enrolement");
    expect(defi!.userId).toBe(compte.id);
  });

  it("n'en laisse qu'un par personne et par usage", async () => {
    // Deux onglets ouverts ne doivent pas laisser traîner un défi utilisable
    // quand on a abandonné l'autre.
    const compte = await creerCompte();

    await optionsEnrolement(compte.id, compte.email, "Aya");
    await optionsEnrolement(compte.id, compte.email, "Aya");

    expect(
      await db.webauthnChallenge.count({
        where: { userId: compte.id, usage: "enrolement" },
      }),
    ).toBe(1);
  });

  it("exclut les clés déjà enregistrées", async () => {
    // Sans cela, le même appareil s'enregistrerait deux fois, et la liste du
    // profil montrerait deux lignes qu'on ne saurait plus distinguer.
    const compte = await creerCompte();
    const clef = await poserUneCle(compte.id);

    const options = await optionsEnrolement(compte.id, compte.email, "Aya");

    expect(options.excludeCredentials?.map((c) => c.id)).toContain(
      clef.credentialId,
    );
  });

  it("le ménage retire les périmés", async () => {
    const compte = await creerCompte();
    const options = await optionsEnrolement(compte.id, compte.email, "Aya");

    await db.webauthnChallenge.update({
      where: { challenge: options.challenge },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await purgerDefisWebauthn()).toBeGreaterThanOrEqual(1);
  });
});

describe("les options de connexion", () => {
  beforeEach(async () => {
    await db.webauthnChallenge.deleteMany({});
  });

  it("rendent null quand le compte n'a aucune clé", async () => {
    // Rendre des options vides ferait ouvrir au navigateur une fenêtre
    // système qui ne propose rien, puis échouer.
    const compte = await creerCompte();

    expect(await optionsConnexion(compte.id)).toBeNull();
  });

  it("ne proposent que les clés du compte", async () => {
    // Laisser la liste vide ferait proposer n'importe quelle clé du domaine,
    // y compris celle d'un autre compte — qui échouerait ensuite sans que
    // rien ne dise pourquoi.
    const a = await creerCompte();
    const b = await creerCompte();
    const sienne = await poserUneCle(a.id);
    await poserUneCle(b.id);

    const options = await optionsConnexion(a.id);

    expect(options!.allowCredentials).toHaveLength(1);
    expect(options!.allowCredentials![0]!.id).toBe(sienne.credentialId);
  });

  it("posent un défi marqué « connexion »", async () => {
    const compte = await creerCompte();
    await poserUneCle(compte.id);

    const options = await optionsConnexion(compte.id);

    const defi = await db.webauthnChallenge.findUnique({
      where: { challenge: options!.challenge },
    });
    expect(defi!.usage).toBe("connexion");
  });
});

describe("la séparation des usages", () => {
  beforeEach(async () => {
    await db.webauthnChallenge.deleteMany({});
  });

  it("refuse un défi d'enrôlement présenté à la connexion", async () => {
    // Un défi d'enrôlement s'obtient en étant déjà connecté. S'il valait pour
    // la connexion, il suffirait d'en demander un pour entrer.
    const compte = await creerCompte();
    const clef = await poserUneCle(compte.id);
    const options = await optionsEnrolement(compte.id, compte.email, "Aya");

    const suite = await verifierConnexion({
      id: clef.credentialId,
      rawId: clef.credentialId,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: Buffer.from(
          JSON.stringify({ challenge: options.challenge }),
        ).toString("base64url"),
        authenticatorData: "",
        signature: "",
      },
    });

    expect(suite).toEqual({ ok: false, motif: "DEFI_INCONNU" });
  });

  it("consomme le défi même quand l'usage ne correspond pas", async () => {
    // Sinon un défi refusé resterait présentable indéfiniment, et l'on
    // pourrait chercher tranquillement ce qui passe.
    const compte = await creerCompte();
    const clef = await poserUneCle(compte.id);
    const options = await optionsEnrolement(compte.id, compte.email, "Aya");

    await verifierConnexion({
      id: clef.credentialId,
      rawId: clef.credentialId,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: Buffer.from(
          JSON.stringify({ challenge: options.challenge }),
        ).toString("base64url"),
        authenticatorData: "",
        signature: "",
      },
    });

    expect(
      await db.webauthnChallenge.findUnique({
        where: { challenge: options.challenge },
      }),
    ).toBeNull();
  });

  it("refuse un défi inconnu", async () => {
    const compte = await creerCompte();
    const clef = await poserUneCle(compte.id);

    const suite = await verifierConnexion({
      id: clef.credentialId,
      rawId: clef.credentialId,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: Buffer.from(
          JSON.stringify({ challenge: "jamais-emis" }),
        ).toString("base64url"),
        authenticatorData: "",
        signature: "",
      },
    });

    expect(suite).toEqual({ ok: false, motif: "DEFI_INCONNU" });
  });
});

describe("le retrait d'une clé", () => {
  it("retire la sienne", async () => {
    const compte = await creerCompte();
    const clef = await poserUneCle(compte.id);

    expect(await retirerUneCle(compte.id, clef.id)).toBe(true);
    expect(await db.passkey.count({ where: { userId: compte.id } })).toBe(0);
  });

  it("refuse de retirer celle d'un autre", async () => {
    // `deleteMany` avec le `userId` dans le `WHERE` : sans cela, connaître
    // l'identifiant d'une clé suffirait à retirer celle de quelqu'un d'autre.
    const a = await creerCompte();
    const b = await creerCompte();
    const sienne = await poserUneCle(b.id);

    expect(await retirerUneCle(a.id, sienne.id)).toBe(false);
    expect(await db.passkey.count({ where: { userId: b.id } })).toBe(1);
  });
});

describe("la liste affichée", () => {
  it("dit quand une clé n'a jamais servi", async () => {
    const compte = await creerCompte();
    await poserUneCle(compte.id, "Ma clé");

    const cles = await listerLesCles(compte.id);

    expect(cles).toHaveLength(1);
    expect(cles[0]!.libelle).toBe("Ma clé");
    expect(cles[0]!.utiliseeLe).toBeNull();
  });

  it("donne un nom de repli à une clé sans libellé", async () => {
    const compte = await creerCompte();
    await db.passkey.create({
      data: {
        userId: compte.id,
        credentialId: `cred-${suffixe()}`,
        publicKey: "x",
      },
    });

    expect((await listerLesCles(compte.id))[0]!.libelle).toBe("Clé sans nom");
  });
});
