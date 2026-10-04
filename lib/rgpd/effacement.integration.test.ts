/**
 * L'effacement, contre une vraie base.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE TEST QUI COMPTE EST LE DERNIER
 *
 * `A_SUPPRIMER` est une liste écrite à la main. Une liste écrite à la main
 * vieillit en silence : le jour où quelqu'un ajoute une table avec
 * `onDelete: Cascade` vers `User` — ce que tout le monde fait sans y penser,
 * parce que c'est le bon réflexe partout ailleurs — elle restera en ligne
 * après un effacement, et rien ne le dira.
 *
 * Le dernier bloc interroge donc `information_schema` et exige que **chaque**
 * table qui cascade soit, soit effacée, soit exemptée avec une raison écrite.
 * La liste du module est recopiée ; celle du test est dérivée. C'est ce qui
 * empêche la copie de vieillir.
 */

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  DELAI_EFFACEMENT_MS,
  COUPLES_TRAITES,
  annulerEffacement,
  anonymiser,
  demanderEffacement,
  etatEffacement,
  executerLesEffacementsDus,
  cascadesVersUser,
} from "@/lib/rgpd/effacement";

let n = 0;
const suffixe = () => `${Date.now()}-${++n}`;

async function creerCompte() {
  const marque = suffixe();

  return db.user.create({
    data: {
      email: `rgpd-${marque}@baobart.test`,
      phone: "+2250700000000",
      passwordHash: "empreinte-factice",
      riskState: "COMPLIANT",
      profile: {
        create: {
          username: `rgpd-${marque}`,
          displayName: "Aya Kouassi",
          bio: "Illustratrice à Abidjan",
          city: "Abidjan",
          country: "CI",
        },
      },
      billing: {
        create: {
          firstName: "Aya",
          lastName: "Kouassi",
          addressLine1: "12 rue des Jardins",
          city: "Abidjan",
          country: "CI",
        },
      },
    },
    select: { id: true, email: true },
  });
}

describe("le caviardage", () => {
  it("vide l'identité sans supprimer la ligne", async () => {
    // La ligne DOIT rester : cinq tables la retiennent, dont `Order`. La
    // supprimer lèverait une contrainte de clé étrangère sur la demande de
    // quelqu'un qui attend une réponse.
    const compte = await creerCompte();

    const bilan = await anonymiser(compte.id);

    const apres = await db.user.findUnique({ where: { id: compte.id } });

    expect(apres).not.toBeNull();
    expect(apres!.email).toBe(bilan.adresseFinale);
    expect(apres!.email).toContain("@baobart.invalid");
    expect(apres!.phone).toBeNull();
    expect(apres!.passwordHash).toBeNull();
    expect(apres!.anonymizedAt).not.toBeNull();
    expect(apres!.suspendedAt).not.toBeNull();
  });

  it("emporte la lettre d'information et les messages, par le compte comme par l'adresse", async () => {
    // Ajoutés le 04/10. La lettre et un message écrit sans être connecté ne
    // portent aucune colonne vers User : seule l'adresse les relie.
    const compte = await creerCompte();
    // Pas `creerCompte` : son téléphone est fixe, et unique en base.
    const autre = await db.user.create({ data: { email: `rgpd-autre-${suffixe()}@baobart.test` }, select: { email: true } });
    const message = (email: string, senderId: string | null) =>
      db.contactMessage.create({ data: { kind: "CONTACT", senderId, name: "Aya", email, subject: "Un bug", body: "Un message assez long." } });
    await message("autre-adresse@baobart.test", compte.id);
    await message(compte.email, null);
    await message(autre.email, null);
    await db.newsletterSubscriber.create({
      data: { email: compte.email, confirmTokenHash: `c-${suffixe()}`, unsubscribeTokenHash: `d-${suffixe()}`, confirmExpiresAt: new Date() },
    });

    const bilan = await anonymiser(compte.id);

    expect(await db.contactMessage.count({ where: { OR: [{ senderId: compte.id }, { email: compte.email }] } })).toBe(0);
    expect(await db.newsletterSubscriber.count({ where: { email: compte.email } })).toBe(0);
    expect(bilan.supprimees).toMatchObject({ contactMessage: 1, "contactMessage (adresse)": 1, "newsletterSubscriber (adresse)": 1 });
    // Ce qu'un autre a écrit reste.
    expect(await db.contactMessage.count({ where: { email: autre.email } })).toBe(1);
  });

  it("retire le profil et la facturation", async () => {
    const compte = await creerCompte();

    await anonymiser(compte.id);

    expect(
      await db.profile.count({ where: { userId: compte.id } }),
    ).toBe(0);
    expect(
      await db.billingInfo.count({ where: { userId: compte.id } }),
    ).toBe(0);
  });

  it("ferme toutes les sessions", async () => {
    const compte = await creerCompte();
    await db.session.create({
      data: {
        userId: compte.id,
        token: `s-${suffixe()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
        ipAddress: "203.0.113.50",
      },
    });

    await anonymiser(compte.id);

    expect(await db.session.count({ where: { userId: compte.id } })).toBe(0);
  });

  it("efface l'adresse des événements de consommation", async () => {
    // Une donnée personnelle que le compteur qu'elle sert ne relit jamais.
    const compte = await creerCompte();
    const produit = await db.product.create({
      data: {
        sellerId: compte.id,
        slug: `p-${suffixe()}`,
        name: "Pack",
        price: 0,
        currency: "XOF",
      },
    });
    await db.consumptionEvent.create({
      data: {
        userId: compte.id,
        productId: produit.id,
        eventType: "DOWNLOAD",
        ipAddress: "203.0.113.51",
      },
    });

    await anonymiser(compte.id);

    const evenement = await db.consumptionEvent.findFirst({
      where: { userId: compte.id },
    });
    expect(evenement).not.toBeNull();
    expect(evenement!.ipAddress).toBeNull();
  });

  it("rend les places d'événement qu'il occupait", async () => {
    // Mesuré le 25/09 (Qualitytest S9, S39) : l'inscription partait, la place
    // restait prise — l'événement se disait complet avec une place libre.
    // Pas creerCompte() : il pose le même téléphone, unique en base.
    const organisateur = await db.user.create({ data: { email: `org-${suffixe()}@baobart.test` }, select: { id: true } });
    const compte = await creerCompte();
    const evenement = await db.event.create({
      data: {
        organizerId: organisateur.id,
        title: "Atelier",
        kind: "WORKSHOP",
        description: "Un atelier décrit avec assez de mots pour être publiable.",
        startsAt: new Date(Date.now() + 10 * 86_400_000),
        endsAt: new Date(Date.now() + 10 * 86_400_000 + 7_200_000),
        capacity: 2,
        participantsCount: 2,
        state: "PUBLIE",
      },
    });
    await db.eventRegistration.create({ data: { eventId: evenement.id, userId: compte.id } });
    await db.eventRegistration.create({ data: { eventId: evenement.id, userId: organisateur.id } });

    await anonymiser(compte.id);

    const apres = await db.event.findUniqueOrThrow({ where: { id: evenement.id } });
    expect(apres.participantsCount).toBe(1);
    expect(await db.eventRegistration.count({ where: { eventId: evenement.id } })).toBe(1);
  });

  it("archive les produits au lieu de les supprimer", async () => {
    // Ils ont été achetés : un `OrderItem` les désigne, et les supprimer
    // effacerait ce que des gens ont payé.
    const compte = await creerCompte();
    const produit = await db.product.create({
      data: {
        sellerId: compte.id,
        slug: `p-${suffixe()}`,
        name: "Pack wax",
        price: 5000,
        currency: "XOF",
        status: "PUBLISHED",
      },
    });

    await anonymiser(compte.id);

    const apres = await db.product.findUnique({ where: { id: produit.id } });
    expect(apres).not.toBeNull();
    expect(apres!.status).toBe("ARCHIVED");
  });

  it("laisse les écritures comptables intactes", async () => {
    // La raison d'être du caviardage : la comptabilité se conserve des années
    // après qu'un client est parti.
    const compte = await creerCompte();
    await db.balance.create({
      data: { userId: compte.id, currency: "XOF", date: new Date() },
    });

    await anonymiser(compte.id);

    expect(await db.balance.count({ where: { userId: compte.id } })).toBe(1);
  });
});

describe("la demande et son délai", () => {
  it("pose une échéance à trente jours", async () => {
    const compte = await creerCompte();

    const suite = await demanderEffacement(compte.id, "Je pars");

    expect(suite.ok).toBe(true);
    if (!suite.ok) return;

    const ecart = suite.executeLe.getTime() - Date.now();
    expect(ecart).toBeGreaterThan(DELAI_EFFACEMENT_MS - 60_000);
    expect(ecart).toBeLessThanOrEqual(DELAI_EFFACEMENT_MS);
  });

  it("laisse le compte utilisable pendant le délai", async () => {
    // Le fermer tout de suite exécuterait la demande sans attendre, et le
    // bouton d'annulation serait derrière une connexion qui ne marche plus.
    const compte = await creerCompte();

    await demanderEffacement(compte.id);

    const apres = await db.user.findUnique({ where: { id: compte.id } });
    expect(apres!.suspendedAt).toBeNull();
    expect(apres!.anonymizedAt).toBeNull();
  });

  it("refuse une seconde demande tant que la première court", async () => {
    const compte = await creerCompte();
    await demanderEffacement(compte.id);

    expect(await demanderEffacement(compte.id)).toEqual({
      ok: false,
      motif: "DEJA_DEMANDE",
    });
  });

  it("s'annule, et se redemande ensuite", async () => {
    const compte = await creerCompte();
    await demanderEffacement(compte.id);

    expect(await annulerEffacement(compte.id)).toBe(true);
    expect((await etatEffacement(compte.id)).demande).toBe(false);

    expect((await demanderEffacement(compte.id)).ok).toBe(true);
  });

  it("n'annule rien quand rien n'est demandé", async () => {
    const compte = await creerCompte();
    expect(await annulerEffacement(compte.id)).toBe(false);
  });

  it("ne laisse pas annuler après exécution", async () => {
    // Sinon l'écran dirait « demande annulée » à quelqu'un dont le compte est
    // déjà vidé, et il n'y a rien à restaurer.
    const compte = await creerCompte();
    await demanderEffacement(compte.id);
    await db.deletionRequest.update({
      where: { userId: compte.id },
      data: { executedAt: new Date() },
    });

    expect(await annulerEffacement(compte.id)).toBe(false);
  });

  it("refuse une demande sur un compte déjà effacé", async () => {
    const compte = await creerCompte();
    await anonymiser(compte.id);

    expect(await demanderEffacement(compte.id)).toEqual({
      ok: false,
      motif: "DEJA_EFFACE",
    });
  });
});

describe("l'exécution par l'ordonnanceur", () => {
  it("n'exécute rien avant l'échéance", async () => {
    const compte = await creerCompte();
    await demanderEffacement(compte.id);

    await executerLesEffacementsDus();

    expect(
      (await db.user.findUnique({ where: { id: compte.id } }))!.anonymizedAt,
    ).toBeNull();
  });

  it("exécute une demande échue et note l'exécution", async () => {
    const compte = await creerCompte();
    await demanderEffacement(compte.id);
    await db.deletionRequest.update({
      where: { userId: compte.id },
      data: { executeAfter: new Date(Date.now() - 1000) },
    });

    const bilan = await executerLesEffacementsDus();

    expect(bilan.traites).toBeGreaterThanOrEqual(1);
    expect(
      (await db.user.findUnique({ where: { id: compte.id } }))!.anonymizedAt,
    ).not.toBeNull();

    const demande = await db.deletionRequest.findUnique({
      where: { userId: compte.id },
    });
    // La ligne reste : c'est la seule preuve que la demande a été honorée.
    expect(demande).not.toBeNull();
    expect(demande!.executedAt).not.toBeNull();
  });

  it("n'exécute pas une demande annulée", async () => {
    const compte = await creerCompte();
    await demanderEffacement(compte.id);
    await db.deletionRequest.update({
      where: { userId: compte.id },
      data: {
        executeAfter: new Date(Date.now() - 1000),
        cancelledAt: new Date(),
      },
    });

    await executerLesEffacementsDus();

    expect(
      (await db.user.findUnique({ where: { id: compte.id } }))!.anonymizedAt,
    ).toBeNull();
  });
});

describe("la couverture des cascades", () => {
  /**
   * Ce qui cascade mais qu'on ne supprime PAS, et pourquoi.
   *
   * Chaque entrée est une décision, pas un oubli. Un couple qui n'est ni dans
   * `COUPLES_TRAITES` ni ici fait échouer le test suivant — ce qui force à
   * trancher au lieu de laisser filer.
   */
  const EXEMPTES: Record<string, string> = {
    "Product.sellerId":
      "archivé, pas supprimé : des OrderItem le désignent, et supprimer effacerait ce que des gens ont payé",
    "MediaAsset.ownerId":
      "référencé par les ProductFile des produits vendus ; part avec le produit le jour où celui-ci part",
    "Community.creatorId":
      "l'espace a des membres et leurs messages ; le supprimer détruirait le contenu d'autrui",
    "Event.organizerId":
      "des inscrits en dépendent ; l'annulation est un geste distinct, avec sa notification",
    "JobPosting.recruiterId":
      "des candidatures en dépendent, et elles appartiennent aux candidats",
    "ServiceOffer.creatorId": "des commandes de service peuvent la désigner",
    "WorkItem.authorId":
      "les pièces du portfolio sont référencées par les collections d'autrui",
    "DeletionRequest.userId":
      "c'est la preuve que la demande a été honorée : l'effacer effacerait la trace de l'effacement",
  };

  it("traite ou exempte chaque colonne qui cascade vers User", async () => {
    const cascades = await cascadesVersUser();

    // Sans se soucier de la casse : Prisma nomme ses délégués en `camelCase`,
    // Postgres ses tables en `PascalCase`.
    const traites = new Set(COUPLES_TRAITES.map((c) => c.toLowerCase()));
    const exemptes = new Set(Object.keys(EXEMPTES).map((c) => c.toLowerCase()));

    const oublies = cascades
      .map((c) => `${c.table}.${c.colonne}`)
      .filter(
        (c) => !traites.has(c.toLowerCase()) && !exemptes.has(c.toLowerCase()),
      );

    // Le message porte l'instruction : celui qui le lira dans six mois n'aura
    // pas ce fichier ouvert.
    expect(
      oublies,
      "Ces colonnes disparaîtraient si la ligne User était supprimée — or " +
        "l'effacement ne la supprime pas, donc leurs lignes RESTENT EN LIGNE " +
        "après un effacement. Ajoute-les à A_SUPPRIMER dans " +
        "lib/rgpd/effacement.ts, ou à EXEMPTES ici avec la raison.",
    ).toEqual([]);

    // Et l'on vérifie que la requête a trouvé quelque chose : une requête
    // cassée rendrait un tableau vide, et le test passerait en ne vérifiant
    // rien du tout.
    expect(cascades.length).toBeGreaterThan(20);
  });

  it("ne traite aucune colonne qui n'existerait plus", async () => {
    // L'autre sens : une entrée de `A_SUPPRIMER` qui ne correspond à rien
    // ferait lever l'effacement en pleine transaction, en production. C'est
    // ce qui est arrivé avec `save.userId`, qui n'a jamais existé — et avec
    // les neuf tables dont la colonne ne s'appelle pas `userId`.
    const cascades = new Set(
      (await cascadesVersUser()).map((c) =>
        `${c.table}.${c.colonne}`.toLowerCase(),
      ),
    );

    const fantomes = COUPLES_TRAITES.filter(
      (c) => !cascades.has(c.toLowerCase()),
    );

    expect(fantomes).toEqual([]);
  });

  it("couvre les DEUX sens d'une relation qui en a deux", async () => {
    // `Follow` et `TeamMembership` portent chacune deux colonnes vers User.
    // N'en traiter qu'une laisserait la moitié des lignes : ce que la
    // personne suivait partirait, ceux qui la suivaient resteraient.
    const cascades = await cascadesVersUser();

    const aDeuxColonnes = new Map<string, number>();
    for (const c of cascades) {
      aDeuxColonnes.set(c.table, (aDeuxColonnes.get(c.table) ?? 0) + 1);
    }

    const doubles = [...aDeuxColonnes.entries()]
      .filter(([, n]) => n > 1)
      .map(([t]) => t);

    // La liste n'est pas écrite ici : on la découvre, et l'on exige que
    // chaque colonne des tables concernées soit traitée ou exemptée.
    expect(doubles.length).toBeGreaterThan(0);

    const traites = new Set(COUPLES_TRAITES.map((c) => c.toLowerCase()));
    const exemptes = new Set(Object.keys(EXEMPTES).map((c) => c.toLowerCase()));

    for (const table of doubles) {
      for (const c of cascades.filter((x) => x.table === table)) {
        const couple = `${c.table}.${c.colonne}`.toLowerCase();
        expect(
          traites.has(couple) || exemptes.has(couple),
          `${c.table}.${c.colonne} n'est ni traité ni exempté`,
        ).toBe(true);
      }
    }
  });
});
