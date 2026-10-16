import type { Reseau } from "@/lib/reseaux/reseaux";

/**
 * Les adresses de partage d'une page, réseau par réseau.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DES LIENS, PAS DES BOUTONS DE RÉSEAU
 *
 * Les boutons officiels (Facebook, X…) chargent un script du réseau sur
 * chaque page qui les affiche : le réseau apprend qui lit quoi, même sans
 * clic. Un lien vers la page de partage du réseau ne lui dit rien tant qu'on
 * ne clique pas. C'est ce que fait WordPress sans extension de partage
 * « officielle », et c'est ce qu'on fait ici. Aucun paramètre de suivi
 * (`utm_…`) n'est ajouté non plus : on partage l'adresse de la page, telle
 * qu'elle est.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SIX RÉSEAUX SUR DOUZE
 *
 * Seuls ceux qui ont une page de partage accessible depuis un lien :
 * WhatsApp, Facebook, X, LinkedIn, Pinterest, Threads. Instagram, TikTok,
 * Dribbble, Behance, Figma et YouTube n'en ont pas — on y publie depuis
 * l'application, pas depuis un lien. Pinterest épingle une image : sans
 * image, il n'est pas proposé.
 *
 * Lu dans la documentation de chaque réseau, non vérifié de bout en bout ici
 * (cela demanderait un compte sur chacun) : les formes `wa.me/?text=`,
 * `facebook.com/sharer/sharer.php?u=`, `twitter.com/intent/tweet`,
 * `linkedin.com/sharing/share-offsite/?url=`, `pinterest.com/pin/create/
 * button/`, `threads.net/intent/post?text=`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ENCODAGE EST FAIT À LA MAIN
 *
 * `encodeURIComponent` sur chaque paramètre, comme `lib/services/contact.ts`
 * et pour la même raison : `URLSearchParams` écrit les espaces en `+`, que
 * `mailto:` et plusieurs pages de partage prennent au pied de la lettre.
 */

export interface APartager {
  /** L'adresse absolue de la page. */
  url: string;
  titre: string;
  /** L'adresse absolue d'une image, pour Pinterest. */
  image?: string | null;
}

export interface Destination {
  reseau: Reseau;
  href: string;
}

const e = encodeURIComponent;

export function destinationsDePartage(p: APartager): Destination[] {
  const destinations: Destination[] = [
    { reseau: "whatsapp", href: `https://wa.me/?text=${e(`${p.titre} — ${p.url}`)}` },
    { reseau: "facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${e(p.url)}` },
    { reseau: "x", href: `https://twitter.com/intent/tweet?text=${e(p.titre)}&url=${e(p.url)}` },
    { reseau: "linkedin", href: `https://www.linkedin.com/sharing/share-offsite/?url=${e(p.url)}` },
  ];
  if (p.image) {
    destinations.push({
      reseau: "pinterest",
      href: `https://www.pinterest.com/pin/create/button/?url=${e(p.url)}&media=${e(p.image)}&description=${e(p.titre)}`,
    });
  }
  destinations.push({
    reseau: "threads",
    href: `https://www.threads.net/intent/post?text=${e(`${p.titre} ${p.url}`)}`,
  });
  return destinations;
}

/** Par courriel : le titre en objet, l'adresse dans le corps. */
export function courrielDePartage(p: APartager): string {
  return `mailto:?subject=${e(p.titre)}&body=${e(`${p.titre}\n${p.url}`)}`;
}

/**
 * Une adresse absolue depuis un chemin et une origine — `null` si le chemin
 * est vide. Une adresse déjà absolue passe telle quelle.
 */
export function absolue(chemin: string | null | undefined, origine: string): string | null {
  if (!chemin) return null;
  try {
    return new URL(chemin, origine).toString();
  } catch {
    return null;
  }
}
