import type { EnteteHttp } from "@/lib/securite/entetes";

/**
 * TDMRep — la réserve de fouille de données (« opt-out » de l'article 4).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUE ÇA DIT, ET À QUI
 *
 * L'article 4 de la directive européenne 2019/790 autorise la fouille de textes
 * et de données (donc l'entraînement d'IA) sur des œuvres licitement
 * accessibles — SAUF si l'ayant droit a réservé ce droit « de manière
 * appropriée », notamment par un procédé lisible par une machine. Le TDM
 * Reservation Protocol (W3C Community Group, 2024) est ce procédé : un signal
 * standard qui dit « ces œuvres ne sont pas offertes à la fouille ».
 *
 * Deux porteurs du même signal, parce qu'un robot lit l'un ou l'autre :
 *   — un fichier `/.well-known/tdmrep.json` (dans `public/`), qui couvre tout
 *     le site d'une réserve ;
 *   — un en-tête `tdm-reservation: 1` sur chaque réponse de Next.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUE ÇA N'EST PAS
 *
 * Une DÉCLARATION, pas une serrure — comme `robots.txt` et la réserve XMP des
 * aperçus. Un robot qui l'ignore n'est arrêté par rien. Sa valeur est double :
 * il protège vis-à-vis de qui respecte la règle, et il établit une réserve
 * explicite, opposable là où l'article 4 s'applique.
 *
 * Pas de `tdm-policy` : ce champ pointe vers une licence de fouille, et Baobart
 * n'en offre pas. Réserver sans proposer de licence est l'état le plus honnête
 * de notre position. Le jour où une licence existerait, elle s'ajouterait ici
 * et dans le fichier `.well-known`.
 */

/** Une seule réserve, pour tout le site. Lu par le test qui tient le fichier `.well-known` aligné. */
export function reservationTdm(): ReadonlyArray<{ location: string; "tdm-reservation": 0 | 1 }> {
  return [{ location: "/", "tdm-reservation": 1 }];
}

/** L'en-tête de réserve, posé sur toutes les réponses (voir `next.config.ts`). */
export function entetesTdm(): EnteteHttp[] {
  return [{ key: "tdm-reservation", value: "1" }];
}
