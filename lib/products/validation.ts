/**
 * Règles de saisie d'une ressource.
 *
 * Séparées des actions serveur pour deux raisons : un module `"use server"` ne
 * peut exporter que des fonctions asynchrones, et ces règles n'ont aucune
 * raison de toucher à la base — donc elles se testent sans elle.
 */

/** Au-delà, c'est une faute de frappe, pas un prix. */
export const PRIX_MAX = 100_000_000;

/** Douze mots-clés suffisent : au-delà, ils ne classent plus rien. */
export const MOTS_CLES_MAX = 12;

export interface EtatProduit {
  erreur?: string;
  champ?: "titre" | "famille" | "prix" | "description" | "motsCles";
  /** Tous les champs en défaut (Q-23) ; `champ` reste le premier, pour le focus. */
  champs?: Array<"titre" | "famille" | "prix" | "description" | "motsCles">;
  /**
   * Posé par la modification quand elle a abouti.
   *
   * La création n'en a pas besoin : elle redirige vers la fiche, et la
   * redirection *est* la confirmation. Une modification reste sur place — sans
   * ce drapeau, l'écran ne bougerait pas et l'on ne saurait pas si le clic a
   * porté.
   */
  ok?: boolean;
  /**
   * Ce que la personne avait saisi.
   *
   * React 19 **vide les champs non contrôlés** quand une action de formulaire
   * se termine. Sans renvoyer les valeurs, un simple oubli de catégorie
   * effacerait le titre, les mots-clés et la description — et la deuxième
   * tentative se ferait reprocher le titre manquant qu'on venait d'écrire.
   */
  saisie?: {
    titre: string;
    famille: string;
    licence: string;
    motsCles: string;
    description: string;
    prix: string;
    gratuit: boolean;
  };
}

export function slugifier(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** Découpe « wax, portrait, motif » en mots-clés propres et dédoublonnés. */
export function decouperMotsCles(brut: string): string[] {
  const vus = new Set<string>();
  const resultat: string[] = [];

  for (const morceau of brut.split(/[,\n]/)) {
    const nom = morceau.trim().replace(/\s+/g, " ");
    if (nom.length === 0) continue;

    const slug = slugifier(nom);
    if (slug.length === 0 || vus.has(slug)) continue;

    vus.add(slug);
    resultat.push(nom);
    if (resultat.length >= MOTS_CLES_MAX) break;
  }

  return resultat;
}

/**
 * Le refus à opposer quand il y a trop de mots-clés, ou `null`.
 *
 * `decouperMotsCles` garde les douze premiers et jette le reste : c'est sa
 * borne. Mais le jeter sans le dire faisait perdre un mot-clé à son auteur
 * sans qu'il le sache (mesuré le 25/09, Qualitytest R29, S23 : 13 saisis, 12
 * enregistrés, rien à l'écran). On refuse donc, en nommant ce qui dépasse.
 */
export function tropDeMotsCles(brut: string): string | null {
  const vus = new Set<string>();
  const tous: string[] = [];
  for (const morceau of brut.split(/[,\n]/)) {
    const nom = morceau.trim().replace(/\s+/g, " ");
    const slug = slugifier(nom);
    if (slug.length === 0 || vus.has(slug)) continue;
    vus.add(slug);
    tous.push(nom);
  }
  if (tous.length <= MOTS_CLES_MAX) return null;
  const enTrop = tous.slice(MOTS_CLES_MAX);
  return (
    `${MOTS_CLES_MAX} mots-clés au plus — tu en as saisi ${tous.length}. ` +
    `Retire ${enTrop.length > 1 ? "ceux-ci" : "celui-ci"}, ou d'autres à la place : ${enTrop.join(", ")}.`
  );
}

/**
 * Prix retenu, ou `null` si la saisie est invalide.
 *
 * « Gratuit » l'emporte sur le prix saisi : deux commandes pour une seule
 * valeur, c'est la case qui décide — sinon on publierait un prix que la
 * personne croyait avoir annulé.
 */
export function prixRetenu(
  prixBrut: string,
  gratuit: boolean,
): { prix: number } | { erreur: string } {
  if (gratuit) return { prix: 0 };

  const chiffres = prixBrut.replace(/[^\d]/g, "");
  const prix = Number(chiffres || "0");

  if (!Number.isInteger(prix) || prix < 0 || prix > PRIX_MAX) {
    return { erreur: "Ce prix n'est pas valide." };
  }
  if (prix === 0) {
    return { erreur: "Indique un prix, ou coche « Gratuit »." };
  }

  return { prix };
}

export type ChampProduit = NonNullable<EtatProduit["champ"]>;

/**
 * Toutes les erreurs d'une saisie, pas seulement la première.
 *
 * Q-23 (recette du 14/11/2026) : une seule erreur était annoncée par envoi —
 * titre trop court, on corrige, renvoie : catégorie manquante, on corrige,
 * renvoie : prix invalide. La création et la modification faisaient ces quatre
 * vérifications en série, chacune avec son `return` ; elles les font ici, une
 * fois, et rapportent tout.
 *
 * `familleOk` vient de l'appelant : la résolution de la catégorie lit
 * `lib/feed/queries.ts`, et cette fonction reste pure.
 */
export function verifierSaisie(input: {
  titre: string;
  motsClesBrut: string;
  familleOk: boolean;
  prixBrut: string;
  gratuit: boolean;
}): { erreurs: { champ: ChampProduit; message: string }[]; prix: number | null } {
  const erreurs: { champ: ChampProduit; message: string }[] = [];
  if (input.titre.length < 3) erreurs.push({ champ: "titre", message: "Donne un titre d'au moins 3 caractères." });
  const tropDeMots = tropDeMotsCles(input.motsClesBrut);
  if (tropDeMots) erreurs.push({ champ: "motsCles", message: tropDeMots });
  if (!input.familleOk) erreurs.push({ champ: "famille", message: "Choisis une catégorie." });
  const prix = prixRetenu(input.prixBrut, input.gratuit);
  if ("erreur" in prix) erreurs.push({ champ: "prix", message: prix.erreur });
  return { erreurs, prix: "prix" in prix ? prix.prix : null };
}
