import type { Gravite } from "@/lib/systeme/diagnostic";

/**
 * Lire l'état de la file et dire ce qui mérite un geste.
 *
 * Pur : ces règles reçoivent des nombres déjà comptés. Ce sont elles qui
 * décident qu'une file de trois messages figée depuis six heures est plus grave
 * qu'une file de cent qui s'écoule — et cette décision-là mérite d'être
 * éprouvée sans base de données.
 */

/** Au-delà, la file s'accumule plus vite qu'elle ne s'écoule. */
export const SEUIL_ATTENTE = 25;

/**
 * Deux paliers pour l'âge du plus ancien message.
 *
 * Une demi-heure suffit à faire douter quelqu'un qui attend son lien de
 * réinitialisation ; une heure signifie que plus rien ne part.
 */
export const AGE_INQUIETANT_MS = 30 * 60_000;
export const AGE_GRAVE_MS = 60 * 60_000;

export interface FaitsFile {
  enAttente: number;
  envoyes24h: number;
  /** Échecs définitifs : la machine a renoncé, un humain doit trancher. */
  echecs: number;
  /** Âge du plus ancien message en attente, ou `null` si la file est vide. */
  agePlusAncienMs: number | null;
}

export interface Compteur {
  cle: string;
  libelle: string;
  valeur: string;
  note: string;
  gravite: Gravite;
}

/** « 43 min », « 2 h 10 », « 3 j » — jamais « 2580000 ms ». */
export function dureeLisible(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "moins d'une minute";
  if (minutes < 60) return `${minutes} min`;

  const heures = Math.floor(minutes / 60);
  if (heures < 24) {
    const reste = minutes % 60;
    return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, "0")}`;
  }

  const jours = Math.floor(heures / 24);
  return jours === 1 ? "1 jour" : `${jours} jours`;
}

function compteurAge(ms: number | null): Compteur {
  const base = { cle: "age", libelle: "Âge du plus ancien en attente" };

  if (ms === null) {
    return { ...base, valeur: "—", note: "la file est vide", gravite: "ok" };
  }

  if (ms >= AGE_GRAVE_MS) {
    return {
      ...base,
      valeur: dureeLisible(ms),
      note: "au-delà d'une heure : plus rien ne part",
      gravite: "panne",
    };
  }

  if (ms >= AGE_INQUIETANT_MS) {
    return {
      ...base,
      valeur: dureeLisible(ms),
      note: "sous une heure, mais à surveiller",
      gravite: "attention",
    };
  }

  return {
    ...base,
    valeur: dureeLisible(ms),
    note: "la file s'écoule",
    gravite: "ok",
  };
}

/**
 * Les quatre chiffres de tête.
 *
 * Le dernier est le plus important et le moins évident. Une file qui grossit se
 * voit — le nombre en attente monte. Une file **figée** ne se voit pas : elle
 * peut rester à trois messages pendant six heures sans que le chiffre bouge.
 * C'est l'âge du plus ancien qui la trahit.
 */
export function compteurs(faits: FaitsFile): Compteur[] {
  return [
    {
      cle: "attente",
      libelle: "En attente",
      valeur: String(faits.enAttente),
      note:
        faits.enAttente >= SEUIL_ATTENTE
          ? `au-dessus du seuil de ${SEUIL_ATTENTE}`
          : `sous le seuil de ${SEUIL_ATTENTE}`,
      gravite: faits.enAttente >= SEUIL_ATTENTE ? "attention" : "ok",
    },
    {
      cle: "envoyes",
      libelle: "Envoyés (24 h)",
      valeur: String(faits.envoyes24h),
      // Un volume élevé n'est pas un problème : c'est le service qui marche.
      note: "jamais alarmant",
      gravite: "ok",
    },
    {
      cle: "echecs",
      libelle: "En échec définitif",
      valeur: String(faits.echecs),
      note:
        faits.echecs > 0
          ? "à relancer ou à abandonner"
          : "rien à reprendre",
      gravite: faits.echecs > 0 ? "panne" : "ok",
    },
    compteurAge(faits.agePlusAncienMs),
  ];
}

export type StatutFile =
  | "PENDING"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "ABANDONED";

export const LIBELLE_STATUT: Record<StatutFile, string> = {
  PENDING: "EN ATTENTE",
  SENDING: "EN COURS",
  SENT: "ENVOYÉ",
  FAILED: "ÉCHOUÉ",
  ABANDONED: "ABANDONNÉ",
};

/**
 * La gravité d'une ligne.
 *
 * `SENDING` est le cas qui demande de la nuance : fraîchement réclamé, c'est
 * l'état normal d'un message en cours d'envoi ; réclamé depuis une demi-heure,
 * c'est un processus mort au milieu du gué. Le même statut, deux lectures — le
 * temps écoulé les sépare.
 */
export function graviteLigne(input: {
  statut: StatutFile;
  reclameDepuisMs: number | null;
}): Gravite {
  switch (input.statut) {
    case "FAILED":
      return "panne";
    case "SENDING":
      return input.reclameDepuisMs !== null &&
        input.reclameDepuisMs >= AGE_INQUIETANT_MS
        ? "panne"
        : "attention";
    default:
      return "ok";
  }
}
