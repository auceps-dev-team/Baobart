/**
 * Le lien d'une ressource hébergée ailleurs.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI EST DÉCIDÉ
 *
 * Décidé le 15/10/2026 : un créateur peut vendre un fichier qu'il héberge
 * lui-même — son Drive, son Dropbox, son site. Baobart garde la porte : la
 * route de téléchargement vérifie l'achat comme pour un fichier hébergé, puis
 * redirige vers ce lien.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE ÇA NE PROTÈGE PAS
 *
 * Une fois la porte passée, l'acheteur voit l'adresse finale, et elle ne
 * s'éteint pas : il peut la transmettre. Une URL signée de notre stockage
 * expire en quelques minutes ; un lien de partage Drive, non. La fiche le dit
 * avant l'achat (« Hébergé sur … »), et le créateur le lit en ajoutant le lien.
 *
 * On ne va pas chercher le fichier : ni taille, ni type, ni contrôle de
 * contenu. Interroger une adresse fournie par un tiers depuis notre serveur
 * ouvrirait une porte sur notre réseau interne, pour un renseignement que le
 * créateur peut changer le lendemain.
 *
 * Pur : ni base, ni réseau. Le navigateur s'en sert pour refuser tôt, le
 * serveur pour décider.
 */

/** Au-delà, ce n'est plus un lien de partage mais autre chose. */
export const LIEN_MAX = 2048;

/** La même borne que le nom d'un fichier hébergé (`lib/upload/actions.ts`). */
export const NOM_MAX = 180;

export type VerdictLien =
  | { ok: true; url: string; hote: string }
  | { ok: false; message: string };

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** L'hôte tel qu'on le montre : sans `www.`, qui n'apprend rien à personne. */
export function hoteAffiche(hote: string): string {
  return hote.toLowerCase().replace(/^www\./, "");
}

/**
 * L'hôte d'un lien déjà enregistré, pour l'afficher.
 *
 * Ne lève jamais : un lien illisible en base — qui n'aurait pas dû y entrer —
 * ne doit pas faire tomber la fiche.
 */
export function hoteDuLien(url: string): string {
  try {
    return hoteAffiche(new URL(url).hostname);
  } catch {
    return "un site extérieur";
  }
}

export function verifierLienExterne(brut: string): VerdictLien {
  const saisi = brut.trim();
  if (saisi.length === 0) return { ok: false, message: "Colle l'adresse du fichier." };
  if (saisi.length > LIEN_MAX) return { ok: false, message: "Cette adresse est trop longue pour être un lien de partage." };

  let url: URL;
  try {
    url = new URL(saisi);
  } catch {
    return { ok: false, message: "Ce n'est pas une adresse complète : elle doit commencer par https://." };
  }

  // http se lit et se réécrit en route : l'acheteur pourrait recevoir autre
  // chose que ce qu'il a payé. javascript:, data: et les autres ne mènent à
  // aucun fichier. La base le refuse aussi (contrainte `…_lien_externe_https`).
  if (url.protocol !== "https:") {
    return { ok: false, message: "Seules les adresses en https sont acceptées." };
  }

  // Un identifiant dans l'adresse se recopierait chez chaque acheteur.
  if (url.username || url.password) {
    return { ok: false, message: "L'adresse ne doit contenir ni identifiant ni mot de passe." };
  }

  // Un hébergeur de fichiers a un nom. Une adresse IP, un nom sans point ou un
  // nom de réseau local ne mènent pas à un site public — ou mènent là où
  // l'acheteur ne devrait pas aller.
  const hote = url.hostname.toLowerCase();
  if (
    IPV4.test(hote) ||
    hote.startsWith("[") ||
    !hote.includes(".") ||
    hote === "localhost" ||
    hote.endsWith(".localhost") ||
    hote.endsWith(".local") ||
    hote.endsWith(".internal")
  ) {
    return { ok: false, message: "Le lien doit mener à un site public, pas à une adresse IP ni à un réseau local." };
  }

  return { ok: true, url: url.href, hote: hoteAffiche(hote) };
}

/**
 * Le nom montré à l'acheteur sur le bouton (« Télécharger Pack complet »).
 *
 * Facultatif : sans nom, c'est l'hôte qui parle. Les caractères de contrôle
 * partent — un saut de ligne dans un libellé de bouton n'est jamais voulu.
 */
export function nomDuLien(brut: string, hote: string): string {
  const propre = brut.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return (propre.length > 0 ? propre : `Fichier sur ${hote}`).slice(0, NOM_MAX);
}
