/**
 * Les limites qui protègent les compteurs des bannières.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX ESPÈCES DE LIMITES, ET UNE SEULE EMPÊCHE LE GONFLAGE
 *
 * Le DÉBIT — tant d'envois par minute et par adresse — ralentit un script. Il
 * ne l'arrête pas : à trente clics par minute, une nuit en fait quinze mille.
 * C'était la seule limite de v1.71.0, et le compte rendu le disait.
 *
 * Le PLAFOND — tant d'affichages ou de clics COMPTÉS par adresse, par pub et
 * par jour — l'arrête : passé un clic, les suivants de la même adresse sur la
 * même pub ne comptent plus jusqu'au lendemain. Le visiteur, lui, arrive
 * toujours à destination : on cesse de compter, on ne cesse pas de servir.
 *
 * Ce que ça ne règle pas : un script qui change d'adresse à chaque appel. Rien
 * de simple ne l'arrête, et rien ici ne prétend le faire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ADRESSE NE RESTE PAS EN CLAIR
 *
 * La clé du plafond vit vingt-six heures dans le compteur (Redis en
 * production). Elle porte une empreinte de l'adresse, calculée avec le secret
 * du site et le jour : on ne remonte pas à l'adresse sans le secret, et deux
 * jours ne se recoupent pas.
 *
 * L'empreinte se calcule dans `lib/publicites/plafond.ts`, côté serveur : ce
 * module-ci est lu par le formulaire, et n'a rien à faire de `node:crypto`.
 *
 * Réglables depuis l'écran des publicités (demandé le 03/10), dans des bornes :
 * une limite à zéro fermerait le comptage sans que personne comprenne pourquoi.
 */

export interface LimitesPub {
  /** Envois de vues par minute et par adresse. */
  vuesParMinute: number;
  /** Clics par minute et par adresse. */
  clicsParMinute: number;
  /** Affichages comptés par adresse, par pub et par jour. */
  vuesParVisiteurJour: number;
  /** Clics comptés par adresse, par pub et par jour. */
  clicsParVisiteurJour: number;
}

/** Les défauts du schéma — ceux de v1.71.0 pour le débit. */
export const LIMITES_PAR_DEFAUT: LimitesPub = {
  vuesParMinute: 120,
  clicsParMinute: 30,
  vuesParVisiteurJour: 20,
  clicsParVisiteurJour: 1,
};

export const BORNES: Record<keyof LimitesPub, readonly [number, number]> = {
  vuesParMinute: [10, 1000],
  clicsParMinute: [5, 300],
  vuesParVisiteurJour: [1, 500],
  clicsParVisiteurJour: [1, 50],
};

const LIBELLES: Record<keyof LimitesPub, string> = {
  vuesParMinute: "Les envois d'affichages par minute",
  clicsParMinute: "Les clics par minute",
  vuesParVisiteurJour: "Les affichages comptés par visiteur",
  clicsParVisiteurJour: "Les clics comptés par visiteur",
};

export type VerdictLimites =
  | { ok: true; limites: LimitesPub }
  | { ok: false; champ: keyof LimitesPub; message: string };

export function validerLimites(saisie: Record<keyof LimitesPub, string>): VerdictLimites {
  const limites = { ...LIMITES_PAR_DEFAUT };
  for (const champ of Object.keys(BORNES) as (keyof LimitesPub)[]) {
    const [min, max] = BORNES[champ];
    const brut = (saisie[champ] ?? "").trim();
    const n = /^\d{1,5}$/.test(brut) ? Number(brut) : Number.NaN;
    if (!(n >= min && n <= max)) {
      return { ok: false, champ, message: `${LIBELLES[champ]} vont de ${min} à ${max}.` };
    }
    limites[champ] = n;
  }
  return { ok: true, limites };
}

/** Une limite de débit à la minute, au format de `lib/securite/limites.ts`. */
export function parMinute(quota: number): { quota: number; fenetreMs: number } {
  return { quota, fenetreMs: 60_000 };
}
