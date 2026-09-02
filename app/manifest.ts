import type { MetadataRoute } from "next";

/**
 * Ce qui rend Baobart installable.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI UNE APPLICATION INSTALLÉE CHANGE QUELQUE CHOSE ICI
 *
 * Ce n'est pas une coquetterie. Deux raisons, propres au marché :
 *
 *   — **la notification.** Sur Android, un site ordinaire peut déjà en
 *     recevoir ; sur iOS, seule une application ajoutée à l'écran d'accueil le
 *     peut. Sans installation, tout un pan des abonnés n'a que le courriel et
 *     le SMS — dont l'un coûte ;
 *   — **le poids.** Une PWA se rouvre sans recharger l'enveloppe de la page.
 *     Sur une connexion facturée au mégaoctet, cela se remarque.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * `standalone` ET NON `fullscreen`
 *
 * `fullscreen` masque la barre d'état — l'heure, la batterie, le réseau.
 * Quelqu'un qui valide un paiement mobile money doit pouvoir voir son signal :
 * c'est exactement le moment où il lui faut. On garde donc la barre.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baobart — le studio partagé de l'Afrique créative",
    // Ce qui tient sous une icône d'écran d'accueil. Au-delà de douze
    // caractères, Android tronque avec des points de suspension.
    short_name: "Baobart",
    description:
      "Publier, découvrir, vendre. Du premier croquis au premier encaissement, en FCFA.",
    // On ouvre sur le tableau de bord et non sur l'accueil : quelqu'un qui a
    // installé l'application est déjà entré, et l'accueil est une page de
    // présentation qu'il a déjà lue.
    start_url: "/dashboard",
    // La portée couvre tout le site : sans cela, un clic sur une notification
    // menant hors de la portée rouvrirait le navigateur par-dessus
    // l'application.
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "fr",
    dir: "ltr",
    // Le jaune de la charte : c'est la couleur de la barre système pendant le
    // chargement, et celle du fond d'écran de démarrage.
    background_color: "#FFD84A",
    theme_color: "#FFD84A",
    categories: ["shopping", "business", "productivity"],
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android rogne jusqu'à vingt pour cent de chaque bord selon le lanceur.
      // Cette variante-là porte la marge qu'il faut ; servir l'icône ordinaire
      // en « maskable » ferait amputer le baobab sur les lanceurs qui
      // découpent en cercle.
      {
        src: "/icones/icone-masquable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Mon forfait",
        url: "/dashboard/forfait",
        description: "Voir l'échéance et renouveler",
      },
      {
        name: "Mes achats",
        url: "/dashboard/achats",
        description: "Retrouver les fichiers achetés",
      },
    ],
  };
}
