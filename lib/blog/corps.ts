/**
 * Le corps d'un article, d'un texte à une structure.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI PAS TIPTAP, ET POURQUOI PAS D'HTML DU TOUT
 *
 * §4.2 demande TipTap et un corps en HTML sanitisé. On ne le fait pas, et la
 * raison n'est pas le coût de l'éditeur.
 *
 * **Ce projet ne rend d'HTML nulle part.** Pas un seul
 * `dangerouslySetInnerHTML`, pas un sanitiseur, pas une dépendance qui en
 * produit. Tout ce qui s'affiche passe par React, qui échappe. C'est une
 * propriété rare et elle se perd en une ligne : le jour où l'on accepte de
 * l'HTML stocké, la question n'est plus « est-ce que le site est sûr » mais
 * « est-ce que le sanitiseur est à jour », ce qui est une bien moins bonne
 * question.
 *
 * Un sanitiseur est un filtre à listes — et les contournements de listes sont
 * une littérature entière. Pour un blog écrit par trois personnes de
 * l'équipe, payer ce risque pour obtenir des tableaux et des vidéos
 * embarquées serait un mauvais marché.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QU'ON REND À LA PLACE
 *
 * Un sous-ensemble de Markdown, analysé **en blocs** que React affiche.
 * Aucune chaîne d'HTML n'existe à aucun moment — ni en base, ni en mémoire, ni
 * dans la réponse. Il n'y a donc rien à sanitiser.
 *
 *   # Titre                → un titre de niveau 2 (le 1 est celui de la page)
 *   ## Sous-titre          → niveau 3
 *   - item                 → liste à puces
 *   > citation             → citation
 *   ```                    → bloc de code, rendu tel quel
 *   texte                  → paragraphe
 *
 * Dans un paragraphe, deux marques seulement : `**gras**` et `[texte](url)`.
 * Pas d'italique — on l'a écarté parce que `*` sert déjà aux listes chez
 * beaucoup de gens et que la confusion coûte plus que le gain.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES LIENS SONT FILTRÉS ICI, PAS À L'AFFICHAGE
 *
 * `[clic](javascript:alert(1))` est le vecteur qui survit à tous les rendus
 * naïfs, y compris en React : `href` accepte n'importe quel schéma. Un lien
 * dont le schéma n'est pas `http`, `https` ou `mailto` perd son adresse et ne
 * reste que du texte.
 *
 * Le faire ici plutôt qu'au rendu est délibéré : la règle est éprouvable sans
 * monter un navigateur, et un second écran qui afficherait ces blocs en
 * hériterait sans le savoir.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MODULE EST PUR
 *
 * Une chaîne entre, une structure sort. Aucun React, aucune requête — c'est ce
 * qui permet d'éprouver « un lien `javascript:` est désarmé » en trois lignes.
 */

export type Inline =
  | { type: "texte"; valeur: string }
  | { type: "gras"; valeur: string }
  | { type: "lien"; valeur: string; href: string };

export type Bloc =
  | { type: "titre"; niveau: 2 | 3; contenu: Inline[] }
  | { type: "paragraphe"; contenu: Inline[] }
  | { type: "liste"; items: Inline[][] }
  | { type: "citation"; contenu: Inline[] }
  /** Rendu tel quel, sans analyse : c'est tout l'intérêt d'un bloc de code. */
  | { type: "code"; texte: string };

/** Les seuls schémas d'URL qu'un lien d'article peut porter. */
const SCHEMAS_PERMIS = ["http:", "https:", "mailto:"];

/**
 * Découpe un corps en blocs.
 *
 * Ne lève jamais : un corps mal formé rend moins de structure, pas une erreur.
 * Un article à moitié analysé reste lisible ; un écran qui refuse de
 * s'afficher, non.
 */
export function analyser(corps: string): Bloc[] {
  const blocs: Bloc[] = [];
  const lignes = corps.replace(/\r\n/g, "\n").split("\n");

  let i = 0;
  while (i < lignes.length) {
    const ligne = lignes[i] ?? "";

    // ── Bloc de code : tout jusqu'à la clôture, sans analyse ──────────────
    if (ligne.trimStart().startsWith("```")) {
      const debut = i + 1;
      let fin = debut;
      while (fin < lignes.length && !(lignes[fin] ?? "").trimStart().startsWith("```")) {
        fin += 1;
      }
      blocs.push({ type: "code", texte: lignes.slice(debut, fin).join("\n") });
      // `fin + 1` saute la clôture. Si elle manque, `fin` vaut déjà la
      // longueur et la boucle s'arrête — un bloc non fermé rend ce qu'il a.
      i = fin + 1;
      continue;
    }

    if (ligne.trim().length === 0) {
      i += 1;
      continue;
    }

    // ── Titres ─────────────────────────────────────────────────────────────
    //
    // `#` rend un `<h2>`, pas un `<h1>` : le `<h1>` d'une page est son titre,
    // et deux `<h1>` cassent le plan du document pour un lecteur d'écran.
    const titre = /^(#{1,2})\s+(.*)$/.exec(ligne);
    if (titre) {
      blocs.push({
        type: "titre",
        niveau: titre[1]?.length === 1 ? 2 : 3,
        contenu: enligne(titre[2] ?? ""),
      });
      i += 1;
      continue;
    }

    // ── Liste : toutes les lignes consécutives qui commencent par « - » ────
    if (/^[-*]\s+/.test(ligne)) {
      const items: Inline[][] = [];
      while (i < lignes.length && /^[-*]\s+/.test(lignes[i] ?? "")) {
        items.push(enligne((lignes[i] ?? "").replace(/^[-*]\s+/, "")));
        i += 1;
      }
      blocs.push({ type: "liste", items });
      continue;
    }

    // ── Citation ───────────────────────────────────────────────────────────
    if (/^>\s?/.test(ligne)) {
      const morceaux: string[] = [];
      while (i < lignes.length && /^>\s?/.test(lignes[i] ?? "")) {
        morceaux.push((lignes[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      blocs.push({ type: "citation", contenu: enligne(morceaux.join(" ")) });
      continue;
    }

    // ── Paragraphe : jusqu'à la ligne vide ou le prochain bloc ────────────
    const morceaux: string[] = [];
    while (i < lignes.length) {
      const l = lignes[i] ?? "";
      if (
        l.trim().length === 0 ||
        /^(#{1,2})\s+/.test(l) ||
        /^[-*]\s+/.test(l) ||
        /^>\s?/.test(l) ||
        l.trimStart().startsWith("```")
      ) {
        break;
      }
      morceaux.push(l.trim());
      i += 1;
    }
    blocs.push({ type: "paragraphe", contenu: enligne(morceaux.join(" ")) });
  }

  return blocs;
}

/**
 * Les marques d'un fragment : gras et liens.
 *
 * Un seul passage, une seule expression, et l'ordre des alternatives compte :
 * `**` est cherché avant `[`, sans quoi un lien dont le texte est en gras se
 * découperait au mauvais endroit.
 */
function enligne(texte: string): Inline[] {
  const sortie: Inline[] = [];
  // ────────────────────────────────────────────────────────────────────────
  // L'ADRESSE ACCEPTE UN NIVEAU DE PARENTHÈSES
  //
  // `[^)\s]+` s'arrêtait à la première parenthèse fermante, ce qui coupait
  // `javascript:alert(1)` en plein milieu et laissait un `)` orphelin dans le
  // texte rendu. Le lien était bien désarmé — la propriété de sûreté tenait —
  // mais la phrase affichée devenait « clique ici) vite ».
  //
  // Le même défaut abîmait des adresses parfaitement légitimes :
  // `https://fr.wikipedia.org/wiki/Wax_(tissu)`.
  //
  // Un niveau suffit, et c'est ce que fait Markdown lui-même. Compter les
  // parenthèses à tous les niveaux demanderait un analyseur, pas une
  // expression — et personne n'écrit d'adresse à deux niveaux.
  const motif = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/g;

  let position = 0;
  let trouve: RegExpExecArray | null;

  while ((trouve = motif.exec(texte)) !== null) {
    if (trouve.index > position) {
      sortie.push({ type: "texte", valeur: texte.slice(position, trouve.index) });
    }

    if (trouve[1] !== undefined) {
      sortie.push({ type: "gras", valeur: trouve[1] });
    } else {
      const libelle = trouve[2] ?? "";
      const href = adresseSure(trouve[3] ?? "");

      // Une adresse refusée ne fait pas disparaître le texte : on garde ce que
      // l'auteur voulait dire, sans la rendre cliquable. Effacer la phrase
      // serait une censure silencieuse, et il n'en saurait rien.
      sortie.push(
        href === null
          ? { type: "texte", valeur: libelle }
          : { type: "lien", valeur: libelle, href },
      );
    }

    position = motif.lastIndex;
  }

  if (position < texte.length) {
    sortie.push({ type: "texte", valeur: texte.slice(position) });
  }

  return sortie;
}

/**
 * L'adresse, ou `null` si son schéma n'est pas permis.
 *
 * Les adresses relatives — « /blog », « /evenements/x » — sont acceptées : un
 * article renvoie souvent vers le site lui-même, et `//` est écarté parce
 * qu'il désigne un autre domaine sans le dire.
 */
export function adresseSure(brut: string): string | null {
  const valeur = brut.trim();
  if (valeur.length === 0) return null;

  if (valeur.startsWith("/")) {
    return valeur.startsWith("//") ? null : valeur;
  }

  try {
    const url = new URL(valeur);
    return SCHEMAS_PERMIS.includes(url.protocol) ? valeur : null;
  } catch {
    // Pas une URL absolue lisible. On refuse plutôt que de deviner : « ajouter
    // https:// devant » transformerait `javascript:alert(1)` en une adresse
    // valide vers un domaine nommé « javascript ».
    return null;
  }
}

/**
 * Un résumé, quand l'auteur n'en a pas écrit.
 *
 * Le premier paragraphe, coupé à la limite d'un mot. Couper au caractère
 * produirait « découvrez notre nouvelle sélec… », ce qui se remarque sur
 * chaque carte de la liste.
 */
export function extraitAutomatique(corps: string, limite = 160): string {
  const premier = analyser(corps).find((b) => b.type === "paragraphe");
  if (!premier || premier.type !== "paragraphe") return "";

  const texte = premier.contenu
    .map((i) => (i.type === "lien" ? i.valeur : i.valeur))
    .join("")
    .trim();

  if (texte.length <= limite) return texte;

  const coupe = texte.slice(0, limite);
  const espace = coupe.lastIndexOf(" ");

  // On ne coupe au dernier espace que s'il tombe assez loin. Sinon — un
  // premier mot très long — on garderait trois lettres au lieu de la ligne
  // entière. Le seuil est relatif à la limite demandée : l'écrire en dur
  // (« > 40 ») donnait un résultat faux dès qu'on passait une autre limite,
  // et c'est un test qui l'a montré.
  const garde = espace > limite * 0.6 ? coupe.slice(0, espace) : coupe;
  return `${garde.trimEnd()}…`;
}
