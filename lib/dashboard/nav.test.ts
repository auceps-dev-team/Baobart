import { describe, expect, it } from "vitest";

import { messageProgression, navigationPour } from "./nav";

const entrees = (etape: Parameters<typeof navigationPour>[0]) =>
  navigationPour(etape).flatMap((g) => g.entrees);

const trouver = (etape: Parameters<typeof navigationPour>[0], cle: string) =>
  entrees(etape).find((e) => e.cle === cle);

describe("palier acheteur", () => {
  it("ne montre qu'une seule porte vers la vente", () => {
    const createurs = entrees("ACHETEUR").filter((e) => e.cle.startsWith("c_"));

    expect(createurs).toHaveLength(1);
    expect(createurs[0]).toMatchObject({ label: "Devenir vendeur", actif: true });
  });

  it("garde toutes les entrées acheteur ouvertes", () => {
    const acheteur = entrees("ACHETEUR").filter((e) => !e.cle.startsWith("c_"));

    expect(acheteur.length).toBeGreaterThan(5);
    expect(acheteur.every((e) => e.actif)).toBe(true);
  });

  it("n'affiche aucune entrée grisée — il n'y a rien à promettre encore", () => {
    expect(entrees("ACHETEUR").every((e) => e.actif)).toBe(true);
  });
});

describe("palier atelier", () => {
  it("fait apparaître les entrées créateur", () => {
    const createurs = entrees("ATELIER").filter((e) => e.cle.startsWith("c_"));
    expect(createurs.length).toBeGreaterThan(5);
  });

  it("laisse atteignable ce qui sert à travailler le brouillon", () => {
    // Sans ça, le produit qu'on vient de créer serait inaccessible.
    for (const cle of ["c_apercu", "c_produits", "c_publier"]) {
      expect(trouver("ATELIER", cle)?.actif, cle).toBe(true);
    }
  });

  it("grise ce qui n'a pas encore de sens", () => {
    for (const cle of ["c_revenus", "c_ventes", "c_stats", "c_profil"]) {
      expect(trouver("ATELIER", cle)?.actif, cle).toBe(false);
    }
  });

  it("dit ce qui débloquera chaque entrée grisée", () => {
    const verrouillees = entrees("ATELIER").filter((e) => !e.actif);

    expect(verrouillees.length).toBeGreaterThan(0);
    expect(verrouillees.every((e) => (e.raisonVerrou ?? "").length > 10)).toBe(
      true,
    );
  });

  it("n'affiche jamais de raison sur une entrée ouverte", () => {
    expect(
      entrees("ATELIER")
        .filter((e) => e.actif)
        .every((e) => e.raisonVerrou === null),
    ).toBe(true);
  });
});

describe("palier boutique", () => {
  it("ouvre tout", () => {
    expect(entrees("BOUTIQUE").every((e) => e.actif)).toBe(true);
  });

  it("expose le profil de la boutique, verrouillé au palier précédent", () => {
    expect(trouver("ATELIER", "c_profil")?.actif).toBe(false);
    expect(trouver("BOUTIQUE", "c_profil")?.actif).toBe(true);
  });
});

describe("continuité entre les paliers", () => {
  it("les entrées acheteur ne disparaissent jamais", () => {
    const cles = (etape: Parameters<typeof navigationPour>[0]) =>
      entrees(etape)
        .filter((e) => !e.cle.startsWith("c_"))
        .map((e) => e.cle);

    expect(cles("ATELIER")).toEqual(cles("ACHETEUR"));
    expect(cles("BOUTIQUE")).toEqual(cles("ACHETEUR"));
  });

  it("aucune clé n'apparaît deux fois", () => {
    for (const etape of ["ACHETEUR", "ATELIER", "BOUTIQUE"] as const) {
      const cles = entrees(etape).map((e) => e.cle);
      expect(new Set(cles).size, etape).toBe(cles.length);
    }
  });
});

describe("message d'accompagnement", () => {
  it("annonce la boutique en ligne quand quelque chose est publié", () => {
    expect(
      messageProgression({ etape: "BOUTIQUE", aPublie: true }),
    ).toContain("en ligne");
  });

  it("ne prétend pas qu'une boutique vide est en ligne", () => {
    // Le cas du compte qui a vendu puis tout retiré : il garde son palier
    // grâce à son historique, mais il n'a plus rien en vente.
    const m = messageProgression({ etape: "BOUTIQUE", aPublie: false });

    expect(m).not.toContain("en ligne");
    expect(m).toContain("Plus rien en vente");
  });

  it("promet la suite à qui vient de déposer un brouillon", () => {
    expect(messageProgression({ etape: "ATELIER", aPublie: false })).toContain(
      "première publication",
    );
  });
});

/**
 * La section « Plateforme » — et le défaut qu'elle a porté.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE QUE CES TESTS GARDENT
 *
 * Le filtre laissait passer toute entrée d'administration qui ne déclarait
 * pas de pouvoir : l'absence ouvrait au lieu de fermer. « Versements
 * créateurs » et « Membres » s'affichaient donc à n'importe quel acheteur.
 *
 * Les pages étaient gardées — le clic tombait sur un 404 — mais le menu
 * promettait deux écrans qui n'existaient pas pour cette personne. C'est
 * précisément ce que le champ `pouvoir` existe pour éviter.
 *
 * Le type `EntreeAdmin` rend désormais l'oubli impossible à la compilation.
 * Ces tests tiennent l'autre bout : que le filtre lise bien le rôle.
 */
describe("la section Plateforme", () => {
  const plateforme = (role: Parameters<typeof navigationPour>[1]) =>
    navigationPour("BOUTIQUE", role).find((g) => g.titre === "Plateforme");

  it("n'existe pas pour un membre ordinaire", () => {
    // Le cas qui a échoué : un créateur voyait « Versements créateurs » et
    // « Membres ». Aucune entrée d'administration ne lui revient.
    expect(plateforme("MEMBER")).toBeUndefined();
  });

  it("n'existe pas non plus quand aucun rôle n'est précisé", () => {
    // Le défaut du paramètre est MEMBER : un appelant qui oublie de passer le
    // rôle ne doit pas ouvrir le back-office par accident.
    const groupes = navigationPour("BOUTIQUE");
    expect(groupes.find((g) => g.titre === "Plateforme")).toBeUndefined();
  });

  it("montre la file à l'éditorial aussi, pas seulement au modérateur", () => {
    // Depuis v1.51.1, la file mélange trois CMS qui n'exigent pas le même
    // pouvoir. L'entrée déclare donc deux pouvoirs, et un seul suffit — sinon
    // elle se fermerait à tout le monde sauf l'administrateur.
    //
    // Ce que chacun y VOIT est une autre question, tranchée par
    // `typesRelusPar`. Le menu dit seulement que la porte s'ouvre.
    for (const role of ["MODERATOR", "CONTENT_MANAGER", "ADMIN"] as const) {
      expect(plateforme(role)?.entrees.map((e) => e.cle)).toContain(
        "a_moderation",
      );
    }
  });

  it("ne l'ouvre pas à qui ne relit rien", () => {
    const cles = plateforme("ACCOUNTANT")?.entrees.map((e) => e.cle) ?? [];
    expect(cles).not.toContain("a_moderation");
  });

  it("ne donne au modérateur que sa file", () => {
    const cles = plateforme("MODERATOR")?.entrees.map((e) => e.cle) ?? [];

    expect(cles).toContain("a_moderation");
    // Ni l'argent, ni les membres, ni l'état technique : un modérateur n'a
    // rien à y faire (§20.1).
    expect(cles).not.toContain("a_versements");
    expect(cles).not.toContain("a_membres");
    expect(cles).not.toContain("a_sys_config");
  });

  it("ne donne au rédacteur que le contenu, jamais l'exploitation", () => {
    const cles = plateforme("CONTENT_MANAGER")?.entrees.map((e) => e.cle) ?? [];

    // Trois entrées depuis v1.53.0 : la file (les contenus soumis attendent
    // là, et c'est `publier_du_contenu` qui les y tranche), le blog, et les
    // événements. Les trois relèvent du même pouvoir éditorial.
    expect(cles).toEqual(["a_moderation", "a_blog", "a_evenements"]);

    // Ce qui ne bouge pas, et c'est le vrai objet de ce test : ni l'argent, ni
    // les membres, ni l'état technique (§20.1).
    expect(cles).not.toContain("a_versements");
    expect(cles).not.toContain("a_membres");
    expect(cles).not.toContain("a_sys_config");
  });

  it("donne les publicités au marketing et à l'administration, à eux seuls", () => {
    // Décidé le 03/10. L'entrée vit hors de `/dashboard/systeme`, dont le
    // layout aurait fermé la porte au marketing avec un 404.
    expect(plateforme("MARKETING")?.entrees.map((e) => e.cle)).toEqual(["a_publicites", "a_temoignages"]);
    expect(plateforme("ADMIN")?.entrees.map((e) => e.cle)).toContain("a_publicites");
    for (const role of ["CONTENT_MANAGER", "MODERATOR", "ACCOUNTANT"] as const) {
      expect(plateforme(role)?.entrees.map((e) => e.cle) ?? []).not.toContain("a_publicites");
    }
  });

  it("ouvre les écrans techniques à l'administrateur", () => {
    const cles = plateforme("ADMIN")?.entrees.map((e) => e.cle) ?? [];

    for (const attendue of [
      "a_moderation",
      "a_evenements",
      "a_sys_config",
      "a_versements",
      "a_membres",
    ]) {
      expect(cles).toContain(attendue);
    }
  });

  it("accorde chaque entrée au pouvoir que sa page exige", () => {
    // Les cinq écrans « Système » sont gardés par `exigerAdministrateur`,
    // c'est-à-dire `consulter_le_systeme`. Un rôle qui ne l'a pas ne doit en
    // voir aucun — sinon le menu annonce un 404.
    for (const role of ["MODERATOR", "CONTENT_MANAGER", "SUPPORT"] as const) {
      const cles = plateforme(role)?.entrees.map((e) => e.cle) ?? [];
      for (const technique of [
        "a_sys_config",
        "a_sys_emails",
        "a_sys_paiements",
        "a_versements",
        "a_membres",
      ]) {
        expect(cles).not.toContain(technique);
      }
    }
  });
});

/**
 * La section Organiser.
 *
 * Elle n'existe pas pour un rôle : elle existe pour un **badge**, que rien
 * dans `RolePlateforme` ne porte (§18.3). D'où le troisième paramètre, et
 * d'où ces tests — le seul endroit où l'on vérifie qu'un défaut oublié ferme
 * au lieu d'ouvrir.
 */
describe("la section Organiser", () => {
  const organiser = (
    etape: Parameters<typeof navigationPour>[0],
    role: Parameters<typeof navigationPour>[1],
    extras?: Parameters<typeof navigationPour>[2],
  ) => navigationPour(etape, role, extras).find((g) => g.titre === "Organiser");

  it("n'existe pas quand le paramètre est omis", () => {
    // Le défaut ferme. C'est la même règle que pour « Plateforme », et elle a
    // déjà coûté une correction (v1.48.8).
    expect(organiser("BOUTIQUE", "MEMBER")).toBeUndefined();
    expect(organiser("ACHETEUR", "MEMBER")).toBeUndefined();
  });

  it("apparaît pour une agence badgée, même sans boutique", () => {
    // Le cas qui justifie un groupe à part : organiser n'est pas vendre. Une
    // agence qui n'a jamais rien mis en vente reste au palier ACHETEUR.
    const groupe = organiser("ACHETEUR", "MEMBER", { organisateur: true });

    expect(groupe?.entrees.map((e) => e.cle)).toEqual(["o_evenements"]);
    expect(groupe?.entrees[0]?.actif).toBe(true);
    // Jamais grisée : elle ne dépend d'aucune progression de compte.
    expect(groupe?.entrees[0]?.raisonVerrou).toBeNull();
  });

  it("laisse la place à « Plateforme » quand la personne administre", () => {
    // Deux entrées vers le même écran feraient douter qu'il s'agisse du même.
    // C'est « Plateforme » qui gagne : elle dit en plus qu'on voit tout.
    const groupes = navigationPour("BOUTIQUE", "CONTENT_MANAGER", {
      organisateur: true,
    });

    expect(groupes.find((g) => g.titre === "Organiser")).toBeUndefined();
    expect(
      groupes
        .find((g) => g.titre === "Plateforme")
        ?.entrees.map((e) => e.cle),
    ).toContain("a_evenements");
  });

  it("ne mène jamais ailleurs que sur l'écran des événements", () => {
    // Le groupe est ouvert à des comptes qui n'administrent rien : une entrée
    // ajoutée ici sans y penser leur promettrait un écran gardé en 404.
    const groupe = organiser("BOUTIQUE", "MEMBER", { organisateur: true });

    for (const e of groupe?.entrees ?? []) {
      expect(e.href).toBe("/dashboard/evenements");
    }
  });
});

/**
 * L'entrée « Notifications » et sa pastille.
 *
 * Elle vit dans le groupe acheteur, et c'est le point : le centre de
 * notifications n'est pas un écran de vendeur. Un acheteur y trouve ses reçus
 * et l'annulation de l'événement où il s'était inscrit.
 */
describe("les notifications dans le menu", () => {
  const cles = (etape: Parameters<typeof navigationPour>[0]) =>
    navigationPour(etape).flatMap((g) => g.entrees).map((e) => e.cle);

  it("apparaissent à tous les paliers, y compris au premier", () => {
    // Quelqu'un qui n'a jamais rien vendu reçoit quand même des reçus.
    expect(cles("ACHETEUR")).toContain("notifications");
    expect(cles("ATELIER")).toContain("notifications");
    expect(cles("BOUTIQUE")).toContain("notifications");
  });

  it("n'affichent aucune pastille quand tout est lu", () => {
    // Une pastille qui dit « 0 » est une pastille qui dit qu'il n'y a rien —
    // exactement le contraire de ce à quoi elle sert.
    const entree = navigationPour("BOUTIQUE", "MEMBER", { nonLues: 0 })
      .flatMap((g) => g.entrees)
      .find((e) => e.cle === "notifications");

    expect(entree?.badge).toBeUndefined();
  });

  it("comptent les non-lues, et se plafonnent à 99+", () => {
    const badge = (nonLues: number) =>
      navigationPour("BOUTIQUE", "MEMBER", { nonLues })
        .flatMap((g) => g.entrees)
        .find((e) => e.cle === "notifications")?.badge;

    expect(badge(3)).toBe("3");
    expect(badge(99)).toBe("99");
    // Au-delà, « 1 248 » pousserait le libellé hors de la barre.
    expect(badge(100)).toBe("99+");
    expect(badge(4820)).toBe("99+");
  });

  it("ne posent la pastille que sur cette entrée", () => {
    // Le filtre se fait sur la clé : une erreur y mettrait un compteur sur
    // « Profil », et personne ne saurait ce qu'il compte.
    const avecBadge = navigationPour("BOUTIQUE", "MEMBER", { nonLues: 7 })
      .flatMap((g) => g.entrees)
      .filter((e) => e.badge === "7")
      .map((e) => e.cle);

    expect(avecBadge).toEqual(["notifications"]);
  });
});
