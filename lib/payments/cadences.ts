/**
 * Les cadences de versement proposées.
 *
 * Pur, et séparé de `configuration.ts` pour une raison précise : le formulaire
 * qui les affiche est un composant client, et `configuration.ts` est marqué
 * `server-only`. Une liste de choix n'a rien de secret — elle peut traverser.
 *
 * Libellés et explications repris de `Baobart Design/Baobart Dashboard.dc.html`
 * (`CADENCES`), qui fait foi.
 */

export const CADENCES = [
  {
    code: "WEEKLY",
    libelle: "Chaque semaine",
    aide:
      "Le versement part dès que le solde disponible dépasse le seuil. C'est le " +
      "rythme le plus court, mais chaque virement bancaire est facturé par la banque.",
  },
  {
    code: "MONTHLY",
    libelle: "Chaque mois",
    aide:
      "Un seul versement, le premier jour de versement du mois. Le rythme par " +
      "défaut, celui qui coûte le moins en frais.",
  },
  {
    code: "QUARTERLY",
    libelle: "Chaque trimestre",
    aide:
      "Trois mois d'accumulation avant le départ. Utile si tu vends peu et que " +
      "tu ne veux pas multiplier les lignes de compte.",
  },
] as const;

export type CodeCadence = (typeof CADENCES)[number]["code"];

/** Ce qu'un compte reçoit tant que personne n'a choisi. */
export const CADENCE_PAR_DEFAUT: CodeCadence = "MONTHLY";

/**
 * Aucune valeur libre n'est acceptée : la liste vient du code.
 *
 * `DAILY` existe au schéma mais aucun cycle ne le sert. L'offrir promettrait un
 * versement le lendemain que rien ne déclencherait.
 */
export function cadenceValide(brut: string | undefined): CodeCadence | null {
  return CADENCES.some((c) => c.code === brut) ? (brut as CodeCadence) : null;
}

/**
 * Les moyens de versement, tels que la maquette les présente.
 *
 * Chaque moyen porte son terrain et son jour : le vendeur choisit en sachant
 * quand il sera payé, pas seulement par qui. Le libellé du champ change aussi —
 * demander un « identifiant » pour un numéro Wave fait hésiter.
 */
export const MOYENS_VERSEMENT = [
  {
    code: "bank",
    label: "Virement bancaire",
    terrain: "Zone UEMOA",
    jour: "lundi",
    champ: "IBAN ou numéro de compte",
    exemple: "SN08 SN01 0015 2000 0482 1000 0000",
  },
  {
    code: "wave",
    label: "Wave",
    terrain: "Sénégal, Côte d'Ivoire",
    jour: "mardi",
    champ: "Numéro Wave",
    exemple: "+221 77 000 00 00",
  },
  {
    code: "mtn",
    label: "MTN MoMo",
    terrain: "Ghana, Cameroun, Côte d'Ivoire",
    jour: "mercredi",
    champ: "Numéro MTN MoMo",
    exemple: "+233 24 000 0000",
  },
  {
    code: "om",
    label: "Orange Money",
    terrain: "Sénégal, Mali, Guinée",
    jour: "jeudi",
    champ: "Numéro Orange Money",
    exemple: "+223 70 00 00 00",
  },
  {
    code: "moov",
    label: "Moov Money",
    terrain: "Bénin, Togo, Burkina",
    jour: "vendredi",
    champ: "Numéro Moov Money",
    exemple: "+228 90 00 00 00",
  },
] as const;

export type CodeMoyen = (typeof MOYENS_VERSEMENT)[number]["code"];

export function moyenDe(code: string) {
  return MOYENS_VERSEMENT.find((m) => m.code === code) ?? null;
}
