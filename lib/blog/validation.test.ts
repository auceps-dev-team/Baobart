import { describe, expect, it } from "vitest";

import { valider, type Saisie } from "./validation";

const CORPS =
  "Le wax n'est pas né en Afrique de l'Ouest, et c'est une histoire que peu " +
  "de gens racontent en entier. Il arrive par les Pays-Bas, au XIXe siècle, " +
  "après un détour par l'Indonésie — et il devient ici quelque chose que " +
  "personne n'avait prévu. Voici comment.";

function saisie(over: Partial<Saisie> = {}): Saisie {
  return {
    titre: "D'où vient vraiment le wax",
    corps: CORPS,
    extrait: "",
    categorieId: "",
    couvertureUrl: "",
    seoTitre: "",
    seoDescription: "",
    urlCanonique: "",
    aLaUne: "",
    parutionPrevue: "",
    ...over,
  };
}

describe("le titre", () => {
  it("fait l'adresse de l'article", () => {
    const v = valider(saisie());
    if (!v.ok) throw new Error(v.refus.message);

    expect(v.article.slug).toBe("d-ou-vient-vraiment-le-wax");
  });

  it("refuse ce qui ne produit aucune adresse", () => {
    // Un titre d'emoji ou de ponctuation passe les deux contrôles de longueur
    // et donne un slug vide, donc une adresse vide.
    const v = valider(saisie({ titre: "!!! ??? ..." }));

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("titre");
    expect(v.refus.message).toContain("adresse");
  });

  it("écrase les espaces multiples", () => {
    const v = valider(saisie({ titre: "  D'où   vient  le wax  " }));
    if (!v.ok) throw new Error(v.refus.message);

    expect(v.article.titre).toBe("D'où vient le wax");
  });

  it("refuse trop court et trop long", () => {
    expect(valider(saisie({ titre: "Wax" })).ok).toBe(false);
    expect(valider(saisie({ titre: "a".repeat(141) })).ok).toBe(false);
  });
});

describe("le corps", () => {
  it("refuse une brève", () => {
    // Un article qui tient en trois phrases n'est pas un article. Le seuil
    // dit où commence le blog, et il est plus haut que celui des événements.
    const v = valider(saisie({ corps: "Trois mots." }));

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("corps");
  });

  it("refuse un corps entierement blanc par sa longueur", () => {
    // Un corps de lignes vides est reduit a rien par `trim()`, donc refuse sur
    // la longueur.
    //
    // Une garde « aucun texte affichable » avait ete ecrite pour ce cas. Ce
    // test l'a montree inatteignable, et elle a ete retiree : un garde-fou
    // qu'aucune entree ne declenche laisse croire qu'il existe un cas qu'il
    // attrape. La propriete vit maintenant dans `corps.test.ts`, ou elle est
    // vraie — « tout corps non blanc rend au moins un bloc ».
    const v = valider(saisie({ corps: "\n".repeat(300) }));

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("corps");
    expect(v.refus.message).toContain("200");
  });
});

describe("l'extrait", () => {
  it("se déduit du corps quand l'auteur n'en écrit pas", () => {
    // Déduit à la validation plutôt qu'à l'affichage : ce qu'on range est ce
    // qu'on montrera, et l'auteur peut le relire avant de publier.
    const v = valider(saisie());
    if (!v.ok) throw new Error(v.refus.message);

    expect(v.article.extrait.length).toBeGreaterThan(20);
    expect(v.article.extrait.startsWith("Le wax n'est pas né")).toBe(true);
  });

  it("garde celui de l'auteur quand il y en a un", () => {
    const v = valider(saisie({ extrait: "Une histoire hollandaise." }));
    if (!v.ok) throw new Error(v.refus.message);

    expect(v.article.extrait).toBe("Une histoire hollandaise.");
  });

  it("refuse un extrait qui ne tient pas sur une carte", () => {
    expect(valider(saisie({ extrait: "a".repeat(201) })).ok).toBe(false);
  });
});

describe("les adresses", () => {
  it("refusent un schéma dangereux sur la couverture", () => {
    // Même garde que dans le corps : `href` et `src` acceptent n'importe quel
    // schéma, et React n'y peut rien.
    const v = valider(saisie({ couvertureUrl: "javascript:alert(1)" }));

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("couvertureUrl");
  });

  it("refusent un schéma dangereux sur la canonique", () => {
    expect(valider(saisie({ urlCanonique: "data:text/html,x" })).ok).toBe(false);
  });

  it("acceptent une adresse interne", () => {
    const v = valider(saisie({ couvertureUrl: "/img/wax.jpg" }));
    if (!v.ok) throw new Error(v.refus.message);

    expect(v.article.couvertureUrl).toBe("/img/wax.jpg");
  });
});

describe("le SEO", () => {
  it("laisse les deux champs vides plutôt que de recopier le titre", () => {
    // Deux champs vides valent mieux que deux champs recopiés qui
    // divergeront : l'affichage retombera sur le titre et l'extrait.
    const v = valider(saisie());
    if (!v.ok) throw new Error(v.refus.message);

    expect(v.article.seoTitre).toBeNull();
    expect(v.article.seoDescription).toBeNull();
  });

  it("refuse un titre SEO que les moteurs couperaient", () => {
    expect(valider(saisie({ seoTitre: "a".repeat(71) })).ok).toBe(false);
  });

  it("refuse une description SEO trop longue", () => {
    expect(valider(saisie({ seoDescription: "a".repeat(321) })).ok).toBe(false);
  });
});

describe("la mise à la une", () => {
  it("lit une case cochée, qui arrive « on »", () => {
    // Décochée, une case n'arrive pas du tout dans le formulaire. C'est la
    // présence qui vaut vrai, pas la valeur.
    expect(valider(saisie({ aLaUne: "on" })).ok && true).toBe(true);

    const coche = valider(saisie({ aLaUne: "on" }));
    if (!coche.ok) throw new Error("refusé");
    expect(coche.article.aLaUne).toBe(true);

    const decoche = valider(saisie());
    if (!decoche.ok) throw new Error("refusé");
    expect(decoche.article.aLaUne).toBe(false);
  });
});

describe("un seul refus à la fois", () => {
  it("nomme le premier champ fautif, pas les sept", () => {
    // Une liste de sept erreurs fait corriger la dernière et rater les six
    // autres. On dit la première, et l'on redemande.
    const v = valider(
      saisie({ titre: "x", corps: "y", extrait: "z".repeat(300) }),
    );

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("titre");
  });
});
