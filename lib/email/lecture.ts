import "server-only";

import { db } from "@/lib/db";
import { piloteCourant, type NomPilote } from "@/lib/email/pilotes";
import { RECLAMATION_PERIMEE_MS, TENTATIVES_MAX } from "@/lib/email/reprise";
import {
  compteurs,
  graviteLigne,
  type Compteur,
  type FaitsFile,
  type StatutFile,
} from "@/lib/email/supervision";
import { graviteGlobale, type Gravite } from "@/lib/systeme/diagnostic";

/**
 * Ce que l'écran de supervision lit.
 *
 * Les règles vivent dans `supervision.ts` et ne savent pas d'où viennent les
 * nombres ; ici on ne fait que compter. La séparation permet d'éprouver « une
 * file figée depuis six heures est une panne » sans base de données.
 */

export const FILTRES = [
  "Tous",
  "En attente",
  "En cours",
  "Envoyés",
  "Échoués",
] as const;

export type Filtre = (typeof FILTRES)[number];

const STATUTS_PAR_FILTRE: Record<Filtre, StatutFile[] | null> = {
  Tous: null,
  "En attente": ["PENDING"],
  "En cours": ["SENDING"],
  Envoyés: ["SENT"],
  // Abandonné n'est pas un échec — c'est une décision — mais les deux se
  // regardent ensemble : ce sont les lignes qui ne partiront plus seules.
  Échoués: ["FAILED", "ABANDONED"],
};

export function filtreValide(brut: string | undefined): Filtre {
  return FILTRES.includes(brut as Filtre) ? (brut as Filtre) : "Tous";
}

export interface LigneFile {
  id: string;
  creeLe: Date;
  modele: string;
  destinataire: string;
  statut: StatutFile;
  libelleStatut: string;
  tentatives: string;
  prochaine: Date | null;
  derniereErreur: string | null;
  gravite: Gravite;
  /** Les actions ne s'affichent que là où elles ont un sens. */
  relancable: boolean;
  abandonnable: boolean;
}

export interface VueFile {
  pilote: NomPilote;
  compteurs: Compteur[];
  gravite: Gravite;
  lignes: LigneFile[];
  /** Total après filtre, pour distinguer « rien » de « rien de ce genre ». */
  total: number;
  totalGeneral: number;
  echecs: number;
}

const PAGE = 30;

export async function vueDeLaFile(filtre: Filtre = "Tous"): Promise<VueFile> {
  const maintenant = Date.now();
  const statuts = STATUTS_PAR_FILTRE[filtre];
  const ou = statuts ? { status: { in: statuts } } : {};

  const [enAttente, envoyes24h, echecs, plusAncien, total, totalGeneral, brutes] =
    await Promise.all([
      db.emailOutbox.count({ where: { status: "PENDING" } }),
      db.emailOutbox.count({
        where: { status: "SENT", sentAt: { gte: new Date(maintenant - 86_400_000) } },
      }),
      db.emailOutbox.count({ where: { status: "FAILED" } }),
      db.emailOutbox.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      db.emailOutbox.count({ where: ou }),
      db.emailOutbox.count(),
      db.emailOutbox.findMany({
        where: ou,
        orderBy: { createdAt: "desc" },
        take: PAGE,
        // La charge utile est absente de cette sélection, et ce n'est pas un
        // oubli : elle porte des liens de téléchargement personnels et des
        // liens de réinitialisation. Une capture d'écran d'incident circule.
        select: {
          id: true,
          createdAt: true,
          template: true,
          recipient: true,
          status: true,
          attempts: true,
          nextAttemptAt: true,
          claimedAt: true,
          lastError: true,
        },
      }),
    ]);

  const faits: FaitsFile = {
    enAttente,
    envoyes24h,
    echecs,
    agePlusAncienMs: plusAncien
      ? maintenant - plusAncien.createdAt.getTime()
      : null,
  };

  const liste = compteurs(faits);

  const lignes: LigneFile[] = brutes.map((l) => {
    const statut = l.status as StatutFile;
    const reclameDepuisMs = l.claimedAt
      ? maintenant - l.claimedAt.getTime()
      : null;

    return {
      id: l.id,
      creeLe: l.createdAt,
      modele: l.template,
      destinataire: l.recipient,
      statut,
      libelleStatut:
        statut === "SENDING" &&
        reclameDepuisMs !== null &&
        reclameDepuisMs >= RECLAMATION_PERIMEE_MS
          ? "EN COURS (bloqué)"
          : LIBELLES[statut],
      tentatives: `${l.attempts} / ${TENTATIVES_MAX}`,
      // Une prochaine tentative n'a de sens que pour ce qui va repartir.
      prochaine: statut === "PENDING" ? l.nextAttemptAt : null,
      derniereErreur: l.lastError,
      gravite: graviteLigne({ statut, reclameDepuisMs }),
      relancable: statut === "FAILED",
      abandonnable: statut === "FAILED" || statut === "PENDING",
    };
  });

  return {
    pilote: piloteCourant().nom,
    compteurs: liste,
    gravite: graviteGlobale(
      liste.map((c) => ({ cle: c.cle, libelle: c.libelle, gravite: c.gravite, detail: "" })),
    ),
    lignes,
    total,
    totalGeneral,
    echecs,
  };
}

const LIBELLES: Record<StatutFile, string> = {
  PENDING: "EN ATTENTE",
  SENDING: "EN COURS",
  SENT: "ENVOYÉ",
  FAILED: "ÉCHOUÉ",
  ABANDONED: "ABANDONNÉ",
};
