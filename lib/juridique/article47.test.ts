/**
 * Les six exigences de l'article 47, éprouvées une par une.
 *
 * ─────────────────────────────────────────────────────────────────
 * CE FICHIER SE RELIT À CÔTÉ DU TEXTE DE LOI
 *
 * C'est son intérêt principal, avant même d'attraper des régressions. Chaque
 * cas nomme l'exigence qu'il éprouve, dans les mots de la loi, pour qu'un
 * juriste qui ne lit pas TypeScript puisse vérifier qu'on n'a rien inventé et
 * rien oublié.
 *
 * Les deux cas qui comptent le plus sont ceux où l'on pourrait se tromper sans
 * que rien ne casse :
 *
 *   — une personne morale ne doit PAS se voir réclamer sa forme juridique ni
 *     son organe représentant. C'est le Sénégal qui les exige. Les demander
 *     ferait refuser des notifications que la loi ivoirienne tient pour
 *     complètes — un excès de zèle qui se lit comme de la rigueur ;
 *   — la correspondance préalable est obligatoire. L'oublier ferait de Baobart
 *     un guichet de retrait direct, comme le DMCA.
 */

import { describe, expect, it } from "vitest";

import {
  exigencesManquantes,
  validerNotification,
  type Saisie,
} from "@/lib/juridique/article47";

/** Une notification complète de personne physique. */
function physique(modifs: Partial<Saisie> = {}): Saisie {
  return {
    qualite: "PERSONNE_PHYSIQUE",
    courriel: "awa@exemple.ci",
    nom: "Diallo",
    adresse: "12 rue des Jardins, Cocody, Abidjan",
    prenoms: "Awa",
    profession: "Illustratrice",
    nationalite: "Ivoirienne",
    naissanceDate: "1992-04-17",
    naissanceLieu: "Bouaké",
    destinataireNom: "Mensah",
    destinatairePrenoms: "Kofi",
    destinataireAdresse: "Marcory, Abidjan",
    faits: "Mon illustration « Femme au foulard » est reproduite sans mon accord.",
    adressesVisees: "https://baobart.test/products/femme-au-foulard-copie",
    motifs:
      "Droit d'auteur : je suis l'autrice de cette illustration, publiée en 2024.",
    contactPrealable:
      "Je lui ai écrit le 2 septembre pour demander le retrait, sans réponse.",
    contactImpossible: false,
    ...modifs,
  };
}

/** Une notification complète de personne morale. */
function morale(modifs: Partial<Saisie> = {}): Saisie {
  return physique({
    qualite: "PERSONNE_MORALE",
    nom: "Studio Teranga",
    adresse: "Immeuble Alpha, Plateau, Abidjan",
    // Les champs de personne physique sont vides : la loi ne les demande pas
    // à une personne morale.
    prenoms: "",
    profession: "",
    nationalite: "",
    naissanceDate: "",
    naissanceLieu: "",
    ...modifs,
  });
}

describe("une notification complète", () => {
  it("passe pour une personne physique", () => {
    const v = validerNotification(physique());

    expect(v.complete).toBe(true);
    if (!v.complete) return;
    expect(v.valeur.nom).toBe("Diallo");
    expect(v.valeur.prenoms).toBe("Awa");
    expect(v.valeur.naissanceDate?.getFullYear()).toBe(1992);
  });

  it("passe pour une personne morale SANS forme juridique ni représentant", () => {
    // ════════════════════════════════════════════════════════════════════════
    // LE TEST QUI DISTINGUE LES DEUX LOIS
    //
    // Article 47, deuxième tiret : « si l'auteur de la notification est une
    // personne morale : sa dénomination et son siège social ». Deux éléments,
    // point final.
    //
    // La loi sénégalaise n° 2008-08 en demande quatre — forme, dénomination,
    // siège, organe représentant. Une première version de ce module suivait
    // celle-là : elle aurait refusé cette notification, qui est complète.
    const v = validerNotification(morale());

    expect(v.complete).toBe(true);
    if (!v.complete) return;
    expect(v.valeur.nom).toBe("Studio Teranga");
    // Les champs de personne physique ne remontent pas : ils ne la concernent
    // pas, et les laisser à la chaîne vide les ferait afficher sur le dossier.
    expect(v.valeur.prenoms).toBeNull();
    expect(v.valeur.naissanceDate).toBeNull();
  });
});

describe("qui notifie — personne physique", () => {
  it.each([
    ["nom", "nom"],
    ["prénoms", "prenoms"],
    ["profession", "profession"],
    ["domicile", "adresse"],
    ["nationalité", "nationalite"],
    ["lieu de naissance", "naissanceLieu"],
  ] as const)(
    "exige %s, que la loi énumère",
    (_libelle, champ) => {
      const v = validerNotification(physique({ [champ]: "" }));

      expect(v.complete).toBe(false);
      if (v.complete) return;
      expect(v.manques.map((m) => m.champ)).toContain(champ);
      expect(v.manques.map((m) => m.exigence)).toContain("notifiant");
    },
  );

  it("exige une date de naissance, et refuse le futur", () => {
    // Une date dans le futur n'est pas une date de naissance. Le cas se
    // produit par faute de frappe sur l'année, pas par malice — et il
    // passerait sans bruit.
    const futur = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    expect(validerNotification(physique({ naissanceDate: "" })).complete).toBe(false);
    expect(validerNotification(physique({ naissanceDate: futur })).complete).toBe(false);
    expect(validerNotification(physique({ naissanceDate: "n'importe quoi" })).complete).toBe(
      false,
    );
  });

  it("ne vérifie pas la majorité", () => {
    // La loi n'en fait pas une condition, et un mineur peut être l'auteur
    // d'une œuvre qu'on lui a prise.
    const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    expect(validerNotification(physique({ naissanceDate: hier })).complete).toBe(true);
  });

  it("exige une adresse électronique, qui n'est pas dans la liste", () => {
    // Hors article 47, et pourtant obligatoire ici : sans adresse de retour,
    // on ne peut ni accuser réception, ni réclamer ce qui manque, ni annoncer
    // la décision. La loi décrit le minimum de la présomption de connaissance,
    // pas une procédure utilisable.
    const v = validerNotification(physique({ courriel: "pas-une-adresse" }));

    expect(v.complete).toBe(false);
    if (v.complete) return;
    expect(v.manques.map((m) => m.champ)).toContain("courriel");
  });
});

describe("qui notifie — personne morale", () => {
  it("exige la dénomination et le siège social", () => {
    expect(validerNotification(morale({ nom: "" })).complete).toBe(false);
    expect(validerNotification(morale({ adresse: "" })).complete).toBe(false);
  });

  it.each(["prenoms", "profession", "nationalite", "naissanceLieu"] as const)(
    "n'exige PAS %s d'une personne morale",
    (champ) => {
      const v = validerNotification(morale({ [champ]: "" }));
      expect(v.complete).toBe(true);
    },
  );

  it("n'exige pas de date de naissance d'une personne morale", () => {
    expect(validerNotification(morale({ naissanceDate: "" })).complete).toBe(true);
  });
});

describe("qui est visé", () => {
  it("exige le nom du destinataire du service en cause", () => {
    const v = validerNotification(physique({ destinataireNom: "" }));

    expect(v.complete).toBe(false);
    if (v.complete) return;
    expect(v.manques.map((m) => m.exigence)).toContain("destinataire");
  });

  it("accepte un destinataire sans prénoms ni domicile connus", () => {
    // La loi les énumère, mais les exiger rendrait toute notification
    // impossible contre un pseudonyme — c'est-à-dire contre la majorité des
    // comptes. On les recueille ; on ne les impose pas.
    const v = validerNotification(
      physique({ destinatairePrenoms: "", destinataireAdresse: "" }),
    );

    expect(v.complete).toBe(true);
    if (!v.complete) return;
    expect(v.valeur.destinatairePrenoms).toBeNull();
    expect(v.valeur.destinataireAdresse).toBeNull();
  });
});

describe("la localisation précise sur le réseau", () => {
  it("refuse une description sans adresse", () => {
    // « Tout son profil » ne localise rien, et conduirait à retirer des pages
    // que personne n'a regardées.
    const v = validerNotification(physique({ adressesVisees: "tout son profil" }));

    expect(v.complete).toBe(false);
    if (v.complete) return;
    expect(v.manques.map((m) => m.exigence)).toContain("localisation");
  });

  it("accepte plusieurs adresses, une par ligne", () => {
    const v = validerNotification(
      physique({
        adressesVisees:
          "https://baobart.test/products/a\n  \nhttps://baobart.test/products/b\n",
      }),
    );

    expect(v.complete).toBe(true);
    if (!v.complete) return;
    expect(v.valeur.adressesVisees).toEqual([
      "https://baobart.test/products/a",
      "https://baobart.test/products/b",
    ]);
  });

  it("écarte les adresses qui ne sont ni http ni https", () => {
    // Cette chaîne sera affichée à un modérateur qui cliquera dessus. Une
    // adresse hostile dans un dossier juridique viserait exactement la
    // personne qui a le plus de pouvoir sur le compte visé.
    const v = validerNotification(
      physique({
        adressesVisees: "javascript:alert(1)\ndata:text/html,<script>\nfile:///etc/passwd",
      }),
    );

    expect(v.complete).toBe(false);
    if (v.complete) return;
    expect(v.manques.map((m) => m.exigence)).toContain("localisation");
  });

  it("garde les bonnes et écarte les mauvaises quand les deux sont mêlées", () => {
    const v = validerNotification(
      physique({
        adressesVisees: "javascript:alert(1)\nhttps://baobart.test/products/a",
      }),
    );

    expect(v.complete).toBe(true);
    if (!v.complete) return;
    expect(v.valeur.adressesVisees).toEqual(["https://baobart.test/products/a"]);
  });
});

describe("les droits et les motifs", () => {
  it("les exige", () => {
    const v = validerNotification(physique({ motifs: "" }));

    expect(v.complete).toBe(false);
    if (v.complete) return;
    expect(v.manques.map((m) => m.exigence)).toContain("motifs");
  });

  it("n'en fait qu'un seul champ", () => {
    // La loi ivoirienne dit « les droits ET les motifs » en une seule
    // exigence. La loi sénégalaise les sépare — scinder ici obligerait à
    // répartir une phrase entre deux cases, et ferait refuser une notification
    // qui dit tout dans la première.
    const v = validerNotification(
      physique({ motifs: "Droit d'auteur, je suis l'autrice de cette image." }),
    );

    expect(v.complete).toBe(true);
  });
});

describe("la correspondance préalable", () => {
  it("est obligatoire — c'est ce que le DMCA n'a pas", () => {
    // Elle oblige à parler à la personne AVANT de s'adresser à la plateforme.
    // Beaucoup de dossiers s'arrêtent là, parce qu'un créateur prévenu retire
    // ou crédite sans qu'on aille plus loin.
    const v = validerNotification(physique({ contactPrealable: "" }));

    expect(v.complete).toBe(false);
    if (v.complete) return;
    expect(v.manques.map((m) => m.exigence)).toContain("correspondance");
  });

  it("accepte à la place une justification de ce qu'on n'a pu joindre l'auteur", () => {
    const v = validerNotification(
      physique({
        contactImpossible: true,
        contactPrealable:
          "Le compte ne donne ni adresse ni moyen de contact, et n'accepte pas les messages.",
      }),
    );

    expect(v.complete).toBe(true);
    if (!v.complete) return;
    expect(v.valeur.contactImpossible).toBe(true);
  });

  it("adapte son message selon qu'on a écrit ou qu'on n'a pas pu", () => {
    const ecrit = validerNotification(physique({ contactPrealable: "" }));
    const impossible = validerNotification(
      physique({ contactPrealable: "", contactImpossible: true }),
    );

    if (ecrit.complete || impossible.complete) throw new Error("incomplet attendu");

    const m1 = ecrit.manques.find((m) => m.exigence === "correspondance");
    const m2 = impossible.manques.find((m) => m.exigence === "correspondance");

    expect(m1?.message).toContain("adressé à l'auteur");
    expect(m2?.message).toContain("pas pu joindre");
  });
});

describe("ce qui remonte à l'écran", () => {
  it("liste les exigences manquantes dans l'ordre du texte", () => {
    const v = validerNotification(
      physique({ nom: "", adressesVisees: "", contactPrealable: "" }),
    );

    expect(v.complete).toBe(false);
    if (v.complete) return;
    expect(exigencesManquantes(v.manques)).toEqual([
      "notifiant",
      "localisation",
      "correspondance",
    ]);
  });

  it("ne répète pas une exigence dont plusieurs champs manquent", () => {
    // Six champs vides sur le notifiant, une seule exigence à afficher.
    const v = validerNotification(
      physique({
        nom: "",
        prenoms: "",
        profession: "",
        nationalite: "",
        naissanceLieu: "",
        adresse: "",
      }),
    );

    expect(v.complete).toBe(false);
    if (v.complete) return;
    expect(exigencesManquantes(v.manques)).toEqual(["notifiant"]);
    // Mais chaque champ garde son propre message : l'écran souligne les six.
    expect(v.manques.length).toBeGreaterThanOrEqual(6);
  });
});

describe("le nettoyage", () => {
  it("réduit les espaces multiples des noms, garde les textes tels quels", () => {
    const v = validerNotification(
      physique({
        nom: "  Diallo   Sow  ",
        faits: "  Une phrase   avec des espaces.  ",
      }),
    );

    expect(v.complete).toBe(true);
    if (!v.complete) return;
    expect(v.valeur.nom).toBe("Diallo Sow");
    // Le corps n'est pas normalisé : c'est une pièce du dossier, et on ne
    // réécrit pas ce que quelqu'un a déposé.
    expect(v.valeur.faits).toBe("Une phrase   avec des espaces.");
  });
});
