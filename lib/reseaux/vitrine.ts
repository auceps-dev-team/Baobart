import { RESEAUX, adresseAffichable, depuisBase, identifiant, type Reseau } from "@/lib/reseaux/reseaux";

/**
 * Ce que la vitrine accepte d'afficher : le portfolio et les réseaux d'un
 * créateur, filtrés.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE SEULE RÈGLE, POUR LA VITRINE ET POUR CE QUI LA PRÉPARE
 *
 * Sortie de `lib/createurs/queries.ts` le 09/11/2026. La relecture d'Argon a
 * relevé que « Devenir vendeur » tenait l'étape « lien ou portfolio » pour
 * faite sur `awadiallo.com` — une valeur que la vitrine écarte (pas de
 * `https://`). Un succès silencieux : l'étape se cochait, et rien n'apparaissait
 * sur le profil. Les deux écrans appellent désormais ces fonctions-ci, et
 * aucune copie de la règle n'existe ailleurs.
 *
 * Pur : ni base, ni réseau.
 */

export interface LienAffichable {
  reseau: Reseau;
  url: string;
  identifiant: string;
}

/**
 * Le portfolio, seulement en `https://`. Une valeur sans protocole
 * (`awadiallo.com`, dans les données de démonstration) deviendrait un lien
 * relatif vers `/createurs/awadiallo.com` — une page qui n'existe pas.
 */
export function portfolioAffichable(url: string | null | undefined): string | null {
  return url?.startsWith("https://") ? url : null;
}

/**
 * Les réseaux rangés, remis dans l'ordre de la maquette. Une adresse qui ne
 * mène plus sur son réseau est écartée ici, avant l'écran : c'est l'affichage
 * qui pose le logo dessus.
 */
export function liensAffichables(lignes: ReadonlyArray<{ network: string; url: string }>): LienAffichable[] {
  const liens: LienAffichable[] = [];
  for (const reseau of RESEAUX) {
    const ligne = lignes.find((l) => depuisBase(l.network) === reseau);
    const url = ligne ? adresseAffichable(reseau, ligne.url) : null;
    if (url) liens.push({ reseau, url, identifiant: identifiant(reseau, url) });
  }
  return liens;
}
