/**
 * La partie HTML d'un courriel, fabriquée À PARTIR DU TEXTE (Q-28, décidé le
 * 21/11/2026).
 *
 * Module pur : ni base, ni réseau, ni dépendance.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN SEUL ENDROIT OÙ L'ON ÉCHAPPE
 *
 * Les trente et un modèles de `modeles.ts` écrivent du texte, et des champs
 * venus des utilisateurs s'y glissent : un nom affiché, le titre d'une
 * ressource, un motif, l'extrait d'un avis, le corps d'un message. Écrire un
 * gabarit HTML par modèle, c'eût été trente et une occasions d'oublier
 * d'échapper l'un d'eux — et un `<a href>` injecté dans la boîte d'un acheteur,
 * signé de notre nom.
 *
 * Ici, le texte entier passe par `echapper` AVANT toute mise en forme : ce qui
 * devient balise (paragraphe, mise en avant, lien) est produit par ce module,
 * jamais lu dans le texte. Le HTML ne peut donc rien dire que le texte ne dise
 * déjà, et le texte reste envoyé à côté (message en deux parties).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * QUELLES ADRESSES DEVIENNENT DES LIENS
 *
 * Seulement celles en http(s) dont l'ORIGINE est celle d'un champ « lien » du
 * modèle — des adresses que le code fabrique (`APP_URL`). Une adresse qu'un
 * utilisateur glisse dans un motif ou un message reste du texte : le courriel
 * ne la rendra pas cliquable sous notre nom. `javascript:` ou `data:` ne le
 * deviennent jamais, quel que soit le champ (`RETRAIT_JURIDIQUE.lien` est
 * validé par `z.string().url()`, qui les accepte).
 *
 * Ni image, ni pixel, ni ressource externe : la page de confidentialité dit
 * qu'on ne sait pas si la lettre est ouverte, et c'est vrai.
 */

const ECHAPPEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Rend inoffensif un texte à placer dans du HTML, entre balises ou dans un attribut. */
export function echapper(brut: string): string {
  return brut.replace(/[&<>"']/g, (c) => ECHAPPEMENTS[c]!);
}

/** Les origines http(s) des champs « lien » d'un modèle : ce qui a le droit d'être cliquable. */
export function originesSures(liens: readonly string[]): Set<string> {
  const origines = new Set<string>();
  for (const l of liens) {
    try {
      const u = new URL(l);
      if (u.protocol === "http:" || u.protocol === "https:") origines.add(u.origin);
    } catch {
      // Un champ qui n'est pas une adresse ne rend rien cliquable.
    }
  }
  return origines;
}

/** Une adresse dans le texte. La ponctuation qui la suit (« . », « ) », « , ») n'en fait pas partie. */
const ADRESSE = /https?:\/\/[^\s<>"«»]+/g;
const PONCTUATION_FINALE = /[.,;:!?)]+$/;

function cliquable(adresse: string, origines: Set<string>): boolean {
  try {
    const u = new URL(adresse);
    return (u.protocol === "http:" || u.protocol === "https:") && origines.has(u.origin);
  } catch {
    return false;
  }
}

/** Une ligne de texte en HTML : tout échappé, et les adresses sûres en liens. */
function ligneEnHtml(ligne: string, origines: Set<string>): string {
  let sortie = "";
  let depuis = 0;
  for (const trouve of ligne.matchAll(ADRESSE)) {
    const debut = trouve.index ?? 0;
    const adresse = trouve[0].replace(PONCTUATION_FINALE, "");
    if (!cliquable(adresse, origines)) continue;
    sortie += echapper(ligne.slice(depuis, debut));
    sortie += `<a href="${echapper(adresse)}" style="color:#121212;font-weight:700;text-decoration:underline;">${echapper(adresse)}</a>`;
    depuis = debut + adresse.length;
  }
  return sortie + echapper(ligne.slice(depuis));
}

const SEPARATEUR = /^[—–-]{1,}$/;

/** Un paragraphe du texte (séparé des autres par une ligne vide) en HTML. */
const FILET = `<hr style="border:0;border-top:2px solid #121212;margin:20px 0;">`;

function paragrapheEnHtml(paragraphe: string, origines: Set<string>): string {
  const lignes = paragraphe.split("\n");

  // Un filet — « ——— » seul, ou « — » en tête du pied de la lettre — devient une
  // ligne de séparation ; le reste du paragraphe suit.
  const filet = SEPARATEUR.test(lignes[0]!.trim());
  const reste = filet ? lignes.slice(1) : lignes;
  if (reste.length === 0) return FILET;
  const avant = filet ? FILET : "";

  // Des lignes en retrait de deux espaces : les valeurs que le texte met en avant
  // (un montant, une ressource, un code). Un encadré, comme dans le texte.
  if (reste.every((l) => l.startsWith("  "))) {
    const contenu = reste.map((l) => ligneEnHtml(l.trim(), origines)).join("<br>");
    return `${avant}<p style="margin:0 0 14px;padding:12px 16px;border:2px solid #121212;border-radius:12px;background:#F4EEFC;font-weight:700;">${contenu}</p>`;
  }

  return `${avant}<p style="margin:0 0 14px;">${reste.map((l) => ligneEnHtml(l, origines)).join("<br>")}</p>`;
}

/**
 * Le courriel entier, en HTML.
 *
 * Mis en page pour les clients de messagerie, qui ignorent souvent les feuilles
 * de style : tout est en attributs `style`. L'encre et la lavande de la charte ;
 * les liens en encre soulignée (l'orange sur blanc ne fait que 3,9:1).
 */
export function versHtml(texte: string, entree: { sujet: string; liens: readonly string[] }): string {
  const origines = originesSures(entree.liens);
  const paragraphes = texte
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/^\n+|\n+$/g, ""))
    .filter((p) => p.trim() !== "")
    .map((p) => paragrapheEnHtml(p, origines))
    .join("\n");

  const sujet = echapper(entree.sujet);
  return [
    "<!doctype html>",
    '<html lang="fr">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${sujet}</title>`,
    "</head>",
    '<body style="margin:0;padding:0;background:#F4EEFC;">',
    `<div role="article" aria-label="${sujet}" style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#121212;">`,
    '<p style="margin:0 0 16px;font-size:22px;font-weight:800;">Baobart.</p>',
    '<div style="background:#FFFFFF;border:2px solid #121212;border-radius:16px;padding:20px;">',
    paragraphes,
    "</div>",
    "</div>",
    "</body>",
    "</html>",
  ].join("\n");
}
