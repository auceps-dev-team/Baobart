/**
 * L'aiguilleur, contre la vraie base.
 *
 * ─────────────────────────────────────────────────────────────────
 * QUATRE PROPRIÉTÉS QUI DOIVENT TENIR
 *
 *   — un avis part sur les canaux ouverts, et sur eux seuls ;
 *   — un rejeu ne pose pas une seconde ligne. La clé vient du fait, pas du
 *     hasard : un webhook rejoué par l'opérateur doit se faire refuser ;
 *   — une préférence coupe ce qu'elle prétend couper, et un impératif
 *     l'ignore — c'est ce qui garantit qu'on ne puisse pas se rendre sourd à
 *     un avis de versement ;
 *   — rien ne lève. Prévenir est une conséquence de l'acte, pas une
 *     condition : un avis qui échoue ne doit pas défaire une vente.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { notifier } from "@/lib/notifications/aiguilleur";
import { enregistrer } from "@/lib/notifications/preferences";

/**
 * Une charge complète pour `RELANCE_ABONNEMENT`.
 *
 * Elle est écrite ici en entier plutôt qu'au fil des tests : trois d'entre eux
 * ont d'abord échoué sur une charge incomplète, et le message ne pointait pas
 * l'aiguilleur mais la validation du modèle, deux modules plus loin.
 */
const RELANCE = {
  nom: "Awa",
  offre: "Pass créateur",
  montant: "5 000 FCFA",
  lien: "https://baobart.test/forfait",
  jours: 3,
};

let n = 0;

async function personne() {
  n += 1;
  return db.user.create({
    data: { email: `notif-${n}@baobart.test` },
    select: { id: true, email: true },
  });
}

beforeEach(() => {
  n = 0;
});

describe("la livraison", () => {
  it("écrit dans la cloche et dépose le courriel", async () => {
    const moi = await personne();

    const suite = await notifier({
      destinataireId: moi.id,
      // `ABONNEMENT_A_RENOUVELER` a un modèle de courriel ET les deux canaux
      // ouverts par défaut : c'est le cas complet.
      evenement: "ABONNEMENT_A_RENOUVELER",
      cle: `relance-${moi.id}`,
      titre: "Ton abonnement arrive à échéance",
      corps: "Renouvelle avant vendredi pour garder l'accès.",
      lien: "/dashboard/forfait",
      charge: RELANCE,
    });

    expect(suite.canaux.sort()).toEqual(["COURRIEL", "IN_APP"]);
    expect(suite.doublons).toEqual([]);
    expect(suite.echecs).toEqual([]);

    const ligne = await db.notification.findFirstOrThrow({
      where: { userId: moi.id },
      select: { type: true, titre: true, corps: true, lien: true, readAt: true },
    });
    expect(ligne.type).toBe("ABONNEMENT_A_RENOUVELER");
    expect(ligne.titre).toContain("échéance");
    expect(ligne.lien).toBe("/dashboard/forfait");
    // Elle naît non lue, évidemment — mais c'est ce qui fait la pastille.
    expect(ligne.readAt).toBeNull();

    expect(await db.emailOutbox.count({ where: { recipient: moi.email } })).toBe(1);
  });

  it("livre sur les deux canaux un refus de publication", async () => {
    // Ce test disait l'inverse jusqu'en v1.52.2 : `CONTENU_REFUSE` n'avait pas
    // de modèle de courriel, et n'était livré qu'en in-app. C'était un état
    // transitoire, il est levé — les huit modèles manquants ont été écrits.
    //
    // Il compte double ici : un refus est le SEUL canal vers l'auteur d'une
    // fiche écartée, puisqu'il n'y a pas de messagerie (§22.6).
    const moi = await personne();

    const suite = await notifier({
      destinataireId: moi.id,
      evenement: "CONTENU_REFUSE",
      cle: `refus-${moi.id}`,
      titre: "Ta fiche n'a pas été retenue",
      corps: "La date est déjà passée.",
      charge: {
        titre: "Atelier sérigraphie",
        motif: "La date est déjà passée, et le lieu n'est pas renseigné.",
      },
    });

    expect(suite.canaux.sort()).toEqual(["COURRIEL", "IN_APP"]);
    expect(suite.echecs).toEqual([]);
    expect(await db.emailOutbox.count({ where: { recipient: moi.email } })).toBe(1);
    expect(await db.notification.count({ where: { userId: moi.id } })).toBe(1);
  });

  it("ne pose rien pour un compte qui n'existe plus", async () => {
    // Un compte supprimé entre le fait et l'avis. Rien à prévenir, rien à
    // réparer, et surtout rien qui lève.
    const suite = await notifier({
      destinataireId: "cl00000000000000000000",
      evenement: "VENTE_REALISEE",
      cle: "vente-fantome",
      titre: "Nouvelle vente",
      corps: "Quelqu'un vient d'acheter.",
    });

    expect(suite).toEqual({ canaux: [], doublons: [], echecs: [] });
    expect(await db.notification.count()).toBe(0);
  });
});

describe("l'idempotence", () => {
  it("refuse un rejeu sur les deux canaux", async () => {
    const moi = await personne();

    const avis = {
      destinataireId: moi.id,
      evenement: "ABONNEMENT_A_RENOUVELER" as const,
      cle: `relance-${moi.id}`,
      titre: "Ton abonnement arrive à échéance",
      corps: "Renouvelle avant vendredi.",
      charge: RELANCE,
    };

    const premier = await notifier(avis);
    const second = await notifier(avis);

    expect(premier.canaux.sort()).toEqual(["COURRIEL", "IN_APP"]);
    // Le second ne pose rien et le dit : c'est un rejeu, pas une erreur.
    expect(second.canaux).toEqual([]);
    expect(second.doublons.sort()).toEqual(["COURRIEL", "IN_APP"]);

    expect(await db.notification.count({ where: { userId: moi.id } })).toBe(1);
    expect(await db.emailOutbox.count({ where: { recipient: moi.email } })).toBe(1);
  });

  it("laisse passer deux avis différents sur le même compte", async () => {
    // La clé porte le fait, pas la personne : deux faits distincts font deux
    // lignes, même destinataire.
    const moi = await personne();

    await notifier({
      destinataireId: moi.id,
      evenement: "CONTENU_REFUSE",
      cle: `refus-un-${moi.id}`,
      titre: "Première fiche refusée",
      corps: "Il manque le lieu.",
    });
    await notifier({
      destinataireId: moi.id,
      evenement: "CONTENU_REFUSE",
      cle: `refus-deux-${moi.id}`,
      titre: "Seconde fiche refusée",
      corps: "La date est passée.",
    });

    expect(await db.notification.count({ where: { userId: moi.id } })).toBe(2);
  });
});

describe("les préférences", () => {
  it("coupent le canal qu'on a fermé, et lui seul", async () => {
    const moi = await personne();

    const pose = await enregistrer({
      utilisateurId: moi.id,
      evenement: "ABONNEMENT_A_RENOUVELER",
      canal: "COURRIEL",
      actif: false,
    });
    expect(pose).toBe(true);

    const suite = await notifier({
      destinataireId: moi.id,
      evenement: "ABONNEMENT_A_RENOUVELER",
      cle: `relance-${moi.id}`,
      titre: "Ton abonnement arrive à échéance",
      corps: "Renouvelle avant vendredi.",
      charge: RELANCE,
    });

    expect(suite.canaux).toEqual(["IN_APP"]);
    // Fermé par préférence, pas en échec : la distinction est tout l'intérêt
    // du troisième champ.
    expect(suite.echecs).toEqual([]);
    expect(await db.emailOutbox.count({ where: { recipient: moi.email } })).toBe(0);
    expect(await db.notification.count({ where: { userId: moi.id } })).toBe(1);
  });

  it("s'effacent quand on revient au défaut", async () => {
    // Sans ça, quelqu'un qui coupe puis rallume garderait une ligne figée sur
    // la valeur d'aujourd'hui, et ne suivrait plus le défaut le jour où il
    // change.
    const moi = await personne();

    await enregistrer({
      utilisateurId: moi.id,
      evenement: "VENTE_REALISEE",
      canal: "COURRIEL",
      actif: false,
    });
    expect(await db.notificationPreference.count({ where: { userId: moi.id } })).toBe(1);

    await enregistrer({
      utilisateurId: moi.id,
      evenement: "VENTE_REALISEE",
      canal: "COURRIEL",
      actif: true,
    });
    expect(await db.notificationPreference.count({ where: { userId: moi.id } })).toBe(0);
  });

  it("ne rangent jamais un réglage impératif", async () => {
    // La garde vit dans le module, pas seulement dans l'écran : un formulaire
    // posté à la main enverrait n'importe quel couple.
    const moi = await personne();

    const pose = await enregistrer({
      utilisateurId: moi.id,
      evenement: "VERSEMENT_ENVOYE",
      canal: "COURRIEL",
      actif: false,
    });

    expect(pose).toBe(false);
    expect(await db.notificationPreference.count({ where: { userId: moi.id } })).toBe(0);
  });

  it("ignorent une ligne impérative posée directement en base", async () => {
    // Le vrai test du garde-fou : même si une ligne existe — écrite par une
    // migration maladroite, une console, ou un bogue passé — l'avis part.
    const moi = await personne();

    await db.notificationPreference.create({
      data: {
        userId: moi.id,
        evenement: "VERSEMENT_ENVOYE",
        canal: "COURRIEL",
        actif: false,
      },
    });

    const suite = await notifier({
      destinataireId: moi.id,
      evenement: "VERSEMENT_ENVOYE",
      cle: `versement-${moi.id}`,
      titre: "Ton versement est parti",
      corps: "45 000 FCFA vers ton compte Orange Money.",
      charge: { nom: "Awa", montant: "45 000 FCFA", compte: "Orange Money ••42" },
    });

    expect(suite.canaux.sort()).toEqual(["COURRIEL", "IN_APP"]);
  });

  it("ne rangent pas un événement ou un canal inconnu", async () => {
    const moi = await personne();

    expect(
      await enregistrer({
        utilisateurId: moi.id,
        evenement: "INVENTE_DE_TOUTES_PIECES",
        canal: "COURRIEL",
        actif: false,
      }),
    ).toBe(false);

    expect(
      await enregistrer({
        utilisateurId: moi.id,
        evenement: "VENTE_REALISEE",
        canal: "PIGEON_VOYAGEUR",
        actif: false,
      }),
    ).toBe(false);

    expect(await db.notificationPreference.count()).toBe(0);
  });
});

describe("ce qui devait partir et n'est pas parti", () => {
  it("se distingue d'un canal fermé", async () => {
    // Le défaut que les tests ont trouvé : une charge malformée était refusée
    // au dépôt, journalisée, et l'appelant recevait exactement la même réponse
    // que si la personne avait coupé son courriel.
    //
    // Un avis qui ne part jamais et que personne ne remarque est pire qu'un
    // avis absent : on croit prévenir.
    const moi = await personne();

    const suite = await notifier({
      destinataireId: moi.id,
      evenement: "ABONNEMENT_A_RENOUVELER",
      cle: `relance-cassee-${moi.id}`,
      titre: "Ton abonnement arrive à échéance",
      corps: "Renouvelle avant vendredi.",
      // Il manque `offre` et `montant` : le modèle refusera au dépôt.
      charge: { nom: "Awa", jours: 3, lien: "https://baobart.test/forfait" },
    });

    expect(suite.echecs).toEqual(["COURRIEL"]);
    // L'in-app, lui, est passé : un canal qui échoue n'emporte pas l'autre.
    expect(suite.canaux).toEqual(["IN_APP"]);
    expect(await db.emailOutbox.count({ where: { recipient: moi.email } })).toBe(0);
    expect(await db.notification.count({ where: { userId: moi.id } })).toBe(1);
  });

  it("ne laisse plus aucun événement sans modèle de courriel", async () => {
    // L'état transitoire est levé : les huit `modele: null` du catalogue ont
    // reçu leur texte en v1.52.2. Ce test garde l'acquis — un neuvième
    // événement ajouté sans modèle le ferait tomber, et c'est le moment où
    // l'on veut y penser, pas trois mois plus tard devant une file vide.
    const { CATALOGUE, EVENEMENTS } = await import(
      "@/lib/notifications/catalogue"
    );

    const sansModele = EVENEMENTS.filter((e) => CATALOGUE[e].modele === null);
    expect(sansModele).toEqual([]);
  });
});
