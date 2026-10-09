import "server-only";

import sharp from "sharp";

import { journal } from "@/lib/observabilite/journal";

import { filigraner, texteDuFiligrane } from "./filigrane";
import { cleDApercu, cleDeVignette } from "./vignette";
import { formatDe } from "./formats";
import {
  deposerObjet,
  telechargerObjet,
  urlPublique,
} from "./storage";

/**
 * Fabrique des aperçus.
 *
 * L'aperçu est une **image dérivée**, pas le fichier vendu. La distinction est
 * tout l'enjeu : un PNG à 8 000 px vendu 15 000 F ne peut pas servir lui-même
 * de vignette au feed, sinon il est gratuit pour qui lit le code source de la
 * page. On produit donc une version réduite, publique, et l'original reste
 * privé derrière une URL signée.
 */

/**
 * Largeur maximale d'un aperçu, et sa qualité.
 *
 * 800 px en WebP qualité 60 : `Doc/SPEC_BAOBART_SHIELD.md` §3.1 (« aperçu
 * détail ~800 px, q60, filigrane diagonal visible »). Avant le 09/10/2026 :
 * 1 400 px en qualité 80, sans marque — assez pour un usage réel de l'image,
 * ce qui en faisait la version gratuite de ce qui est vendu. La carte du fil
 * l'affiche sur moins de 400 px : elle n'y perd rien.
 */
export const LARGEUR_APERCU = 800;
export const QUALITE_APERCU = 60;

/** La vignette du fil : 400 px, qualité 65 (spec §3.1, « miniature feed »). */
export const LARGEUR_VIGNETTE = 400;
export const QUALITE_VIGNETTE = 65;

// Les clés vivent dans `./vignette` : la carte du fil, côté navigateur, en
// déduit l'adresse de la vignette.
export { cleDApercu, cleDeVignette, VERSION_APERCU } from "./vignette";

/**
 * Les métadonnées XMP posées dans chaque aperçu : qui l'a créé, et le refus
 * de la fouille de données pour l'entraînement d'IA.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE CHAMP « DATA MINING » DE L'IPTC
 *
 * `plus:DataMining` (espace `http://ns.useplus.org/ldf/xmp/1.0/`), valeur
 * `DMI-PROHIBITED-EXCEPTSEARCHENGINEINDEXING` : interdit sauf l'indexation
 * par les moteurs de recherche — la fiche doit rester trouvable. Vocabulaire
 * lu le 09/10/2026 dans le code d'exiftool 13.59 (`Image/ExifTool/PLUS.pm`),
 * la page de l'IPTC n'étant pas joignable depuis cet environnement ; l'aperçu
 * produit a été relu par exiftool, qui décode la valeur (voir le commit).
 *
 * C'est une DÉCLARATION, pas une serrure : un robot qui ne lit pas les
 * métadonnées, ou les jette, n'est arrêté par rien. Elle compte pour qui
 * respecte la règle — et comme preuve d'une réserve explicite.
 */
export function xmpDe(pseudo: string | null): string {
  const echapper = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const auteur = echapper(pseudo ? `@${pseudo}` : "Baobart");
  const droits = echapper(
    `© ${pseudo ? `@${pseudo}` : "le créateur"} — aperçu Baobart. Reproduction et entraînement d'IA interdits.`,
  );
  return [
    `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>`,
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">`,
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`,
    `<rdf:Description rdf:about=""`,
    ` xmlns:dc="http://purl.org/dc/elements/1.1/"`,
    ` xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"`,
    ` xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/"`,
    ` xmpRights:Marked="True"`,
    ` plus:DataMining="http://ns.useplus.org/ldf/vocab/DMI-PROHIBITED-EXCEPTSEARCHENGINEINDEXING">`,
    `<dc:creator><rdf:Seq><rdf:li>${auteur}</rdf:li></rdf:Seq></dc:creator>`,
    `<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${droits}</rdf:li></rdf:Alt></dc:rights>`,
    `</rdf:Description>`,
    `</rdf:RDF>`,
    `</x:xmpmeta>`,
    `<?xpacket end="w"?>`,
  ].join("");
}

/**
 * Au-delà, on renonce à l'aperçu plutôt que de charger le fichier en mémoire.
 * La ressource reste vendable — elle affichera la trame du design system.
 */
export const POIDS_MAX_APERCU = 40 * 1024 * 1024;

export interface Apercu {
  cle: string;
  url: string;
  largeur: number;
  hauteur: number;
}

/**
 * Dimensions réelles du fichier, lues à la source.
 *
 * Ce sont ces valeurs-là qui s'affichent sur la fiche — jamais celles que le
 * créateur aurait saisies. Une dimension annoncée n'est pas une dimension.
 */
export interface Mesures {
  largeur: number;
  hauteur: number;
}

/** Un aperçu ne se tente que pour ce qui s'affiche déjà tel quel. */
export function apercuPossible(nomFichier: string, taille: number): boolean {
  return formatDe(nomFichier)?.apercu === "direct" && taille <= POIDS_MAX_APERCU;
}

/**
 * Produit l'aperçu public d'un média et renvoie son URL.
 *
 * `null` si le fichier ne s'y prête pas ou si l'image est illisible — un fichier
 * corrompu ne doit pas empêcher la ressource d'exister.
 */
export async function produireApercu(input: {
  mediaId: string;
  cleSource: string;
  nomFichier: string;
  taille: number;
  /** Le pseudo du créateur, écrit dans le filigrane. */
  pseudo: string | null;
}): Promise<Apercu | null> {
  if (!apercuPossible(input.nomFichier, input.taille)) return null;

  const source = await telechargerObjet(input.cleSource, POIDS_MAX_APERCU);
  if (!source) return null;

  try {
    const image = sharp(source, {
      // Un SVG est rastérisé à la densité demandée, pas à sa taille nominale.
      density: 200,
      // Une bombe de décompression ne doit pas emporter le serveur.
      limitInputPixels: 100_000_000,
    });

    const metadonnees = await image.metadata();

    // Orientation EXIF appliquée une fois : sinon les photos sortent couchées.
    const redressee = await image.rotate().png().toBuffer();
    const texte = texteDuFiligrane(input.pseudo);
    const xmp = xmpDe(input.pseudo);

    /** Une taille : réduite, marquée à SA largeur, compressée, signée en XMP. */
    const rendre = async (largeur: number, qualite: number) => {
      const reduite = await sharp(redressee)
        .resize({
          width: largeur,
          // On ne grossit jamais une petite image : ce serait du flou en plus lourd.
          withoutEnlargement: true,
          fit: "inside",
        })
        // Sans perte à l'étape intermédiaire : la seule compression est la finale.
        .png()
        .toBuffer();
      const marquee = await filigraner(reduite, texte);
      return sharp(marquee).withXmp(xmp).webp({ quality: qualite }).toBuffer({ resolveWithObject: true });
    };

    const [rendu, vignette] = await Promise.all([
      rendre(LARGEUR_APERCU, QUALITE_APERCU),
      rendre(LARGEUR_VIGNETTE, QUALITE_VIGNETTE),
    ]);

    // La vignette AVANT l'aperçu : la base ne garde que l'adresse de l'aperçu,
    // et la carte du fil en déduit celle de la vignette. Déposée après, une
    // vignette qui échoue laisserait une couverture qui pointe vers une
    // vignette absente.
    await deposerObjet({ cle: cleDeVignette(input.mediaId), corps: vignette.data, contentType: "image/webp" });

    const cle = cleDApercu(input.mediaId);
    await deposerObjet({ cle, corps: rendu.data, contentType: "image/webp" });

    return {
      cle,
      url: urlPublique(cle),
      // Les dimensions retenues sont celles de l'original, pas de la vignette :
      // c'est ce que l'acheteur reçoit qui l'intéresse.
      largeur: metadonnees.width ?? rendu.info.width,
      hauteur: metadonnees.height ?? rendu.info.height,
    };
  } catch (cause) {
    // Un fichier illisible n'empêche pas la ressource d'exister. Mais le
    // journal le dit : un filigrane qui échoue (police absente) ne doit pas
    // passer pour une image corrompue.
    journal.avertissement("aperçu non produit", {
      media: input.mediaId,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}
