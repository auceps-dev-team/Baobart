import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { CHAMPS_LIENS, ChargeInvalide, MODELES, rendre, type Modele } from "./modeles";

const CHARGES: Record<Modele, Record<string, unknown>> = {
  BIENVENUE: { nom: "Awa", site: "https://baobart.test" },
  REINITIALISATION_MOT_DE_PASSE: {
    nom: "Awa",
    lien: "https://baobart.com/reinit?j=abc",
    heures: 2,
  },
  RECU_ACHAT: { nom: "Awa", ressource: "Pack textures", montant: "4 500 F" },
  LIEN_TELECHARGEMENT: {
    nom: "Awa",
    ressource: "Pack textures",
    lien: "https://media.baobart.com/x?sig=abc",
  },
  AVIS_VERSEMENT: { nom: "Awa", montant: "12 000 F", compte: "···· 4821" },
  RELANCE_ABONNEMENT: {
    nom: "Awa",
    offre: "Pass Créateur",
    montant: "2 000 F",
    lien: "https://baobart.com/abonnement/ab1/renouveler",
    jours: 3,
  },
  RECU_ABONNEMENT: {
    nom: "Awa",
    offre: "Pass Créateur",
    montant: "2 000 F",
    prochaine: "2 octobre 2026",
    lien: "https://baobart.com/dashboard/abonnements",
  },

  // Les huit de v1.52.2. `nom` y figure partout sans qu'aucun appelant ne le
  // passe : c'est l'aiguilleur qui l'ajoute, depuis le compte qu'il vient de
  // lire pour trouver l'adresse.
  COMMANDE_REMBOURSEE: {
    nom: "Awa",
    ressource: "Pack textures",
    montant: "4 500 F",
    raison: "Fichier illisible sur mobile.",
  },
  EVENEMENT_ANNULE: {
    nom: "Awa",
    titre: "Atelier sérigraphie sur wax",
    raison: "La salle est inondée, on reporte à novembre.",
  },
  VENTE_REALISEE: {
    nom: "Awa",
    ressource: "Pack textures",
    montant: "4 500 F",
  },
  CONTENU_PUBLIE: { nom: "Awa", titre: "Atelier sérigraphie sur wax" },
  CONTENU_REFUSE: {
    nom: "Awa",
    titre: "Atelier sérigraphie sur wax",
    motif: "La date est déjà passée, et le lieu n'est pas renseigné.",
  },
  CANDIDATURE_RECUE: { nom: "Awa", offre: "Illustrateur — mission 3 mois" },
  INSCRIPTION_EVENEMENT: { nom: "Awa", titre: "Atelier sérigraphie sur wax" },
  NOUVEL_ABONNE: { nom: "Awa" },
  RETRAIT_JURIDIQUE: {
    nom: "Awa",
    reference: "NOT-2026-041",
    motif: "Reproduction sans autorisation d'une illustration.",
    echeance: "29 septembre 2026",
    lien: "https://baobart.test/dossiers/NOT-2026-041",
  },
  PAIEMENT_ABANDONNE: {
    nom: "Awa",
    ressource: "Pack textures",
    montant: "4 500 F",
    lien: "https://baobart.test/acheter/pack-textures",
    heures: 22,
  },
  EVENEMENT_MAINTENU: { nom: "Awa", titre: "Atelier sérigraphie sur wax" },
  INFOLETTRE_CONFIRMATION: {
    confirmer: "https://baobart.test/infolettre/confirmer?jeton=abc",
    desinscrire: "https://baobart.test/infolettre/desinscription?jeton=def",
    jours: 7,
  },
  DEMANDE_REMBOURSEMENT: { nom: "Awa", ressource: "Pack textures", montant: "4 500 F", motif: "Le fichier ne s'ouvre pas.", jours: 7 },
  REMBOURSEMENT_REFUSE: { nom: "Kofi", ressource: "Pack textures", motif: "Le fichier s'ouvre avec Illustrator 2024.", par: "le créateur" },
  REMBOURSE_PAR_EQUIPE: { nom: "Awa", ressource: "Pack textures", montant: "2 800 F", motif: "Le fichier ne s'ouvre pas." },
  DEMANDE_TRANSMISE: { nom: "Awa", ressource: "Pack textures", montant: "2 800 F", jours: 7 },
  DEMANDE_A_TRANCHER: { nom: "Serge", ressource: "Pack textures", montant: "2 800 F", jours: 7 },
  INFOLETTRE: { sujet: "Les nouveautés d'octobre", corps: "Trois nouvelles familles de ressources arrivent.", desinscrire: "https://baobart.test/infolettre/desinscription?jeton=abc.def" },
  COMPTE_VERSEMENT_MODIFIE: { nom: "Awa", moyen: "Orange Money", compte: "···· 4821" },
  CODE_COMPTE_VERSEMENT: { nom: "Awa", codeSecret: "482913", destination: "Wave — ···· 2233", minutes: 15 },
  MESSAGE_CREATEUR: {
    nom: "Awa",
    expediteur: "Studio Kente",
    profil: "https://baobart.test/@studio-kente",
    sujet: "Une affiche pour notre festival",
    corps: "Bonjour, nous aimerions vous confier l'affiche de notre festival de mars.",
    repondreA: "contact@studio-kente.test",
    reference: "cm0message0001",
    contact: "https://baobart.test/contact",
    reglages: "https://baobart.test/dashboard/boutique",
  },
  CREATEUR_DU_MOIS: { nom: "Awa", jusquAu: "8 décembre 2026", lien: "https://baobart.test/dashboard/badges" },
  AVIS_RECU: { nom: "Awa", ressource: "Pack textures", note: 4, extrait: "Les fichiers sources sont impeccables.", lien: "https://baobart.test/dashboard/avis" },
  REPONSE_AVIS: { nom: "Mariam", ressource: "Pack textures", reponse: "Merci, une version SVG arrive.", lien: "https://baobart.test/products/pack-textures#avis" },
};

describe("modèles de courriel", () => {
  describe("chaque modèle se rend", () => {
    it.each(MODELES)("%s produit un sujet et un corps non vides", (modele) => {
      const m = rendre(modele, CHARGES[modele]);
      expect(m.sujet.length).toBeGreaterThan(0);
      expect(m.texte.length).toBeGreaterThan(0);
    });

    it.each(MODELES)("%s ne laisse aucun trou dans le texte", (modele) => {
      // Un champ manquant produirait « Bonjour undefined » — parti chez
      // l'utilisateur avant que quiconque le voie.
      const m = rendre(modele, CHARGES[modele]);
      expect(m.texte).not.toContain("undefined");
      expect(m.texte).not.toContain("[object Object]");
      expect(m.sujet).not.toContain("undefined");
    });

    it("place le nom et le montant dans l'avis de versement", () => {
      const m = rendre("AVIS_VERSEMENT", CHARGES.AVIS_VERSEMENT);
      expect(m.texte).toContain("Awa");
      expect(m.texte).toContain("12 000 F");
      expect(m.texte).toContain("···· 4821");
    });
  });

  describe("le code du compte de versement", () => {
    it("nomme ce qu'il autorise et porte le code dans le corps", () => {
      const m = rendre("CODE_COMPTE_VERSEMENT", CHARGES.CODE_COMPTE_VERSEMENT);
      expect(m.texte).toContain("482913");
      expect(m.texte).toContain("Wave — ···· 2233");
    });

    it("ne met jamais le code dans l'objet : il s'affiche sur l'écran verrouillé, et se journalise", () => {
      expect(rendre("CODE_COMPTE_VERSEMENT", CHARGES.CODE_COMPTE_VERSEMENT).sujet).not.toMatch(/\d{6}/);
    });

    it("refuse un code qui n'a pas six chiffres", () => {
      expect(() => rendre("CODE_COMPTE_VERSEMENT", { ...CHARGES.CODE_COMPTE_VERSEMENT, codeSecret: "12ab56" })).toThrow(ChargeInvalide);
    });
  });

  describe("le message laissé à un créateur", () => {
    it("porte l'adresse de l'expéditeur en « Répondre à », et elle seule", () => {
      const m = rendre("MESSAGE_CREATEUR", CHARGES.MESSAGE_CREATEUR);
      expect(m.repondreA).toBe("contact@studio-kente.test");
      expect(m.texte).toContain("Une affiche pour notre festival");
      expect(m.texte).toContain("cm0message0001");
    });

    it("n'en porte aucun ailleurs : un avis de Baobart n'a personne pour lire la réponse", () => {
      for (const modele of MODELES.filter((x) => x !== "MESSAGE_CREATEUR")) {
        expect(rendre(modele, CHARGES[modele]).repondreA).toBeUndefined();
      }
    });

    it("refuse une adresse de réponse qui glisserait un en-tête", () => {
      expect(() =>
        rendre("MESSAGE_CREATEUR", {
          ...CHARGES.MESSAGE_CREATEUR,
          repondreA: "a@b.test\r\nBcc: voleur@exemple.com",
        }),
      ).toThrow(ChargeInvalide);
    });

    it("se rend sans vitrine quand l'expéditeur n'en a pas", () => {
      const m = rendre("MESSAGE_CREATEUR", { ...CHARGES.MESSAGE_CREATEUR, profil: null });
      expect(m.texte).not.toContain("null");
      expect(m.texte).toContain("Studio Kente t'a écrit depuis ta vitrine Baobart.");
    });
  });

  describe("le sujet ne porte jamais de saut de ligne", () => {
    it("aplatit un nom multiligne", () => {
      // Un saut de ligne dans un sujet permet historiquement d'injecter un
      // en-tête — un `Bcc:` et le message part à des inconnus.
      const m = rendre("BIENVENUE", { nom: "Awa\nBcc: voleur@exemple.com" });
      expect(m.sujet).not.toContain("\n");
      expect(m.sujet).not.toContain("\r");
    });

    it("borne la longueur du sujet", () => {
      const m = rendre("RECU_ACHAT", {
        ...CHARGES.RECU_ACHAT,
        ressource: "x".repeat(199),
      });
      expect(m.sujet.length).toBeLessThanOrEqual(200);
    });
  });

  describe("charge invalide", () => {
    it("refuse un champ manquant plutôt que d'écrire un texte à trous", () => {
      expect(() => rendre("BIENVENUE", {})).toThrow(ChargeInvalide);
    });

    it("refuse un lien qui n'en est pas un", () => {
      expect(() =>
        rendre("LIEN_TELECHARGEMENT", {
          nom: "Awa",
          ressource: "Pack",
          lien: "javascript:alert(1)",
        }),
      ).toThrow(ChargeInvalide);
    });

    it("refuse null et les valeurs non objets", () => {
      expect(() => rendre("BIENVENUE", null)).toThrow(ChargeInvalide);
      expect(() => rendre("BIENVENUE", "Awa")).toThrow(ChargeInvalide);
    });

    it("nomme le champ fautif, pour qu'on sache quoi corriger", () => {
      try {
        rendre("REINITIALISATION_MOT_DE_PASSE", {
          nom: "Awa",
          lien: "https://x.test",
          heures: -1,
        });
        expect.unreachable("aurait dû lever");
      } catch (cause) {
        expect(cause).toBeInstanceOf(ChargeInvalide);
        expect((cause as Error).message).toContain("heures");
      }
    });

    it("refuse un modèle inconnu", () => {
      expect(() => rendre("INEXISTANT" as Modele, {})).toThrow(ChargeInvalide);
    });
  });
});

/**
 * Les deux listes doivent rester identiques.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE TEST EXISTE
 *
 * `MODELES` vit en TypeScript, `EmailTemplate` en base. Rien dans le langage
 * ne les relie : ajouter un modèle sans migration compile parfaitement, et
 * échoue **au dépôt**, en production, sur un `invalid input value for enum`.
 *
 * Le test coûte trois lignes et attrape exactement cet oubli-là.
 */
describe("la liste des modèles et l'enum de la base", () => {
  it("portent exactement les mêmes valeurs", async () => {
    const { EmailTemplate } = await import("@prisma/client");

    expect([...MODELES].sort()).toEqual(Object.keys(EmailTemplate).sort());
  });
});

describe("le courriel de bienvenue (Q-28)", () => {
  it("mène au site quand son adresse est connue", () => {
    const m = rendre("BIENVENUE", { nom: "Yao", site: "https://baobart.test" });
    expect(m.texte).toContain("https://baobart.test/explore");
    expect(m.texte).toContain("https://baobart.test/dashboard");
  });

  it("sans adresse configurée, aucun lien plutôt qu'un lien faux", () => {
    expect(rendre("BIENVENUE", { nom: "Yao" }).texte).not.toContain("http");
  });
});

describe("« Nouvel abonné » nomme le suiveur (décision du 21/11)", () => {
  it("dit le nom affiché de qui suit", () => {
    const m = rendre("NOUVEL_ABONNE", { nom: "Awa", suiveur: "Kofi Mensah" });
    expect(m.texte).toContain("Kofi Mensah suit désormais ta boutique.");
    expect(m.texte).not.toContain("Quelqu'un");
  });

  it("un courriel déposé avant cette version, sans le champ, part encore", () => {
    // Sinon, les courriels en file au déploiement échoueraient à l'envoi.
    const m = rendre("NOUVEL_ABONNE", { nom: "Awa" });
    expect(m.texte).toContain("Quelqu'un suit désormais ta boutique.");
  });

  it("un nom vide est refusé au dépôt, pas envoyé tel quel", () => {
    expect(() => rendre("NOUVEL_ABONNE", { nom: "Awa", suiveur: "" })).toThrow(ChargeInvalide);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Q-28 — LA PARTIE HTML (décidé le 21/11/2026)
//
// Le HTML est tiré du texte par `versHtml` (lib/email/html.ts). Ces tests
// passent par TOUS les modèles, pas par un seul : c'est le critère de relecture
// posé dans #61 le 21/11 (« une charge piégée sur chaque modèle »).
// ════════════════════════════════════════════════════════════════════════════

/** 34 caractères : sous toutes les longueurs maximales des schémas (40 au plus court). */
const PIEGE = `"><img src=x onerror=1><a href=//x>`;
/** Une adresse qui tente de fermer l'attribut `href` et d'ouvrir une balise. */
const LIEN_PIEGE = `https://baobart.test/piege?a="><img src=x>`;
/** Les champs qui gardent leur exemple : un format strict que le piège ne passerait pas. */
const FORMAT_STRICT = new Set(["repondreA", "codeSecret"]);
/** Tout ce que `versHtml` écrit lui-même. Une autre balise viendrait du contenu. */
const BALISES_PERMISES = new Set(["!doctype", "html", "head", "meta", "title", "body", "div", "p", "br", "hr", "a"]);

function chargePiegee(modele: Modele): Record<string, unknown> {
  const piegee: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(CHARGES[modele])) {
    if (typeof valeur !== "string" || FORMAT_STRICT.has(cle)) piegee[cle] = valeur;
    else piegee[cle] = CHAMPS_LIENS.has(cle) ? LIEN_PIEGE : PIEGE;
  }
  if (modele === "NOUVEL_ABONNE") piegee.suiveur = PIEGE;
  return piegee;
}

/** Le texte que lit quelqu'un dans le HTML : le cadre blanc, balises ôtées, entités rendues. */
function texteLuDansLeHtml(html: string): string {
  const cadre = html.slice(html.indexOf('<div style="background:#FFFFFF'));
  return cadre
    .replace(/<br>/g, "\n")
    .replace(/<\/p>/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Lignes non vides, sans les filets (« — », « ——— »), espaces resserrés. */
const lignesUtiles = (t: string) =>
  t
    .split("\n")
    .map((l) => l.trim().replace(/\s+/g, " "))
    .filter((l) => l !== "" && !/^[—–-]+$/.test(l));

describe("la partie HTML des courriels (Q-28)", () => {
  it.each(MODELES)("%s : une charge piégée ne produit aucune balise, ni dans le texte ni dans un lien", (modele) => {
    const m = rendre(modele, chargePiegee(modele));
    expect(m.html).not.toContain("<img");
    expect(m.html).not.toContain("<a href=//");
    // Seules les balises que `versHtml` produit lui-même, et aucun attribut d'événement.
    const balises = [...m.html.matchAll(/<\/?([a-z!][a-z0-9]*)/gi)].map((t) => t[1]!.toLowerCase());
    expect(balises.filter((b) => !BALISES_PERMISES.has(b))).toEqual([]);
    // Les valeurs entre guillemets ôtées d'abord : le sujet piégé y figure, échappé, et
    // « onerror= » n'y est que du texte. L'échappement garantit qu'aucun `"` brut n'y reste.
    const attributs = [...m.html.matchAll(/<[^>]*>/g)].map((t) => t[0].replace(/"[^"]*"/g, '""'));
    expect(attributs.filter((t) => /\son[a-z]+\s*=/i.test(t))).toEqual([]);
    // Le piège est bien arrivé jusqu'au HTML — mais échappé.
    if (m.texte.includes(PIEGE)) expect(m.html).toContain("&quot;&gt;&lt;img src=x onerror=1&gt;");
    // Tout lien produit pointe vers une adresse fabriquée par le code, rien d'autre.
    for (const [, href] of m.html.matchAll(/<a href="([^"]*)"/g)) expect(href).toMatch(/^https:\/\/baobart\.test\//);
  });

  it.each(MODELES)("%s : le HTML dit exactement ce que dit le texte", (modele) => {
    const m = rendre(modele, CHARGES[modele]);
    expect(lignesUtiles(texteLuDansLeHtml(m.html))).toEqual(lignesUtiles(m.texte));
  });

  it.each(MODELES)("%s : ni image, ni script, ni ressource externe", (modele) => {
    const { html } = rendre(modele, CHARGES[modele]);
    for (const interdit of ["<img", "<script", "<link", "<style", "<iframe", "src=", "url("]) expect(html).not.toContain(interdit);
  });

  it("chaque adresse des champs « lien » devient un lien ; chaque adresse des exemples est déclarée comme telle", () => {
    for (const modele of MODELES) {
      const m = rendre(modele, CHARGES[modele]);
      for (const [cle, valeur] of Object.entries(CHARGES[modele])) {
        if (typeof valeur !== "string" || !/^https?:\/\//.test(valeur)) continue;
        // Un champ d'adresse sous un autre nom resterait du texte : il doit être déclaré.
        expect(CHAMPS_LIENS.has(cle), `${modele}.${cle} porte une adresse sans être dans CHAMPS_LIENS`).toBe(true);
        // Le lien peut prolonger l'adresse du champ (« ${c.site}/explore ») : il commence par elle.
        if (m.texte.includes(valeur)) expect(m.html, `${modele}.${cle}`).toContain(`<a href="${valeur}`);
      }
    }
  });

  it("une adresse glissée par un utilisateur reste du texte", () => {
    const m = rendre("COMMANDE_REMBOURSEE", { ...CHARGES.COMMANDE_REMBOURSEE, raison: "Voir https://piege.test/connexion pour le détail." });
    expect(m.html).toContain("https://piege.test/connexion");
    expect(m.html).not.toContain('href="https://piege.test');
  });

  it("un lien en javascript: n'est jamais cliquable, même dans un champ « lien »", () => {
    // `RETRAIT_JURIDIQUE.lien` est validé par `z.string().url()`, qui l'accepte.
    const m = rendre("RETRAIT_JURIDIQUE", { ...CHARGES.RETRAIT_JURIDIQUE, lien: "javascript:alert(1)" });
    expect(m.texte).toContain("javascript:alert(1)");
    expect(m.html).not.toContain('href="javascript');
  });

  it("le sujet, dans le titre de la page, est échappé lui aussi", () => {
    const m = rendre("INFOLETTRE", { ...CHARGES.INFOLETTRE, sujet: "</title><script>x</script>" });
    expect(m.html).toContain("<title>&lt;/title&gt;&lt;script&gt;x&lt;/script&gt;</title>");
  });
});

describe("les gabarits n'ont aucun saut de ligne littéral", () => {
  it("chaque morceau de gabarit de modeles.ts écrit `\\n`, jamais un vrai retour à la ligne", () => {
    // Un retour à la ligne écrit dans le code devient `\r\n` quand le dépôt est
    // extrait sous Windows (relevé par #83). Compté avec le compilateur, et pas
    // avec un motif de recherche : mesuré le 24/11, le motif « ligne qui commence
    // par ` + » en voyait 2, le compilateur 8.
    const chemin = path.join(__dirname, "modeles.ts");
    const source = ts.createSourceFile(chemin, readFileSync(chemin, "utf8"), ts.ScriptTarget.Latest, true);
    const fautifs: number[] = [];
    const morceaux = new Set([
      ts.SyntaxKind.NoSubstitutionTemplateLiteral,
      ts.SyntaxKind.TemplateHead,
      ts.SyntaxKind.TemplateMiddle,
      ts.SyntaxKind.TemplateTail,
    ]);
    const visiter = (n: ts.Node) => {
      if (morceaux.has(n.kind) && /\r?\n/.test(n.getText(source))) {
        fautifs.push(source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1);
      }
      ts.forEachChild(n, visiter);
    };
    visiter(source);
    expect(fautifs, `lignes ${fautifs.join(", ")}`).toEqual([]);
  });
});
