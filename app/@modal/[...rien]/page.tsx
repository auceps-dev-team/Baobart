/**
 * Toute autre adresse : le créneau de la modale ne rend rien.
 *
 * Q-13 (recette du 14/11/2026) : sur une adresse inconnue, Next construit
 * l'arbre de la page « introuvable » SANS le créneau `modal` du layout
 * racine ; chaque préchargement envoyé depuis cette page répondait alors 500
 * (« Cannot read properties of undefined (reading '0') »). Mesuré le
 * 20/11/2026 : un arbre sans `modal` suffit à faire répondre 500 à /explore.
 * Une route attrape-tout dans le créneau lui donne une valeur partout —
 * c'est aussi le motif que la documentation de Next propose pour les modales
 * (lu, non revérifié dans leur dépôt).
 */
export default function PasDeModaleIci() {
  return null;
}
