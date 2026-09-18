/**
 * Ce qu'on accepte d'écrire dans un forum.
 *
 * ─────────────────────────────────────────────────────────────────
 * IL N'Y A PLUS DE RÉGLAGE DE VISIBILITÉ
 *
 * Ce fichier en éprouvait trois cas. Ils ont disparu avec le réglage : toutes
 * les communautés sont ouvertes. Voir le test qui les a remplacés, et
 * l'en-tête de `validerCommunaute` pour la raison.
 *
 * Ce qui reste tient en une phrase : les seuils sont bas — deux caractères
 * pour un message — et le corps n'est pas échappé ici, parce que rien de ce
 * projet ne rend d'HTML.
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
    const v = validerCommunaute({ nom: "Atelier", description: "   " });

    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.valeur.description).toBeNull();
  });

  it("refuse un nom trop court", () => {
    const v = validerCommunaute({ nom: "ab", description: "" });

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("nom");
  });

  it("refuse un nom dont on ne peut tirer aucune adresse", () => {
    // « ??? » fait trois caractères et passe la longueur, mais son slug est
    // vide : la communauté n'aurait pas d'URL.
    const v = validerCommunaute({ nom: "???", description: "" });

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("nom");
    expect(v.refus.message).toContain("adresse");
  });

  it("refuse une description trop longue", () => {
    const v = validerCommunaute({
      nom: "Atelier",
      description: "x".repeat(601),
    });

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.refus.champ).toBe("description");
  });

  it("ouvre toujours, sans réglage de visibilité", () => {
    // ════════════════════════════════════════════════════════════════════════
    // CE TEST A REMPLACÉ TROIS AUTRES, ET C'EST UN RECUL ASSUMÉ
    //
    // Avant, ce fichier éprouvait qu'une visibilité inconnue retombait sur
    // `INVITE_ONLY` — la plus fermée. La règle était bonne ; ce qu'elle
    // protégeait ne l'était pas. Adhérer à une communauté privée était REFUSÉ,
    // faute de table de demandes : le réglage menait à une porte close, et
    // aucune maquette ne le dessine.
    //
    // La saisie n'a donc plus de champ `visibilite` du tout. Ce n'est pas un
    // défaut qui ferme : c'est un champ qui n'existe pas, ce qui est la seule
    // façon sûre de ne pas se tromper dessus.
    const v = validerCommunaute({ nom: "Atelier", description: "" });

    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.valeur.visibilite).toBe("PUBLIC");
  });
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
