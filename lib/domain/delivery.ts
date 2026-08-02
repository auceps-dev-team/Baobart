/**
 * Livraison des fichiers achetés.
 *
 * Traduit `app/helpers/signed_url_helper.rb`, `app/models/url_redirect.rb` et
 * `app/models/consumption_event.rb` (antiwork/gumroad, MIT, lus comme
 * spécification), croisés avec les quotas du PLAN §2.3 et §13.
 *
 * Deux décisions vivent ici, et aucune ne touche au réseau :
 *   1. **combien de temps** une URL signée reste valide ;
 *   2. **qui a le droit** de télécharger, et si ça consomme un quota.
 */

/**
 * Types de consommation. Gumroad en distingue **sept**, là où le §3.9-D du plan
 * n'en voyait que trois. La distinction compte pour les compteurs : télécharger
 * un dossier entier n'est pas la même chose que télécharger un fichier, et
 * écouter n'est pas lire.
 */
export type ConsumptionType =
  | "DOWNLOAD"
  | "DOWNLOAD_ALL"
  | "FOLDER_DOWNLOAD"
  | "LISTEN"
  | "READ"
  | "VIEW"
  | "WATCH";

// ───────────────────────────────────────── durée de validité des URL ────────

export interface UrlValidityConfig {
  /** Plancher, en secondes. */
  minimum: number;
  /** Plafond, en secondes. Au-delà, l'URL devient une fuite. */
  maximum: number;
  /** Durée fixe pour les vidéos, qu'on regarde en flux. */
  video: number;
  /**
   * Débit supposé, en octets par seconde, pour estimer la durée d'un
   * téléchargement.
   */
  assumedBytesPerSecond: number;
}

/**
 * ⚠️ LE CHIFFRE QUI COMPTE : `assumedBytesPerSecond`.
 *
 * Gumroad suppose ~51 200 o/s (50 Kio/s) et plafonne à 3 heures. Sur une
 * connexion mobile ouest-africaine, cette hypothèse est optimiste : l'URL
 * expirerait **au milieu du téléchargement**, et le créateur recevrait un
 * message d'acheteur furieux pour un fichier qu'il a bien payé.
 *
 * On retient 12 800 o/s (≈ 100 kbit/s), un plancher 3G réaliste, et on relève
 * le plafond à 6 heures en conséquence. Le compromis est explicite : une URL
 * qui vit plus longtemps est une URL qui peut être partagée plus longtemps.
 * C'est un arbitrage assumé en faveur de l'acheteur qui a payé.
 */
export const VALIDITE_PAR_DEFAUT: UrlValidityConfig = {
  minimum: 10 * 60, // 10 minutes
  maximum: 6 * 60 * 60, // 6 heures
  video: 12 * 60 * 60, // 12 heures
  assumedBytesPerSecond: 12_800,
};

/**
 * Durée de validité d'une URL signée, en secondes.
 *
 * Elle dépend de la **taille du fichier** : un pack de 200 Mo ne se télécharge
 * pas dans le temps d'une image. Une durée fixe condamnerait soit les gros
 * fichiers, soit la sécurité des petits.
 */
export function dureeUrlSignee(
  sizeBytes: number,
  options: { isVideo?: boolean; config?: UrlValidityConfig } = {},
): number {
  const { isVideo = false, config = VALIDITE_PAR_DEFAUT } = options;

  if (isVideo) return config.video;

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return config.minimum;

  const estimation = Math.ceil(sizeBytes / config.assumedBytesPerSecond);
  return Math.min(Math.max(estimation, config.minimum), config.maximum);
}

// ───────────────────────────────────────────── droit de télécharger ─────────

export type SourceAcces =
  /** Achat à l'unité : ne consomme jamais de quota (PLAN §13). */
  | "ACHAT"
  /** Téléchargement au titre d'un abonnement : soumis au quota mensuel. */
  | "ABONNEMENT";

export type RefusAcces =
  | "COMMANDE_NON_PAYEE"
  | "REMBOURSE"
  | "ABONNEMENT_INACTIF"
  | "ACCES_EXPIRE"
  | "QUOTA_EPUISE";

export interface AccesInput {
  source: SourceAcces;
  /** L'achat a-t-il abouti ? (`SUCCESSFUL` ou `NOT_CHARGED` pour le gratuit) */
  achatAbouti: boolean;
  /** Remboursement INTÉGRAL. Un remboursement partiel ne retire pas l'accès. */
  rembourseIntegralement?: boolean;
  /** Pour un produit à abonnement : l'abonnement est-il encore actif ? */
  abonnementActif?: boolean;
  /** Fin d'accès éventuelle (location, accès limité dans le temps). */
  accesExpireLe?: Date | null;
  /**
   * Ce fichier a-t-il déjà été téléchargé par cette personne ?
   * Un re-téléchargement ne reconsomme jamais de quota — sinon on ferait payer
   * deux fois une connexion coupée en cours de route.
   */
  dejaTelecharge?: boolean;
  /** Quota mensuel. `limite: null` = illimité (palier Studio). */
  quota?: { utilises: number; limite: number | null } | null;
  now?: Date;
}

export type DecisionAcces =
  | { autorise: true; consommeQuota: boolean }
  | { autorise: false; raison: RefusAcces };

/**
 * Décide si cette personne peut télécharger ce fichier, et si l'opération
 * doit décompter un téléchargement de son quota mensuel.
 *
 * L'ordre des refus n'est pas arbitraire : on répond d'abord ce qui relève du
 * paiement, ensuite ce qui relève du droit d'accès, et le quota en dernier —
 * pour que le message affiché soit celui que l'acheteur peut corriger.
 */
export function decideAcces(input: AccesInput): DecisionAcces {
  const {
    source,
    achatAbouti,
    rembourseIntegralement = false,
    abonnementActif = true,
    accesExpireLe = null,
    dejaTelecharge = false,
    quota = null,
    now = new Date(),
  } = input;

  if (!achatAbouti) {
    return { autorise: false, raison: "COMMANDE_NON_PAYEE" };
  }

  if (rembourseIntegralement) {
    return { autorise: false, raison: "REMBOURSE" };
  }

  if (!abonnementActif) {
    return { autorise: false, raison: "ABONNEMENT_INACTIF" };
  }

  if (accesExpireLe && accesExpireLe.getTime() <= now.getTime()) {
    return { autorise: false, raison: "ACCES_EXPIRE" };
  }

  // Un achat à l'unité donne un droit permanent : il ne touche pas au quota,
  // ni en le consommant, ni en s'y heurtant.
  if (source === "ACHAT") {
    return { autorise: true, consommeQuota: false };
  }

  // Re-téléchargement : le droit est déjà acquis.
  if (dejaTelecharge) {
    return { autorise: true, consommeQuota: false };
  }

  // Illimité, ou pas de quota défini.
  if (!quota || quota.limite === null) {
    return { autorise: true, consommeQuota: false };
  }

  if (quota.utilises >= quota.limite) {
    return { autorise: false, raison: "QUOTA_EPUISE" };
  }

  return { autorise: true, consommeQuota: true };
}

/** Période de quota, au format « AAAA-MM » (clé de `DownloadQuota`). */
export function periodeQuota(date: Date = new Date()): string {
  const annee = date.getUTCFullYear();
  const mois = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${annee}-${mois}`;
}

// ──────────────────────────────────────────────────── plateforme ────────────

export type Plateforme = "ANDROID" | "IPHONE" | "AUTRE";

/**
 * Plateforme déduite du user-agent, pour l'analytique de consommation.
 * Volontairement grossière : on veut savoir si l'usage est mobile, pas
 * identifier un appareil.
 */
export function plateformeDepuisUserAgent(userAgent?: string | null): Plateforme {
  if (!userAgent) return "AUTRE";
  if (/android/i.test(userAgent)) return "ANDROID";
  if (/iphone|ipad|ios/i.test(userAgent)) return "IPHONE";
  return "AUTRE";
}
