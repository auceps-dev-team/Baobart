import { VERIFICATION_MS } from "@/lib/payments/eligibilite";
import { liensAffichables, portfolioAffichable } from "@/lib/reseaux/vitrine";

/**
 * Les trois étapes de « Devenir vendeur », sans base de données.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA RÈGLE DES TROIS ÉTAPES (maquette `Baobart Dashboard.dc.html`, page `vendeur`)
 *
 * 1. **Complète ton profil** — « Photo, bio, spécialités et liens vers ton
 *    portfolio. » (`Baobart Dashboard.dc.html:1548`).
 *    Une étape « faite » exige les quatre : une photo (`avatarUrl`), une bio
 *    (`bio`), une spécialité (`speciality`) **et** au moins un réseau ou un
 *    portfolio que la vitrine publique accepte d'afficher (`portfolioAffichable`
 *    ou `liensAffichables`, `lib/reseaux/vitrine.ts`).
 *    Le bouton mène à `/dashboard/boutique` tant que la spécialité ou les liens
 *    manquent (car ces champs vivent dans la disposition « boutique »), et à
 *    `/dashboard/profil` lorsqu'il ne manque que la photo ou la bio.
 *
 * 2. **Ajoute un moyen de versement** — « Wave, Orange Money ou virement
 *    bancaire. » (`Baobart Dashboard.dc.html:1549`).
 *    Un `PayoutAccount` actif (`deletedAt === null`) marque l'étape comme faite.
 *    Ce qui retient réellement un premier versement dans le code est le délai de
 *    24 h après `PayoutAccount.createdAt` (`VERIFICATION_MS`, `lib/payments/eligibilite.ts:88` ;
 *    aucun code n'écrit `PayoutAccount.verifiedAt`, vérifié le 08/11 et le 09/11/2026).
 *    Pendant ces 24 h, l'étape indique « Faite, utilisable le … » avec la date
 *    et l'heure de fin du délai ; au-delà de 24 h, elle est « Faite » sans autre
 *    mention.
 *
 * 3. **Publie 3 ressources** — nombre de `Product` du compte au statut
 *    `PUBLISHED`. Tant que l'objectif de 3 ressources publiées n'est pas
 *    atteint, l'avancement affiche « N / 3 » (« 0 / 3 », « 1 / 3 », « 2 / 3 »).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ÉCARTS AVEC LA MAQUETTE (vérifiés dans le code le 08/11/2026)
 *
 * - **Pas de « validation sous 72 h »** : la maquette annonce « Nos curateurs
 *   valident sous 72 h et ta boutique s'ouvre » (`Baobart Dashboard.dc.html:1550`).
 *   En réalité, `publierProduit` (`lib/products/actions.ts:240`) passe la
 *   ressource directement à `PUBLISHED` sans relecture préalable. Promettre une
 *   validation par des curateurs sous 72 h serait faux.
 */

export interface FaitsVendeur {
  profil: {
    avatarUrl: string | null;
    bio: string | null;
    speciality: string | null;
    portfolioUrl: string | null;
    liens: ReadonlyArray<{ network: string; url: string }>;
  } | null;
  versement: {
    enregistreLe: Date | null;
  };
  ressourcesPubliees: number;
  maintenant?: Date;
}

export type CleEtapeVendeur = "profil" | "versement" | "ressources";

export interface EtapeVendeur {
  cle: CleEtapeVendeur;
  numero: 1 | 2 | 3;
  titre: string;
  texte: string;
  faite: boolean;
  /** Vrai pendant les 24 h (`VERIFICATION_MS`) qui suivent l'enregistrement du compte de versement. */
  enAttente: boolean;
  detail: string;
  action: {
    libelle: string;
    href: "/dashboard/profil" | "/dashboard/boutique" | "/dashboard/versements" | "/dashboard/produits/nouveau";
  };
}

export interface ProgressionVendeur {
  etapes: [EtapeVendeur, EtapeVendeur, EtapeVendeur];
  faites: number;
  total: 3;
}

const OBJECTIF_RESSOURCES = 3;

function rempli(valeur: string | null | undefined): boolean {
  return Boolean(valeur && valeur.trim().length > 0);
}

function formaterEcheance(date: Date): string {
  const d = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  const h = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
  return `${d} à ${h}`;
}

function evaluerProfil(profil: FaitsVendeur["profil"]): {
  faite: boolean;
  detail: string;
  href: "/dashboard/profil" | "/dashboard/boutique";
} {
  const aPhoto = rempli(profil?.avatarUrl);
  const aBio = rempli(profil?.bio);
  const aSpecialite = rempli(profil?.speciality);
  const portfolioBrut = profil?.portfolioUrl?.trim() ?? "";
  const aPortfolioValide = portfolioAffichable(portfolioBrut || null) !== null;
  const aLienReseauValide = profil ? liensAffichables(profil.liens).length > 0 : false;
  const aLienOuPortfolio = aPortfolioValide || aLienReseauValide;

  const href: "/dashboard/profil" | "/dashboard/boutique" =
    !aSpecialite || !aLienOuPortfolio ? "/dashboard/boutique" : "/dashboard/profil";

  if (aPhoto && aBio && aSpecialite && !aLienOuPortfolio && portfolioBrut.length > 0 && !aPortfolioValide) {
    return {
      faite: false,
      detail: "Ton portfolio doit commencer par https://",
      href,
    };
  }

  const manquants: string[] = [];
  if (!aPhoto) manquants.push("photo");
  if (!aBio) manquants.push("bio");
  if (!aSpecialite) manquants.push("spécialité");
  if (!aLienOuPortfolio) manquants.push("lien ou portfolio");

  if (manquants.length === 0) {
    return { faite: true, detail: "Profil complet", href };
  }
  return {
    faite: false,
    detail: `À compléter : ${manquants.join(", ")}`,
    href,
  };
}

function evaluerVersement(
  versement: FaitsVendeur["versement"],
  maintenant: Date,
): {
  faite: boolean;
  enAttente: boolean;
  detail: string;
} {
  if (!versement.enregistreLe) {
    return {
      faite: false,
      enAttente: false,
      detail: "Aucun moyen configuré",
    };
  }
  const age = maintenant.getTime() - versement.enregistreLe.getTime();
  if (age < VERIFICATION_MS) {
    const utilisableLe = new Date(versement.enregistreLe.getTime() + VERIFICATION_MS);
    return {
      faite: true,
      enAttente: true,
      detail: `Faite, utilisable le ${formaterEcheance(utilisableLe)}`,
    };
  }
  return {
    faite: true,
    enAttente: false,
    detail: "Faite",
  };
}

function evaluerRessources(publiees: number): { faite: boolean; detail: string } {
  const n = Math.max(0, Math.floor(publiees));
  if (n >= OBJECTIF_RESSOURCES) {
    return {
      faite: true,
      detail: `${n} / ${OBJECTIF_RESSOURCES} · objectif atteint`,
    };
  }
  return {
    faite: false,
    detail: `${n} / ${OBJECTIF_RESSOURCES}`,
  };
}

export function etapesVendeur(faits: FaitsVendeur): ProgressionVendeur {
  const maintenant = faits.maintenant ?? new Date();
  const profil = evaluerProfil(faits.profil);
  const versement = evaluerVersement(faits.versement, maintenant);
  const ressources = evaluerRessources(faits.ressourcesPubliees);

  const etapes: [EtapeVendeur, EtapeVendeur, EtapeVendeur] = [
    {
      cle: "profil",
      numero: 1,
      titre: "Complète ton profil",
      texte: "Photo, bio, spécialités et liens vers ton portfolio.",
      faite: profil.faite,
      enAttente: false,
      detail: profil.detail,
      action: {
        libelle: "Compléter",
        href: profil.href,
      },
    },
    {
      cle: "versement",
      numero: 2,
      titre: "Ajoute un moyen de versement",
      texte: "Wave, Orange Money ou virement bancaire.",
      faite: versement.faite,
      enAttente: versement.enAttente,
      detail: versement.detail,
      action: {
        libelle: "Configurer",
        href: "/dashboard/versements",
      },
    },
    {
      cle: "ressources",
      numero: 3,
      titre: "Publie 3 ressources",
      // Écart volontaire avec la maquette (« Nos curateurs valident sous 72 h
      // et ta boutique s'ouvre ») : la publication est immédiate dans le code
      // (`lib/products/actions.ts:240`).
      texte: "Tes ressources paraissent dès leur publication et ouvrent ta vitrine publique.",
      faite: ressources.faite,
      enAttente: false,
      detail: ressources.detail,
      action: {
        libelle: "Publier",
        href: "/dashboard/produits/nouveau",
      },
    },
  ];

  const faites = etapes.filter((e) => e.faite).length;

  return {
    etapes,
    faites,
    total: 3,
  };
}
