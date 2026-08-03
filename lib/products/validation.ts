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
  champ?: "titre" | "famille" | "prix" | "description";
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
