/**
 * Les adresses des aperçus publics — module pur, lisible par une carte côté
 * navigateur comme par la fabrique d'aperçus côté serveur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX TAILLES, UNE CONVENTION DE NOM
 *
 * Chaque image publique existe en deux tailles (`Doc/SPEC_BAOBART_SHIELD.md`
 * §3.1) : l'aperçu de la fiche (800 px) et la vignette du fil (400 px), toutes
 * deux filigranées. La base ne garde que l'adresse de l'aperçu (`coverUrl`) ;
 * celle de la vignette s'en déduit par son nom. Pas de colonne de plus, pas de
 * migration — et une couverture qui ne suit pas la convention (catalogue de
 * démonstration, image externe) reste servie telle quelle.
 *
 * ⚠️ Servie telle quelle veut dire SANS filigrane. Mesuré le 15/10/2026 sur la
 * base de développement : 102 couvertures publiées sur 102 étaient dans ce cas
 * (16 sous `/img/demo/`, 86 sous `demo/apercu/`), aucun aperçu `-v3` n'existait,
 * et rien ne le signalait. La tolérance reste — une image vide serait pire —
 * mais elle se compte (`estApercuCourant`, constat de l'écran Système) et se
 * répare (`regenererApercus`, second passage).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI LA VERSION CHANGE AVEC LA RECETTE
 *
 * Les aperçus sont servis `Cache-Control: immutable` pour un an : réécrire une
 * clé laisserait l'ancienne image dans les caches. Et un aperçu de v1.86.0
 * (`-v2`) n'a pas de vignette : déduire `-v2-400` d'une couverture `-v2`
 * pointerait le fil vers une image qui n'existe pas. La version 3 ne déduit de
 * vignette que pour les aperçus fabriqués avec elle.
 */

export const VERSION_APERCU = 3;

const PREFIXE = "public/apercus/";
const SUFFIXE_APERCU = `-v${VERSION_APERCU}.webp`;
const SUFFIXE_VIGNETTE = `-v${VERSION_APERCU}-400.webp`;

export function cleDApercu(mediaId: string): string {
  return `${PREFIXE}${mediaId}${SUFFIXE_APERCU}`;
}

export function cleDeVignette(mediaId: string): string {
  return `${PREFIXE}${mediaId}${SUFFIXE_VIGNETTE}`;
}

/** Les clés qu'ont pu avoir les aperçus d'un média, d'une recette à l'autre. */
export function anciennesClesDApercu(mediaId: string): string[] {
  return [`${PREFIXE}${mediaId}.webp`, `${PREFIXE}${mediaId}-v2.webp`];
}

/** Toutes les clés publiques d'un média — à supprimer quand il part. */
export function toutesLesClesDApercu(mediaId: string): string[] {
  return [cleDApercu(mediaId), cleDeVignette(mediaId), ...anciennesClesDApercu(mediaId)];
}

/**
 * Le média d'une clé d'aperçu d'une recette PÉRIMÉE, `null` sinon.
 *
 * Reconnaît `<id>.webp` (avant le filigrane) et `<id>-vN[-400].webp` pour tout
 * N plus petit que la version courante.
 */
export function mediaDUneClePerimee(cle: string): string | null {
  const m = new RegExp(`^${PREFIXE}([^/]+?)(?:-v(\\d+)(?:-400)?)?\\.webp$`).exec(cle);
  if (!m) return null;
  const version = m[2] ? Number(m[2]) : 1;
  return version < VERSION_APERCU ? m[1]! : null;
}

/**
 * Cette couverture est-elle un aperçu de la recette courante — donc filigranée,
 * réduite, signée en XMP ?
 *
 * Seule la fabrique (`produireApercu`) écrit sous `public/apercus/<id>-vN`.
 * Tout le reste — une image de démonstration, une adresse externe, un aperçu
 * d'une recette plus ancienne — est servi tel qu'il a été déposé.
 */
export function estApercuCourant(url: string): boolean {
  return new RegExp(`/${PREFIXE}[^/]+${SUFFIXE_APERCU.replace(".", "\\.")}$`).test(url);
}

/**
 * Les mêmes adresses, en filtre de chaîne Prisma : pour les compter en base
 * sans recopier la convention de nom ailleurs qu'ici.
 */
export const FILTRE_APERCU_COURANT = { contains: `/${PREFIXE}`, endsWith: SUFFIXE_APERCU } as const;

/**
 * L'adresse de la vignette du fil, déduite de celle de l'aperçu.
 *
 * Une adresse qui ne suit pas la convention de la version courante est rendue
 * telle quelle : mieux vaut une image un peu lourde qu'une image absente.
 */
export function vignetteDe(urlApercu: string): string {
  return urlApercu.endsWith(SUFFIXE_APERCU)
    ? urlApercu.slice(0, -SUFFIXE_APERCU.length) + SUFFIXE_VIGNETTE
    : urlApercu;
}
