import { describe, expect, it } from "vitest";

import { MODELES } from "@/lib/email/modeles";

import {
  CANAUX,
  CANAUX_LIVRES,
  CATALOGUE,
  EVENEMENTS,
  canauxPour,
  estModifiable,
  evenementsPour,
  type EvenementNotifiable,
  type Preferences,
} from "./catalogue";

describe("les canaux", () => {
  it("ne livre pas le push, et le dit", () => {
    // Déclaré pour que la préférence se range dès maintenant, pas livré parce
    // que rien ne l'envoie encore. La séparation doit rester visible.
    expect(CANAUX).toContain("PUSH");
    expect(CANAUX_LIVRES).not.toContain("PUSH");
  });

  it("n'ouvre jamais un canal qui n'est pas livré", () => {
    // L'invariant qui casserait si quelqu'un mettait PUSH à `true` dans un
    // défaut en croyant l'allumer : ce n'est pas là que ça s'allume.
    for (const e of EVENEMENTS) {
      expect(canauxPour(e)).not.toContain("PUSH");
    }
  });
});

describe("les défauts", () => {
  it("laissent l'in-app ouvert partout", () => {
    // Une ligne dans une liste qu'on consulte ne dérange personne : elle
    // attend qu'on vienne. C'est le courriel qui s'impose.
    for (const e of EVENEMENTS) {
      expect(canauxPour(e)).toContain("IN_APP");
    }
  });

  it("ferment le courriel sur les deux événements à fort volume", () => {
    // Cent inscriptions à un atelier feraient cent courriels, et cent
    // courriels font marquer l'expéditeur comme indésirable — ce qui coûte
    // ensuite les reçus d'achat.
    expect(canauxPour("INSCRIPTION_EVENEMENT")).not.toContain("COURRIEL");
    expect(canauxPour("NOUVEL_ABONNE")).not.toContain("COURRIEL");
  });

  it("ouvrent le courriel partout ailleurs", () => {
    const silencieux: EvenementNotifiable[] = [
      "INSCRIPTION_EVENEMENT",
      "NOUVEL_ABONNE",
    ];
    for (const e of EVENEMENTS) {
      if (silencieux.includes(e)) continue;
      expect(canauxPour(e)).toContain("COURRIEL");
    }
  });
});

describe("les préférences", () => {
  it("ferment un canal que la personne a coupé", () => {
    const prefs: Preferences = { VENTE_REALISEE: { COURRIEL: false } };

    expect(canauxPour("VENTE_REALISEE", prefs)).toEqual(["IN_APP"]);
  });

  it("ouvrent un canal que la personne a rallumé", () => {
    // L'inverse compte autant : quelqu'un qui veut un courriel par abonné doit
    // pouvoir le demander, même si le défaut est de se taire.
    const prefs: Preferences = { NOUVEL_ABONNE: { COURRIEL: true } };

    expect(canauxPour("NOUVEL_ABONNE", prefs)).toContain("COURRIEL");
  });

  it("ne touchent pas aux autres événements", () => {
    // Une préférence est un couple, pas un interrupteur général. Couper les
    // ventes ne doit pas couper les reçus.
    const prefs: Preferences = { VENTE_REALISEE: { COURRIEL: false } };

    expect(canauxPour("TELECHARGEMENT_PRET", prefs)).toContain("COURRIEL");
  });

  it("laissent le défaut s'appliquer sur ce qui n'a pas été réglé", () => {
    // L'absence d'entrée veut dire « le défaut du code s'applique » — c'est ce
    // qui permet de changer un défaut sans migrer une table.
    const prefs: Preferences = { VENTE_REALISEE: { COURRIEL: false } };

    expect(canauxPour("VENTE_REALISEE", prefs)).toContain("IN_APP");
  });
});

describe("les impératifs", () => {
  it("ignorent la préférence, quel que soit le canal", () => {
    // Le test central : un réglage enregistré autrefois — ou posé par erreur
    // en base — ne doit pas pouvoir faire taire un avis de versement.
    const toutCoupe: Preferences = {
      VERSEMENT_ENVOYE: { COURRIEL: false, IN_APP: false },
      ACHAT_CONFIRME: { COURRIEL: false, IN_APP: false },
      COMMANDE_REMBOURSEE: { COURRIEL: false, IN_APP: false },
      EVENEMENT_ANNULE: { COURRIEL: false, IN_APP: false },
      CONTENU_REFUSE: { COURRIEL: false, IN_APP: false },
    };

    for (const e of EVENEMENTS) {
      if (!CATALOGUE[e].imperatif) continue;
      expect(canauxPour(e, toutCoupe)).toEqual([...CANAUX_LIVRES]);
    }
  });

  it("ne couvrent que ce qui engage quelqu'un", () => {
    // Une liste d'impératifs qui s'allonge est une liste dont plus personne ne
    // tient compte. Celle-ci se limite à l'argent, à un déplacement prévu, et
    // au refus — qui n'a aucun autre canal vers son auteur.
    const imperatifs = EVENEMENTS.filter((e) => CATALOGUE[e].imperatif);

    expect(imperatifs.sort()).toEqual(
      [
        // De l'argent qui bouge, dans un sens ou dans l'autre.
        "ACHAT_CONFIRME",
        "ABONNEMENT_RECU",
        "COMMANDE_REMBOURSEE",
        "VERSEMENT_ENVOYE",
        // Une décision qui n'a aucun autre canal vers son auteur.
        "CONTENU_REFUSE",
        // Un déplacement prévu, parfois payé.
        "EVENEMENT_ANNULE",
      ].sort(),
    );
  });

  it("se signalent comme non modifiables", () => {
    // L'écran les affiche grisés plutôt que cachés : on doit pouvoir
    // constater qu'on les recevra.
    expect(estModifiable("VERSEMENT_ENVOYE")).toBe(false);
    expect(estModifiable("VENTE_REALISEE")).toBe(true);
  });
});

describe("le catalogue lui-même", () => {
  it("nomme un modèle de courriel qui existe, ou aucun", () => {
    // `null` est un état transitoire assumé — l'événement n'est alors livré
    // qu'en in-app. Un nom inventé, lui, ferait échouer le dépôt au moment de
    // l'envoi, c'est-à-dire loin de l'endroit où on l'aurait écrit.
    for (const e of EVENEMENTS) {
      const m = CATALOGUE[e].modele;
      if (m !== null) expect(MODELES).toContain(m);
    }
  });

  it("décrit chaque événement en français lisible", () => {
    // Ces textes vont sur l'écran de réglages. Un libellé vide s'y verrait, un
    // libellé technique aussi.
    for (const e of EVENEMENTS) {
      expect(CATALOGUE[e].libelle.length).toBeGreaterThan(3);
      expect(CATALOGUE[e].explication.length).toBeGreaterThan(15);
      expect(CATALOGUE[e].libelle).not.toMatch(/[A-Z]{3,}_/);
    }
  });

  it("range chaque événement dans une audience", () => {
    // L'écran de réglages sépare acheteur et vendeur : un événement sans
    // audience n'apparaîtrait nulle part.
    const acheteur = evenementsPour("acheteur");
    const vendeur = evenementsPour("vendeur");

    expect(acheteur.length).toBeGreaterThan(0);
    expect(vendeur.length).toBeGreaterThan(0);
    // Réunis, les deux couvrent tout — aucun événement orphelin.
    expect(new Set([...acheteur, ...vendeur]).size).toBe(EVENEMENTS.length);
  });

  it("couvre les deux publics, comme demandé", () => {
    // La raison d'être du chantier : les notifications ne doivent pas servir
    // qu'aux vendeurs. Un acheteur a autant besoin d'être prévenu.
    expect(evenementsPour("acheteur")).toContain("ACHAT_CONFIRME");
    expect(evenementsPour("acheteur")).toContain("EVENEMENT_ANNULE");
    expect(evenementsPour("vendeur")).toContain("VENTE_REALISEE");
    expect(evenementsPour("vendeur")).toContain("CONTENU_REFUSE");
  });

  it("donne un défaut à chaque canal de chaque événement", () => {
    // Un canal absent serait lu comme « faux » par `??`, et la notification
    // disparaîtrait sans que rien ne le signale.
    for (const e of EVENEMENTS) {
      for (const c of CANAUX) {
        expect(typeof CATALOGUE[e].defauts[c]).toBe("boolean");
      }
    }
  });
});
