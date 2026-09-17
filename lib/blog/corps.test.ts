import { describe, expect, it } from "vitest";

import { adresseSure, analyser, extraitAutomatique, type Bloc } from "./corps";

/** Le texte d'un bloc, à plat — pour vérifier le contenu sans le balisage. */
function texteDe(bloc: Bloc | undefined): string {
  if (!bloc) return "";
  if (bloc.type === "code") return bloc.texte;
  if (bloc.type === "image") return bloc.alt;
  if (bloc.type === "liste") {
    return bloc.items.map((i) => i.map((x) => x.valeur).join("")).join(" | ");
  }
  return bloc.contenu.map((i) => i.valeur).join("");
}

describe("les blocs", () => {
  it("fait un paragraphe d'un texte simple", () => {
    const blocs = analyser("Une phrase toute simple.");

    expect(blocs).toHaveLength(1);
    expect(blocs[0]?.type).toBe("paragraphe");
    expect(texteDe(blocs[0])).toBe("Une phrase toute simple.");
  });

  it("recolle les lignes d'un même paragraphe", () => {
    // Un auteur qui va à la ligne dans son éditeur ne demande pas un nouveau
    // paragraphe. C'est la ligne VIDE qui sépare.
    const blocs = analyser("Première ligne\nseconde ligne\n\nAutre paragraphe");

    expect(blocs).toHaveLength(2);
    expect(texteDe(blocs[0])).toBe("Première ligne seconde ligne");
    expect(texteDe(blocs[1])).toBe("Autre paragraphe");
  });

  it("rend les titres en niveau 2 et 3, jamais 1", () => {
    // Le `<h1>` d'une page est son titre. Deux `<h1>` cassent le plan du
    // document pour qui navigue au lecteur d'écran.
    const blocs = analyser("# Grand\n\n## Petit");

    expect(blocs[0]).toMatchObject({ type: "titre", niveau: 2 });
    expect(blocs[1]).toMatchObject({ type: "titre", niveau: 3 });
  });

  it("groupe les lignes d'une liste", () => {
    const blocs = analyser("- un\n- deux\n- trois");

    expect(blocs).toHaveLength(1);
    expect(blocs[0]?.type).toBe("liste");
    expect(texteDe(blocs[0])).toBe("un | deux | trois");
  });

  it("accepte l'astérisque comme puce", () => {
    expect(analyser("* un\n* deux")[0]?.type).toBe("liste");
  });

  it("groupe les lignes d'une citation", () => {
    const blocs = analyser("> une phrase\n> et sa suite");

    expect(blocs[0]?.type).toBe("citation");
    expect(texteDe(blocs[0])).toBe("une phrase et sa suite");
  });

  it("laisse un bloc de code intact", () => {
    // Tout l'intérêt : ce qui est dedans n'est pas analysé. Un `# ` y reste un
    // dièse, pas un titre.
    const blocs = analyser("```\n# pas un titre\n- pas une liste\n```");

    expect(blocs).toHaveLength(1);
    expect(blocs[0]?.type).toBe("code");
    expect(texteDe(blocs[0])).toBe("# pas un titre\n- pas une liste");
  });

  it("rend ce qu'il a quand un bloc de code n'est pas fermé", () => {
    // Un corps mal formé rend moins de structure, jamais une erreur : un
    // article à moitié analysé reste lisible, un écran qui refuse de
    // s'afficher non.
    const blocs = analyser("Avant\n\n```\nresté ouvert");

    expect(blocs).toHaveLength(2);
    expect(blocs[1]?.type).toBe("code");
    expect(texteDe(blocs[1])).toBe("resté ouvert");
  });

  it("ne rend rien d'un corps vide", () => {
    expect(analyser("")).toEqual([]);
    expect(analyser("\n\n   \n")).toEqual([]);
  });
});

describe("les marques dans un paragraphe", () => {
  it("reconnaît le gras", () => {
    const blocs = analyser("du **gras** au milieu");

    expect(blocs[0]?.type).toBe("paragraphe");
    if (blocs[0]?.type !== "paragraphe") return;
    expect(blocs[0].contenu).toEqual([
      { type: "texte", valeur: "du " },
      { type: "gras", valeur: "gras" },
      { type: "texte", valeur: " au milieu" },
    ]);
  });

  it("reconnaît un lien", () => {
    const blocs = analyser("voir [le site](https://baobart.com) pour la suite");
    if (blocs[0]?.type !== "paragraphe") throw new Error("paragraphe attendu");

    expect(blocs[0].contenu[1]).toEqual({
      type: "lien",
      valeur: "le site",
      href: "https://baobart.com",
    });
  });

  it("n'invente pas d'italique", () => {
    // Écarté volontairement : `*` sert déjà de puce chez beaucoup de gens, et
    // la confusion coûte plus que le gain.
    const blocs = analyser("un *mot* isolé");

    expect(texteDe(blocs[0])).toBe("un *mot* isolé");
  });
});

describe("les adresses dangereuses", () => {
  it("désarment un lien `javascript:` sans effacer son texte", () => {
    // Le vecteur qui survit à tous les rendus naïfs, React compris : `href`
    // accepte n'importe quel schéma.
    //
    // Le texte reste : effacer la phrase serait une censure silencieuse, et
    // l'auteur n'en saurait rien.
    const blocs = analyser("clique [ici](javascript:alert(1)) vite");
    if (blocs[0]?.type !== "paragraphe") throw new Error("paragraphe attendu");

    expect(blocs[0].contenu.some((i) => i.type === "lien")).toBe(false);
    expect(texteDe(blocs[0])).toBe("clique ici vite");
  });

  it("refusent tous les schémas hors http, https et mailto", () => {
    for (const mauvais of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox",
      "file:///etc/passwd",
      "//evil.test/page",
    ]) {
      expect(adresseSure(mauvais)).toBeNull();
    }
  });

  it("acceptent ce qui sert vraiment", () => {
    expect(adresseSure("https://baobart.com")).toBe("https://baobart.com");
    expect(adresseSure("http://exemple.test")).toBe("http://exemple.test");
    expect(adresseSure("mailto:contact@baobart.com")).toBe(
      "mailto:contact@baobart.com",
    );
    // Les adresses internes : un article renvoie souvent vers le site.
    expect(adresseSure("/evenements")).toBe("/evenements");
  });

  it("ne devinent jamais un schéma manquant", () => {
    // « Ajouter https:// devant » transformerait `javascript:alert(1)` en une
    // adresse valide vers un domaine nommé « javascript ».
    expect(adresseSure("baobart.com")).toBeNull();
    expect(adresseSure("")).toBeNull();
    expect(adresseSure("   ")).toBeNull();
  });
});

describe("l'extrait automatique", () => {
  it("prend le premier paragraphe, pas le premier titre", () => {
    const extrait = extraitAutomatique("# Un titre\n\nLe vrai début du texte.");

    expect(extrait).toBe("Le vrai début du texte.");
  });

  it("coupe à la limite d'un mot", () => {
    // Couper au caractère produirait « notre nouvelle sélec… », ce qui se
    // remarque sur chaque carte de la liste.
    const extrait = extraitAutomatique("a".repeat(30) + " " + "b".repeat(200), 40);

    expect(extrait.endsWith("…")).toBe(true);
    expect(extrait).toBe("a".repeat(30) + "…");
  });

  it("ne coupe pas un texte déjà court", () => {
    expect(extraitAutomatique("Court.", 160)).toBe("Court.");
  });

  it("rend une chaîne vide quand il n'y a pas de paragraphe", () => {
    expect(extraitAutomatique("# Rien que des titres")).toBe("");
    expect(extraitAutomatique("")).toBe("");
  });

  it("garde le texte d'un lien, pas son adresse", () => {
    // Une carte de liste qui afficherait « voir https://… » serait illisible.
    expect(extraitAutomatique("voir [le site](https://baobart.com) ici")).toBe(
      "voir le site ici",
    );
  });
});

describe("la propriété que la validation n'a pas à garder", () => {
  it("rend au moins un bloc pour tout corps non blanc", () => {
    // `lib/blog/validation.ts` portait une garde « aucun texte affichable ».
    // Elle était inatteignable : un corps entièrement blanc est déjà refusé
    // sur la longueur, après `trim()`.
    //
    // La propriété vit donc ici, où elle est vraie et vérifiable : c'est une
    // propriété du parseur, pas une règle de saisie.
    for (const corps of [
      "a",
      "# titre seul",
      "- une puce",
      "> une citation",
      "```\n```",
      "   texte entouré d'espaces   ",
      "**",
      "[lien sans adresse]",
    ]) {
      expect(analyser(corps).length).toBeGreaterThan(0);
    }
  });
});

describe("les images", () => {
  it("font un bloc à elles seules", () => {
    const blocs = analyser("![Un pagne wax](/img/wax.jpg)");

    expect(blocs).toHaveLength(1);
    expect(blocs[0]).toEqual({
      type: "image",
      src: "/img/wax.jpg",
      alt: "Un pagne wax",
    });
  });

  it("ne se laissent pas avaler par le paragraphe qui précède", () => {
    // Le test qui a trouvé une virgule écrite à la place d'un `||` dans la
    // condition de fin de paragraphe. L'expression restait légale, le
    // compilateur se taisait, et l'image disparaissait dans le texte.
    const blocs = analyser("Voici la pièce.\n![Un pagne wax](/img/wax.jpg)\nEt la suite.");

    expect(blocs.map((b) => b.type)).toEqual([
      "paragraphe",
      "image",
      "paragraphe",
    ]);
  });

  it("acceptent un alt vide, et c'est un choix", () => {
    // Une image décorative doit porter un `alt` vide plutôt qu'une description
    // inventée : un lecteur d'écran lirait du bruit.
    const blocs = analyser("![](/img/trait.png)");

    expect(blocs[0]).toEqual({ type: "image", src: "/img/trait.png", alt: "" });
  });

  it("refusent une adresse dangereuse et redeviennent du texte", () => {
    // Pas de trou silencieux : l'auteur voit que quelque chose ne va pas.
    const blocs = analyser("![piège](javascript:alert(1))");

    expect(blocs[0]?.type).toBe("paragraphe");
    expect(blocs.some((b) => b.type === "image")).toBe(false);
  });

  it("ne reconnaissent pas une image au milieu d'une phrase", () => {
    // Markdown le permet ; on ne le reprend pas. Une image glissée entre deux
    // mots casse le rythme et n'a aucune taille prévisible.
    const blocs = analyser("du texte ![img](/a.png) encore du texte");

    expect(blocs).toHaveLength(1);
    expect(blocs[0]?.type).toBe("paragraphe");
  });
});
