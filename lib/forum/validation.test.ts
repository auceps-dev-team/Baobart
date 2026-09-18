/**
 * Ce qu'on accepte d'écrire dans un forum.
 *
 * ─────────────────────────────────────────────────────────────────
 * LE TEST QUI COMPTE EST CELUI DE LA VISIBILITÉ INCONNUE
 *
 * Les seuils de longueur se relisent dans le code. Le repli sur `INVITE_ONLY`,
 * lui, est une décision qu'on peut inverser sans que rien ne casse — et
 * l'inverser ouvrirait des communautés que personne n'a voulu ouvrir.
 */

import { describe, expect, it } from "vitest";

import {
  validerCommunaute,
  validerMessage,
  validerSujet,
} from "@/lib/forum/validation";

describe("une communauté", () => {
  it("garde le nom, et en tire l'adresse", () => {
    const v = validerCommunaute({
      nom: "  Sérigraphie   Dakar  ",
      description: " On y parle encres. ",
      visibilite: "PUBLIC",
    });

    expect(v.ok).toBe(true);
    if (!v.ok) return;
    // Les espaces multiples sont réduits : « Sérigraphie   Dakar » et
    // « Sérigraphie Dakar » ne doivent pas coexister comme deux espaces.
    expect(v.valeur.nom).toBe("Sérigraphie Dakar");
    expect(v.valeur.slug).toBe("serigraphie-dakar");
    expect(v.valeur.description).toBe("On y parle encres.");
  });

  it("rend `null` pour une description vide, pas la chaîne vide", () => {
    // La base distingue les deux, et l'écran aussi : `null` ne s'affiche pas,
    // une chaîne vide occupe une ligne.
    const v = validerCommunaute({ nom: "Atelier", description: "   ", visibilite: "PUBLIC" });

    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.valeur.description).toBeNull();
  });

  it("refuse un nom trop court", () => {
    const v = validerCommunaute({ nom: "ab", description: "", visibilite: "PUBLIC" });

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("nom");
  });

  it("refuse un nom dont on ne peut tirer aucune adresse", () => {
    // « ??? » fait trois caractères et passe la longueur, mais son slug est
    // vide : la communauté n'aurait pas d'URL.
    const v = validerCommunaute({ nom: "???", description: "", visibilite: "PUBLIC" });

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("nom");
    expect(v.refus.message).toContain("adresse");
  });

  it("refuse une description trop longue", () => {
    const v = validerCommunaute({
      nom: "Atelier",
      description: "x".repeat(601),
      visibilite: "PUBLIC",
    });

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("description");
  });

  it.each(["PUBLIC", "PRIVATE", "INVITE_ONLY"])(
    "accepte la visibilité %s",
    (demandee) => {
      const v = validerCommunaute({ nom: "Atelier", description: "", visibilite: demandee });

      expect(v.ok).toBe(true);
      if (!v.ok) return;
      expect(v.valeur.visibilite).toBe(demandee);
    },
  );

  it("accepte une visibilité mal cassée", () => {
    // Le formulaire peut envoyer « public » ; ce n'est pas une attaque, c'est
    // une minuscule.
    const v = validerCommunaute({ nom: "Atelier", description: "", visibilite: " public " });

    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.valeur.visibilite).toBe("PUBLIC");
  });

  it.each(["", "TOUT_LE_MONDE", "OPEN", "null", "undefined"])(
    "ferme sur « %s », plutôt que d'ouvrir",
    (demandee) => {
      // LA règle à ne pas inverser. Un formulaire trafiqué, un champ renommé,
      // une valeur ajoutée à l'enum sans mettre la validation à jour : dans les
      // trois cas, l'erreur doit fermer.
      const v = validerCommunaute({ nom: "Atelier", description: "", visibilite: demandee });

      expect(v.ok).toBe(true);
      if (!v.ok) return;
      expect(v.valeur.visibilite).toBe("INVITE_ONLY");
    },
  );
});

describe("un sujet", () => {
  it("refuse un titre trop court", () => {
    const v = validerSujet({ titre: "hm", corps: "Un vrai message." });

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("titre");
  });

  it("refuse aussi sur le corps, en nommant le bon champ", () => {
    // Le titre passe, le corps non : c'est « corps » qui doit remonter, sinon
    // l'écran souligne le mauvais champ.
    const v = validerSujet({ titre: "Quelle encre ?", corps: " " });

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("corps");
  });

  it("garde le corps tel quel, aux bords près", () => {
    // Surtout : il n'est pas échappé ici. Le rendu sans danger est le travail
    // de `lib/cms/corps.ts`, qui ne produit jamais d'HTML — échapper en plus
    // ici afficherait « &lt;b&gt; » à l'écran.
    const v = validerSujet({
      titre: "Un titre",
      corps: "  <script>alert(1)</script>  ",
    });

    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.valeur.corps).toBe("<script>alert(1)</script>");
  });
});

describe("un message", () => {
  it("accepte deux caractères", () => {
    // « Ok » est un vrai message, et c'est même le plus fréquent dans une
    // conversation qui fonctionne. Un seuil qui le refuse apprend à écrire
    // trois phrases creuses, ou à se taire.
    expect(validerMessage({ corps: "Ok" }).ok).toBe(true);
  });

  it("refuse un seul caractère, et le vide", () => {
    expect(validerMessage({ corps: "x" }).ok).toBe(false);
    expect(validerMessage({ corps: "   " }).ok).toBe(false);
  });

  it("refuse au-delà de vingt mille caractères", () => {
    const v = validerMessage({ corps: "x".repeat(20_001) });

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("corps");
  });
});
