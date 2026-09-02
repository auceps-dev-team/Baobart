import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clePubliqueVapid, estMort, hote, pilotePush } from "@/lib/push/pilotes";

/**
 * Ce qui compte ici n'est pas l'envoi — il appartient à `web-push`, et le
 * simuler ne prouverait que notre simulation.
 *
 * Ce qui compte est la **configuration** : une paire VAPID à moitié posée fait
 * échouer chaque poussée en production, et rien ne le dit avant qu'un abonné se
 * plaigne de ne pas avoir été prévenu.
 */

const AVANT = { ...process.env };

// Des valeurs de la bonne longueur : 65 octets et 32 octets en base64url.
const PUBLIQUE = "B".repeat(87);
const PRIVEE = "p".repeat(43);

beforeEach(() => {
  delete process.env.PUSH_DRIVER;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
});

afterEach(() => {
  process.env = { ...AVANT };
});

function poser() {
  process.env.PUSH_DRIVER = "web-push";
  process.env.VAPID_PUBLIC_KEY = PUBLIQUE;
  process.env.VAPID_PRIVATE_KEY = PRIVEE;
  process.env.VAPID_SUBJECT = "mailto:contact@baobart.test";
}

describe("le choix du pilote", () => {
  it("n'envoie rien par défaut", () => {
    expect(pilotePush()).toBe("aucun");
  });

  it("s'active quand les trois valeurs sont là", () => {
    poser();
    expect(pilotePush()).toBe("web-push");
  });

  it("retombe sur « aucun » sans clé privée", () => {
    // Le cas réel : on copie la publique dans la configuration du client et on
    // oublie l'autre. Sans ce repli, le bouton d'activation s'afficherait, les
    // gens s'abonneraient, et aucune notification ne partirait.
    poser();
    delete process.env.VAPID_PRIVATE_KEY;
    expect(pilotePush()).toBe("aucun");
  });

  it("exige un sujet de contact valable", () => {
    // Certains services de poussée rejettent une requête sans sujet, et pas
    // les autres. Un défaut qui n'apparaît que sur un navigateur sur trois est
    // le pire genre : on le prend au démarrage plutôt qu'en production.
    poser();
    process.env.VAPID_SUBJECT = "contact@baobart.test";
    expect(pilotePush()).toBe("aucun");

    process.env.VAPID_SUBJECT = "https://baobart.test/contact";
    expect(pilotePush()).toBe("web-push");
  });

  it("refuse une clé trop courte pour en être une", () => {
    // Un espace réservé recopié d'une documentation ne doit pas passer pour
    // une configuration valable.
    poser();
    process.env.VAPID_PUBLIC_KEY = "à-remplir";
    expect(pilotePush()).toBe("aucun");
  });

  it("ignore un nom de pilote inconnu", () => {
    poser();
    process.env.PUSH_DRIVER = "firebase";
    expect(pilotePush()).toBe("aucun");
  });
});

describe("la clé publique", () => {
  it("n'est rendue que si elle existe", () => {
    expect(clePubliqueVapid()).toBeNull();
    poser();
    expect(clePubliqueVapid()).toBe(PUBLIQUE);
  });

  it("ne divulgue jamais la privée", () => {
    // La publique part au navigateur, c'est sa nature. La privée permettrait
    // d'écrire à tous les abonnés en notre nom.
    poser();
    expect(clePubliqueVapid()).not.toBe(PRIVEE);
  });
});

describe("un abonnement mort", () => {
  it("se reconnaît à 404 et 410, et à eux seuls", () => {
    // 404 et 410 sont définitifs : le navigateur n'existe plus. Traiter 429 ou
    // 503 comme définitifs effacerait des abonnements bien vivants pendant un
    // incident chez le service de poussée.
    expect(estMort(404)).toBe(true);
    expect(estMort(410)).toBe(true);
    expect(estMort(429)).toBe(false);
    expect(estMort(500)).toBe(false);
    expect(estMort(503)).toBe(false);
    expect(estMort(0)).toBe(false);
  });
});

describe("le journal", () => {
  it("ne retient que l'hôte du service, jamais l'endpoint", () => {
    // Un endpoint identifie un appareil ET vaut jeton : qui l'a peut pousser
    // dessus. Il n'a rien à faire dans un agrégateur de journaux.
    const endpoint = "https://fcm.googleapis.com/fcm/send/cQ7-secret-tres-long";
    expect(hote(endpoint)).toBe("fcm.googleapis.com");
    expect(hote(endpoint)).not.toContain("secret");
  });

  it("ne casse pas sur une valeur qui n'est pas une URL", () => {
    expect(hote("n'importe quoi")).toBe("inconnu");
  });
});
