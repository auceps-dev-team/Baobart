/**
 * Les réseaux sociaux qu'un créateur peut afficher sur sa vitrine.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DOUZE, DANS L'ORDRE DE LA MAQUETTE
 *
 * La section « 05 · Logos réseaux » du Design System (relue le 16/10) dessine
 * douze marques, chacune sur un fond de la palette : Instagram, Facebook,
 * LinkedIn, Dribbble, Figma, TikTok, Behance, YouTube, X, Pinterest, WhatsApp,
 * Threads. L'ordre et les fonds viennent de son tableau `socials`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN LIEN « INSTAGRAM » MÈNE SUR INSTAGRAM, ET NULLE PART AILLEURS
 *
 * C'est la règle qui compte. Une pastille porte un logo que le visiteur
 * reconnaît : il clique en croyant aller sur Instagram. Accepter n'importe
 * quelle adresse sous ce logo, ce serait offrir à quiconque un lien déguisé
 * — vers une fausse page de connexion, typiquement. On garde donc, pour
 * chaque réseau, la liste de ses domaines, et une adresse qui n'y mène pas
 * est refusée à l'enregistrement **et** ignorée à l'affichage.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON RANGE L'ADRESSE, ON CALCULE L'IDENTIFIANT
 *
 * Les gens collent l'adresse entière, le « @pseudo » ou le pseudo nu. Les trois
 * repartent d'ici en une adresse `https://` complète. L'identifiant affiché à
 * côté du logo (« @awa.draws », « /awa ») se recalcule depuis l'adresse au
 * moment d'afficher : rangé à part, il divergerait de l'adresse au premier
 * changement.
 *
 * L'adresse plutôt que le pseudo, parce qu'un pseudo ne suffit pas partout :
 * LinkedIn distingue `/in/` (une personne) de `/company/` (une entreprise),
 * YouTube a des `@chaine` et des `/channel/UC…`. Le pseudo nu reste accepté —
 * on lui donne alors la forme la plus courante.
 *
 * Le module est pur : des chaînes entrent, une décision sort.
 */

export const RESEAUX = [
  "instagram",
  "facebook",
  "linkedin",
  "dribbble",
  "figma",
  "tiktok",
  "behance",
  "youtube",
  "x",
  "pinterest",
  "whatsapp",
  "threads",
] as const;

export type Reseau = (typeof RESEAUX)[number];

/** Les fonds de la maquette — jamais les couleurs officielles des marques. */
const JAUNE = "#FFD84A";
const MAUVE = "#C9A8F5";
const BLANC = "#FFFFFF";
const ORANGE = "#E2622C";
const LAVANDE = "#EADFF9";

interface Fiche {
  nom: string;
  /** Le fond de la pastille, tel que la maquette l'attribue. */
  fond: string;
  /** Les domaines du réseau. Un sous-domaine (`fr.`, `m.`) passe aussi. */
  domaines: string[];
  /** Ce qu'un pseudo nu peut contenir. */
  pseudo: RegExp;
  /** L'adresse qu'on donne à un pseudo nu. */
  adresse: (pseudo: string) => string;
  /** Ce qu'on écrit dans le champ vide, pour montrer la forme attendue. */
  exemple: string;
}

const FICHES: Record<Reseau, Fiche> = {
  instagram: {
    nom: "Instagram",
    fond: JAUNE,
    domaines: ["instagram.com"],
    pseudo: /^[a-z0-9._]{1,30}$/i,
    adresse: (p) => `https://www.instagram.com/${p}/`,
    exemple: "@awa.draws",
  },
  facebook: {
    nom: "Facebook",
    fond: MAUVE,
    domaines: ["facebook.com", "fb.com"],
    pseudo: /^[a-z0-9.]{5,50}$/i,
    adresse: (p) => `https://www.facebook.com/${p}`,
    exemple: "facebook.com/awadiallo",
  },
  linkedin: {
    nom: "LinkedIn",
    fond: BLANC,
    domaines: ["linkedin.com"],
    pseudo: /^[a-z0-9-]{3,100}$/i,
    adresse: (p) => `https://www.linkedin.com/in/${p}`,
    exemple: "linkedin.com/in/awa-diallo",
  },
  dribbble: {
    nom: "Dribbble",
    fond: ORANGE,
    domaines: ["dribbble.com"],
    pseudo: /^[a-z0-9_-]{2,40}$/i,
    adresse: (p) => `https://dribbble.com/${p}`,
    exemple: "@awadiallo",
  },
  figma: {
    nom: "Figma",
    fond: LAVANDE,
    domaines: ["figma.com"],
    pseudo: /^[a-z0-9_-]{2,40}$/i,
    adresse: (p) => `https://www.figma.com/@${p}`,
    exemple: "@awadiallo",
  },
  tiktok: {
    nom: "TikTok",
    fond: JAUNE,
    domaines: ["tiktok.com"],
    pseudo: /^[a-z0-9._]{2,24}$/i,
    adresse: (p) => `https://www.tiktok.com/@${p}`,
    exemple: "@awa.draws",
  },
  behance: {
    nom: "Behance",
    fond: MAUVE,
    domaines: ["behance.net"],
    pseudo: /^[a-z0-9_-]{3,40}$/i,
    adresse: (p) => `https://www.behance.net/${p}`,
    exemple: "behance.net/awadiallo",
  },
  youtube: {
    nom: "YouTube",
    fond: ORANGE,
    domaines: ["youtube.com"],
    pseudo: /^[a-z0-9._-]{3,30}$/i,
    adresse: (p) => `https://www.youtube.com/@${p}`,
    exemple: "@awadiallo",
  },
  x: {
    nom: "X",
    fond: BLANC,
    domaines: ["x.com", "twitter.com"],
    pseudo: /^[a-z0-9_]{1,15}$/i,
    adresse: (p) => `https://x.com/${p}`,
    exemple: "@awadiallo",
  },
  pinterest: {
    nom: "Pinterest",
    fond: LAVANDE,
    domaines: ["pinterest.com", "pinterest.fr"],
    pseudo: /^[a-z0-9_]{3,30}$/i,
    adresse: (p) => `https://www.pinterest.com/${p}/`,
    exemple: "pinterest.com/awadiallo",
  },
  whatsapp: {
    nom: "WhatsApp",
    fond: JAUNE,
    // `chat.` pour un groupe, `whatsapp.com/channel/…` pour une chaîne :
    // la maquette montre « Communauté », pas seulement un numéro.
    domaines: ["wa.me", "whatsapp.com"],
    // Un numéro international, chiffres seuls : c'est ce que `wa.me` attend.
    pseudo: /^\d{8,15}$/,
    adresse: (p) => `https://wa.me/${p}`,
    exemple: "+225 07 00 00 00 00",
  },
  threads: {
    nom: "Threads",
    fond: MAUVE,
    domaines: ["threads.net", "threads.com"],
    pseudo: /^[a-z0-9._]{1,30}$/i,
    adresse: (p) => `https://www.threads.net/@${p}`,
    exemple: "@awa.draws",
  },
};

export function nomDuReseau(reseau: Reseau): string {
  return FICHES[reseau].nom;
}

export function fondDuReseau(reseau: Reseau): string {
  return FICHES[reseau].fond;
}

export function exempleDuReseau(reseau: Reseau): string {
  return FICHES[reseau].exemple;
}

export function estReseau(valeur: string): valeur is Reseau {
  return (RESEAUX as readonly string[]).includes(valeur);
}

/** La valeur de l'enum `SocialNetwork` : le même nom, en majuscules. */
export function enBase(reseau: Reseau): Uppercase<Reseau> {
  return reseau.toUpperCase() as Uppercase<Reseau>;
}

/** L'inverse — `null` pour une valeur que ce module ne connaît pas. */
export function depuisBase(valeur: string): Reseau | null {
  const r = valeur.toLowerCase();
  return estReseau(r) ? r : null;
}

const LONGUEUR_MAX = 300;

export type Lecture =
  | { ok: true; url: string | null }
  | { ok: false; message: string };

/**
 * Ce qu'un créateur a tapé dans le champ d'un réseau, rendu en adresse.
 *
 * `url: null` veut dire « champ vide » : le lien est retiré.
 */
export function lireLien(reseau: Reseau, brut: string): Lecture {
  const fiche = FICHES[reseau];
  const propre = brut.trim();
  if (propre.length === 0) return { ok: true, url: null };
  if (propre.length > LONGUEUR_MAX) {
    return { ok: false, message: `Le lien ${fiche.nom} est trop long.` };
  }

  const url = enAdresse(propre);
  if (url === null) return lirePseudo(reseau, propre);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, message: `Colle l'adresse de ta page ${fiche.nom}.` };
  }
  // `https://instagram.com@piege.example` se lit « utilisateur instagram.com
  // sur piege.example » : un lien qui ment sur sa destination.
  if (url.username || url.password || url.port) {
    return { ok: false, message: `Cette adresse ${fiche.nom} n'est pas valable.` };
  }

  const hote = url.hostname.toLowerCase();
  if (!surLeDomaine(hote, fiche.domaines)) {
    const autre = RESEAUX.find((r) => r !== reseau && surLeDomaine(hote, FICHES[r].domaines));
    return {
      ok: false,
      message: autre
        ? `Cette adresse mène à ${FICHES[autre].nom}, pas à ${fiche.nom}.`
        : `Cette adresse ne mène pas à ${fiche.nom}.`,
    };
  }

  const chemin = url.pathname.replace(/\/+$/, "");
  if (chemin.length === 0) {
    return {
      ok: false,
      message: `Ce lien mène à l'accueil de ${fiche.nom}, pas à ta page.`,
    };
  }

  // Le http est relevé en https : on connaît le domaine, et tous ces réseaux
  // le servent. Le fragment et les paramètres de suivi (`igsh`, `utm_…`)
  // partent — sauf les deux paramètres qui désignent la page elle-même.
  url.protocol = "https:";
  url.hash = "";
  const garde = new URLSearchParams();
  for (const cle of ["id", "phone"]) {
    const valeur = url.searchParams.get(cle);
    if (valeur) garde.set(cle, valeur);
  }
  url.search = garde.toString();

  return { ok: true, url: url.toString() };
}

/**
 * Une adresse rangée, si elle est encore affichable sous ce logo.
 *
 * La lecture l'a déjà vérifiée à l'enregistrement. On revérifie quand même :
 * une ligne peut venir d'un import, d'un script, d'une ancienne version — et
 * c'est l'affichage qui met le logo dessus.
 */
export function adresseAffichable(reseau: Reseau, url: string): string | null {
  let lue: URL;
  try {
    lue = new URL(url);
  } catch {
    return null;
  }
  if (lue.protocol !== "https:" || lue.username || lue.password || lue.port) return null;
  return surLeDomaine(lue.hostname.toLowerCase(), FICHES[reseau].domaines) ? lue.toString() : null;
}

/**
 * Ce qu'on écrit à côté du logo : « @awa.draws », « /awadiallo »,
 * « awa-diallo ». La forme suit la maquette (`socials`, champ `handle`).
 */
export function identifiant(reseau: Reseau, url: string): string {
  let lue: URL;
  try {
    lue = new URL(url);
  } catch {
    return FICHES[reseau].nom;
  }
  const segments = lue.pathname.split("/").filter(Boolean).map(decoder);
  const premier = segments[0] ?? "";
  const sansArobase = premier.replace(/^@/, "");

  const brut = ((): string => {
    switch (reseau) {
      case "instagram":
      case "tiktok":
      case "threads":
      case "x":
      case "figma":
      case "dribbble":
        return `@${sansArobase}`;
      case "behance":
      case "pinterest":
        return `/${premier}`;
      case "facebook":
        if (premier === "profile.php") return "Profil Facebook";
        if (premier === "people" && segments[1]) return segments[1].replace(/-/g, " ");
        return `/${premier}`;
      case "linkedin":
        return ["in", "company", "school", "showcase"].includes(premier) && segments[1]
          ? segments[1]
          : premier;
      case "youtube":
        if (premier.startsWith("@")) return premier;
        if (premier === "channel") return "Chaîne YouTube";
        return segments[1] ? `/${segments[1]}` : `/${premier}`;
      case "whatsapp": {
        const hote = lue.hostname.toLowerCase();
        if (hote === "chat.whatsapp.com") return "Groupe";
        if (premier === "channel") return "Chaîne";
        const numero = hote === "wa.me" ? premier : (lue.searchParams.get("phone") ?? "");
        return /^\d{8,15}$/.test(numero) ? `+${numero}` : "WhatsApp";
      }
    }
  })();

  return brut.length > 40 ? `${brut.slice(0, 39)}…` : brut;
}

/** Une adresse, si la saisie en a l'air — avec ou sans `https://`. */
function enAdresse(saisie: string): URL | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(saisie)) {
    try {
      return new URL(saisie);
    } catch {
      return null;
    }
  }
  // « instagram.com/awa » : un domaine suivi d'un chemin, sans protocole.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(saisie)) {
    try {
      return new URL(`https://${saisie}`);
    } catch {
      return null;
    }
  }
  return null;
}

function lirePseudo(reseau: Reseau, saisie: string): Lecture {
  const fiche = FICHES[reseau];
  const pseudo =
    reseau === "whatsapp"
      ? saisie.replace(/[\s().-]/g, "").replace(/^(\+|00)/, "")
      : saisie.replace(/^@/, "");

  if (!fiche.pseudo.test(pseudo)) {
    return {
      ok: false,
      message:
        reseau === "whatsapp"
          ? "Indique ton numéro avec l'indicatif du pays : +225 07 00 00 00 00."
          : `Ce pseudo ${fiche.nom} n'est pas valable. Tu peux aussi coller l'adresse de ta page.`,
    };
  }
  return { ok: true, url: fiche.adresse(pseudo) };
}

function surLeDomaine(hote: string, domaines: string[]): boolean {
  return domaines.some((d) => hote === d || hote.endsWith(`.${d}`));
}

function decoder(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
