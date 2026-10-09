import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envoyerSms, oublierCompteurSms, piloteSms } from "@/lib/sms/pilotes";

/**
 * Le SMS est le seul canal qui coûte. Ces tests portent donc surtout sur ce
 * qu'on N'envoie PAS : un numéro illisible, un envoi au-delà du plafond, un
 * pilote à moitié configuré. Chacun de ces cas, laissé passer, se lit sur une
 * facture avant de se lire dans un journal.
 */

const AVANT = { ...process.env };

beforeEach(() => {
  oublierCompteurSms();
  delete process.env.SMS_DRIVER;
  delete process.env.SMS_PLAFOND_JOUR;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM;
  delete process.env.TWILIO_MESSAGING_SERVICE_SID;
  delete process.env.TEXTBEE_API_KEY;
  delete process.env.TEXTBEE_DEVICE_ID;
  delete process.env.TEXTBEE_BASE_URL;
  delete process.env.SMSGATE_URL;
  delete process.env.SMSGATE_USERNAME;
  delete process.env.SMSGATE_PASSWORD;
  delete process.env.SMSGATE_DEVICE_ID;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.env = { ...AVANT };
});

describe("le choix du pilote", () => {
  it("n'envoie rien par défaut", () => {
    // Le courriel a des pilotes gratuits qu'on laisse tourner ; le SMS non. Un
    // défaut bavard sur un canal payant est une facture qui commence sans
    // qu'on l'ait décidé.
    expect(piloteSms().nom).toBe("aucun");
  });

  it("retombe sur « aucun » quand le pilote nommé n'existe pas", () => {
    process.env.SMS_DRIVER = "orange-money-sms";
    expect(piloteSms().nom).toBe("aucun");
  });

  it("retombe sur « aucun » quand Twilio est à moitié configuré", () => {
    // Le cas réel : on pose la clé et on oublie l'expéditeur. Sans ce repli,
    // chaque relance partirait vers un 400 et serait comptée comme envoyée.
    process.env.SMS_DRIVER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env.TWILIO_AUTH_TOKEN = "un-jeton-assez-long";
    expect(piloteSms().nom).toBe("aucun");

    process.env.TWILIO_FROM = "+15550000000";
    expect(piloteSms().nom).toBe("twilio");
  });

  it("refuse un identifiant qui n'a pas la forme d'un vrai", () => {
    // Un espace réservé recopié d'une documentation ne doit pas passer pour
    // une configuration valable.
    process.env.SMS_DRIVER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "à-remplir";
    process.env.TWILIO_AUTH_TOKEN = "un-jeton-assez-long";
    process.env.TWILIO_FROM = "+15550000000";
    expect(piloteSms().nom).toBe("aucun");
  });
});

describe("envoyerSms", () => {
  beforeEach(() => {
    process.env.SMS_DRIVER = "console";
  });

  it("dit franchement qu'aucun opérateur n'est branché", async () => {
    delete process.env.SMS_DRIVER;
    const verdict = await envoyerSms({
      numero: "0700000000",
      pays: "CI",
      texte: "Bonjour",
    });
    // `ok: false` fait que Ndank NE NOTE PAS la relance, et réessaiera demain.
    // Rendre `true` couperait l'accès de quelqu'un jamais prévenu.
    expect(verdict.ok).toBe(false);
  });

  it("ne tente pas un numéro illisible", async () => {
    // Un numéro mal formé est facturé sans être reçu : mieux vaut refuser.
    const verdict = await envoyerSms({ numero: "12", pays: "CI", texte: "x" });
    expect(verdict.ok).toBe(false);
    expect(verdict.motif).toContain("illisible");
  });

  it("replie le texte avant l'envoi, sans que l'appelant y pense", async () => {
    const journal = await import("@/lib/observabilite/journal");
    const espion = vi.spyOn(journal.journal, "info");

    await envoyerSms({
      numero: "0700000000",
      pays: "CI",
      // Une espace fine insécable et une apostrophe courbe : le message
      // partirait en UCS-2 et coûterait le double.
      texte: "2 000 XOF pour l’accès",
    });

    const simule = espion.mock.calls.find((c) => String(c[0]).includes("simulé"));
    expect(simule?.[1]).toMatchObject({ texte: "2 000 XOF pour l'accès" });
  });

  it("annonce ce que l'envoi coûte", async () => {
    const verdict = await envoyerSms({
      numero: "0700000000",
      pays: "CI",
      texte: "a".repeat(200),
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.segments).toBe(2);
  });

  it("s'arrête au plafond journalier", async () => {
    // Le garde-fou qui borne le coût d'un bogue qu'on n'a pas encore écrit :
    // un passage qui rejouerait en boucle s'arrête ici, pas sur la facture.
    process.env.SMS_PLAFOND_JOUR = "2";

    const un = await envoyerSms({ numero: "0700000000", pays: "CI", texte: "a" });
    const deux = await envoyerSms({ numero: "0700000001", pays: "CI", texte: "a" });
    const trois = await envoyerSms({ numero: "0700000002", pays: "CI", texte: "a" });

    expect(un.ok).toBe(true);
    expect(deux.ok).toBe(true);
    expect(trois.ok).toBe(false);
    expect(trois.motif).toContain("plafond");
  });

  it("ne compte pas un envoi refusé dans le plafond", async () => {
    // Sinon un opérateur en panne épuiserait le quota d'une journée entière
    // sans qu'un seul message soit parti.
    process.env.SMS_PLAFOND_JOUR = "1";
    await envoyerSms({ numero: "12", pays: "CI", texte: "a" });

    const apres = await envoyerSms({
      numero: "0700000000",
      pays: "CI",
      texte: "a",
    });
    expect(apres.ok).toBe(true);
  });
});

describe("le pilote Twilio", () => {
  beforeEach(() => {
    process.env.SMS_DRIVER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env.TWILIO_AUTH_TOKEN = "un-jeton-assez-long";
    process.env.TWILIO_FROM = "+15550000000";
  });

  it("envoie le numéro en E.164 et rend la référence", async () => {
    const appels: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      appels.push(init);
      return new Response(JSON.stringify({ sid: "SM123", status: "queued" }), {
        status: 201,
      });
    });

    const verdict = await envoyerSms({
      numero: "07 07 07 07 07",
      pays: "CI",
      texte: "Bonjour",
    });

    expect(verdict.ok).toBe(true);
    expect(verdict.reference).toBe("SM123");

    const corps = new URLSearchParams(String(appels[0]?.body));
    // Le zéro de tête est conservé : c'est un chiffre du numéro ivoirien.
    expect(corps.get("To")).toBe("+2250707070707");
    expect(corps.get("From")).toBe("+15550000000");
  });

  it("préfère le service de messagerie quand il est posé", async () => {
    // Avec un service, Twilio choisit l'expéditeur le mieux placé pour le pays
    // visé — ce qui compte quand on écrit à quatre pays différents.
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MG0000000000";

    const appels: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      appels.push(init);
      return new Response(JSON.stringify({ sid: "SM1", status: "accepted" }), {
        status: 201,
      });
    });

    await envoyerSms({ numero: "0700000000", pays: "CI", texte: "x" });

    const corps = new URLSearchParams(String(appels[0]?.body));
    expect(corps.get("MessagingServiceSid")).toBe("MG0000000000");
    expect(corps.get("From")).toBeNull();
  });

  it("tient un refus pour un échec, et ne le compte pas comme envoyé", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ message: "numero non valide" }), {
          status: 400,
        }),
    );

    const verdict = await envoyerSms({
      numero: "0700000000",
      pays: "CI",
      texte: "x",
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.motif).toContain("non valide");
  });

  it("tient « failed » pour un échec même si la requête a réussi", async () => {
    // Twilio répond 201 avec un statut d'échec. Lire le seul code HTTP ferait
    // noter une relance jamais partie.
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ sid: "SM1", status: "failed" }), {
          status: 201,
        }),
    );

    const verdict = await envoyerSms({
      numero: "0700000000",
      pays: "CI",
      texte: "x",
    });
    expect(verdict.ok).toBe(false);
  });

  it("ne laisse pas une panne réseau remonter", async () => {
    // Le moteur essaie les canaux dans l'ordre : une exception ici arrêterait
    // le passage entier et priverait tous les autres abonnés de leur relance.
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNRESET");
    });

    const verdict = await envoyerSms({
      numero: "0700000000",
      pays: "CI",
      texte: "x",
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.motif).toBe("injoignable");
  });
});

describe("textbee — un téléphone Android comme passerelle", () => {
  const CLE = "cle-textbee-de-test-assez-longue";

  function textbee() {
    process.env.SMS_DRIVER = "textbee";
    process.env.TEXTBEE_API_KEY = CLE;
  }

  it("n'est choisi qu'avec une clé qui ressemble à une clé", () => {
    process.env.SMS_DRIVER = "textbee";
    expect(piloteSms().nom).toBe("aucun");

    process.env.TEXTBEE_API_KEY = "à-remplir";
    expect(piloteSms().nom).toBe("aucun");

    process.env.TEXTBEE_API_KEY = CLE;
    expect(piloteSms().nom).toBe("textbee");
  });

  it("refuse d'envoyer la clé en clair vers une instance distante", () => {
    textbee();
    process.env.TEXTBEE_BASE_URL = "http://textbee.exemple.com";
    expect(piloteSms().nom).toBe("aucun");

    // Une instance auto-hébergée sur la machine même, elle, peut parler HTTP.
    process.env.TEXTBEE_BASE_URL = "http://localhost:3005";
    expect(piloteSms().nom).toBe("textbee");
  });

  it("appelle la route d'envoi avec la clé, le numéro E.164 et l'appareil", async () => {
    textbee();
    process.env.TEXTBEE_DEVICE_ID = "appareil-42";
    let appel: { url: string; init: RequestInit } | null = null;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      appel = { url, init };
      return new Response(
        JSON.stringify({ data: { success: true, smsBatchId: "lot-1" } }),
        { status: 200 },
      );
    });

    const verdict = await envoyerSms({
      numero: "07 00 00 00 00",
      pays: "CI",
      texte: "Baobart : ton code est 123456.",
    });

    expect(verdict).toMatchObject({ ok: true, reference: "lot-1" });
    expect(appel!.url).toBe("https://api.textbee.dev/api/v1/gateway/send-sms");
    expect(new Headers(appel!.init.headers).get("x-api-key")).toBe(CLE);
    expect(JSON.parse(String(appel!.init.body))).toEqual({
      recipients: ["+2250700000000"],
      message: "Baobart : ton code est 123456.",
      deviceId: "appareil-42",
    });
  });

  it("vise l'instance auto-hébergée quand on la nomme", async () => {
    textbee();
    process.env.TEXTBEE_BASE_URL = "https://sms.baobart.test/";
    let url = "";
    vi.stubGlobal("fetch", async (u: string) => {
      url = u;
      return new Response(JSON.stringify({ data: { smsBatchId: "x" } }), { status: 200 });
    });

    await envoyerSms({ numero: "+2250700000000", pays: "CI", texte: "x" });
    expect(url).toBe("https://sms.baobart.test/api/v1/gateway/send-sms");
  });

  it.each([
    [400, "aucun appareil textbee disponible"],
    [401, "clé textbee refusée"],
    [429, "quota textbee épuisé"],
  ])("traduit un refus %i en motif lisible", async (statut, motif) => {
    textbee();
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ message: "refus" }), { status: statut }),
    );

    const verdict = await envoyerSms({ numero: "+2250700000000", pays: "CI", texte: "x" });
    expect(verdict).toMatchObject({ ok: false, motif });
  });

  it("ne compte pas comme envoyé un lot que textbee dit refusé", async () => {
    // Le cas qui passerait inaperçu : un 200 dont le corps dit « non ».
    textbee();
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ data: { success: false, message: "device offline" } }), {
          status: 200,
        }),
    );

    const verdict = await envoyerSms({ numero: "+2250700000000", pays: "CI", texte: "x" });
    expect(verdict.ok).toBe(false);
  });

  it("ne laisse pas une passerelle injoignable remonter", async () => {
    textbee();
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    const verdict = await envoyerSms({ numero: "+2250700000000", pays: "CI", texte: "x" });
    expect(verdict).toMatchObject({ ok: false, motif: "injoignable" });
  });
});

describe("smsgate — SMS Gateway for Android, sans service tiers", () => {
  // Le mot de passe que l'application tire au premier lancement fait huit
  // caractères (`LocalServerSettings.kt`) ; l'utilisateur par défaut est « sms ».
  function smsgate(url?: string) {
    process.env.SMS_DRIVER = "smsgate";
    process.env.SMSGATE_USERNAME = "sms";
    process.env.SMSGATE_PASSWORD = "Ab3dE6gH";
    if (url) process.env.SMSGATE_URL = url;
  }

  /** Ce que le téléphone rend à la soumission : 202, message en file. */
  const accepte = (etat = "Pending", erreur: string | null = null) =>
    new Response(
      JSON.stringify({
        id: "msg-1",
        state: etat,
        recipients: [{ phoneNumber: "+2250700000000", state: etat, error: erreur }],
      }),
      { status: 202 },
    );

  it("n'est choisi qu'avec un utilisateur et un mot de passe plausibles", () => {
    process.env.SMS_DRIVER = "smsgate";
    expect(piloteSms().nom).toBe("aucun");

    process.env.SMSGATE_USERNAME = "sms";
    process.env.SMSGATE_PASSWORD = "court";
    expect(piloteSms().nom).toBe("aucun");

    process.env.SMSGATE_PASSWORD = "Ab3dE6gH";
    expect(piloteSms().nom).toBe("smsgate");
  });

  it.each([
    ["http://192.168.1.20:8080", true],
    ["http://10.0.0.5:8080", true],
    ["http://172.20.0.3:8080", true],
    ["http://localhost:8080", true],
    ["https://sms.baobart.test/3rdparty/v1", true],
    // En clair hors du réseau local, les identifiants Basic traverseraient
    // Internet lisibles par tous.
    ["http://sms.exemple.com:8080", false],
    ["http://172.32.0.1:8080", false],
    ["http://8.8.8.8:8080", false],
    ["http://192.168.1.300:8080", false],
    // Des identifiants dans l'adresse finiraient dans les journaux.
    ["https://sms:secret@sms.baobart.test", false],
    ["ftp://192.168.1.20", false],
  ])("adresse %s → configuré : %s", (url, attendu) => {
    smsgate(url);
    expect(piloteSms().nom).toBe(attendu ? "smsgate" : "aucun");
  });

  it("appelle le serveur du téléphone en Basic, avec le texte, le numéro et la validité", async () => {
    smsgate("http://192.168.1.20:8080/");
    process.env.SMSGATE_DEVICE_ID = "tel-42";
    let appel: { url: string; init: RequestInit } | null = null;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      appel = { url, init };
      return accepte();
    });

    const verdict = await envoyerSms({
      numero: "07 00 00 00 00",
      pays: "CI",
      texte: "Baobart : ton code est 123456.",
      validiteS: 600,
    });

    expect(verdict).toMatchObject({ ok: true, reference: "msg-1" });
    expect(appel!.url).toBe("http://192.168.1.20:8080/message");
    expect(new Headers(appel!.init.headers).get("authorization")).toBe(
      `Basic ${Buffer.from("sms:Ab3dE6gH").toString("base64")}`,
    );
    expect(JSON.parse(String(appel!.init.body))).toEqual({
      textMessage: { text: "Baobart : ton code est 123456." },
      phoneNumbers: ["+2250700000000"],
      ttl: 600,
      deviceId: "tel-42",
    });
  });

  it("vise le relais en nuage par défaut, sans validité quand on n'en donne pas", async () => {
    smsgate();
    let appel: { url: string; init: RequestInit } | null = null;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      appel = { url, init };
      return accepte();
    });

    await envoyerSms({ numero: "+2250700000000", pays: "CI", texte: "x" });
    expect(appel!.url).toBe("https://api.sms-gate.app/3rdparty/v1/message");
    expect(JSON.parse(String(appel!.init.body))).not.toHaveProperty("ttl");
  });

  it("ne compte pas comme envoyé un 202 dont l'état dit déjà « Failed »", async () => {
    // Le succès silencieux qu'on cherche : la réponse est un 202, le corps dit non.
    smsgate("http://192.168.1.20:8080");
    vi.stubGlobal("fetch", async () => accepte("Failed", "RESULT_ERROR_NO_SERVICE"));

    const verdict = await envoyerSms({ numero: "+2250700000000", pays: "CI", texte: "x" });
    expect(verdict).toMatchObject({ ok: false, motif: "RESULT_ERROR_NO_SERVICE" });
  });

  it("traduit des identifiants refusés", async () => {
    smsgate("http://192.168.1.20:8080");
    // Ktor rend un 401 sans corps.
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

    const verdict = await envoyerSms({ numero: "+2250700000000", pays: "CI", texte: "x" });
    expect(verdict).toMatchObject({ ok: false, motif: "identifiants SMS Gateway refusés" });
  });

  it("rend le motif d'une requête refusée", async () => {
    smsgate("http://192.168.1.20:8080");
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ message: "Invalid device ID" }), { status: 400 }),
    );

    const verdict = await envoyerSms({ numero: "+2250700000000", pays: "CI", texte: "x" });
    expect(verdict).toMatchObject({ ok: false, motif: "Invalid device ID" });
  });

  it("ne laisse pas un téléphone injoignable remonter", async () => {
    smsgate("http://192.168.1.20:8080");
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    const verdict = await envoyerSms({ numero: "+2250700000000", pays: "CI", texte: "x" });
    expect(verdict).toMatchObject({ ok: false, motif: "injoignable" });
  });
});
