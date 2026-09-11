/**
 * Fabriquer un CSV que l'on peut ouvrir sans danger.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN CSV N'EST PAS UN FICHIER TEXTE INOFFENSIF
 *
 * C'est la raison d'être de ce module, et elle n'est pas évidente : un tableur
 * ne se contente pas d'afficher ce qu'on lui donne. Excel et LibreOffice
 * **exécutent** toute cellule qui commence par `=`, `+`, `-` ou `@`.
 *
 * Or les colonnes qu'on exporte ici sont remplies par les inscrits eux-mêmes.
 * Quelqu'un qui s'inscrit sous le nom
 *
 *     =HYPERLINK("http://malveillant.example","Cliquez")
 *
 * fait apparaître un lien cliquable dans le fichier que l'organisateur ouvre.
 * Et la famille `=cmd|'/c …'!A1`, sur d'anciennes versions, lance un
 * programme. L'attaque porte un nom — **injection de formule** — et elle ne
 * vise pas notre serveur : elle vise la personne qui ouvre le fichier, chez
 * elle, hors de notre portée.
 *
 * On préfixe donc d'une apostrophe toute valeur qui commence par un de ces
 * caractères. Le tableur affiche alors le texte tel quel, et n'exécute rien.
 * C'est la recommandation de l'OWASP, et elle coûte un caractère.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MODULE EST PUR
 *
 * Il reçoit des lignes, il rend une chaîne. C'est ce qui permet d'éprouver
 * l'échappement — guillemets, virgules, retours à la ligne, formules — sans
 * base ni requête HTTP.
 */

/** Les caractères qu'un tableur prend pour le début d'une formule. */
const AMORCES_DE_FORMULE = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Une valeur, rendue inoffensive puis échappée.
 *
 * Deux traitements distincts, et il ne faut pas les confondre :
 *
 *   — **neutraliser la formule** protège la personne qui ouvrira le fichier ;
 *   — **échapper les guillemets et séparateurs** protège le fichier lui-même,
 *     qui serait sinon illisible dès qu'un nom contient une virgule.
 */
export function cellule(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined) return "";

  let texte = String(valeur);

  if (AMORCES_DE_FORMULE.some((c) => texte.startsWith(c))) {
    texte = `'${texte}`;
  }

  // Un champ qui contient un séparateur, un guillemet ou un saut de ligne doit
  // être entouré de guillemets, et ses guillemets doublés. C'est la règle du
  // RFC 4180, et s'en écarter produit un fichier que rien ne relit.
  if (/[",;\n\r]/.test(texte)) {
    return `"${texte.replace(/"/g, '""')}"`;
  }

  return texte;
}

/**
 * Un CSV complet, prêt à être servi.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE POINT-VIRGULE, ET LE BOM
 *
 * Deux choix qui n'ont l'air de rien et qui décident si le fichier s'ouvre
 * correctement pour une personne en Côte d'Ivoire :
 *
 *   — **le séparateur est le point-virgule.** Excel configuré en français
 *     attend celui-là ; avec une virgule, tout atterrit dans une seule
 *     colonne, et l'on accuse l'export ;
 *   — **le fichier commence par un BOM UTF-8** (`﻿`, trois octets
 *     invisibles). Sans lui, Excel lit le fichier en encodage local et
 *     « Gnahoré » devient « GnahorÃ© ». Les autres lecteurs l'ignorent.
 *
 * Les fins de ligne sont en CRLF, comme le RFC 4180 le demande.
 */
export function versCsv(
  entetes: readonly string[],
  lignes: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const tout = [entetes, ...lignes]
    .map((ligne) => ligne.map(cellule).join(";"))
    .join("\r\n");

  return `﻿${tout}\r\n`;
}

/**
 * Un nom de fichier qu'aucun système ne refuse.
 *
 * Le titre d'un événement peut contenir des `/`, des `:`, des guillemets —
 * tout ce qu'un système de fichiers interdit. On ne prend donc que ce qui est
 * sûr, et l'on garde le reste du nom informatif : « inscrits-atelier-wax.csv »
 * se retrouve dans un dossier de téléchargements, « export.csv » non.
 */
export function nomDeFichier(titre: string, quand: Date): string {
  const propre = titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

  const jour = quand.toISOString().slice(0, 10);

  return `inscrits-${propre || "evenement"}-${jour}.csv`;
}
