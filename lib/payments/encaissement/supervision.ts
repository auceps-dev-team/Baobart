import type { Constat, Gravite } from "@/lib/systeme/diagnostic";

/**
 * Ce qu'on veut savoir des paiements quand on est réveillé la nuit.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TROIS PANNES, ET CE QU'ELLES DISENT
 *
 * **Des appels refusés.** Presque toujours un secret mal recopié, ou tourné
 * chez l'opérateur sans être tourné chez nous. Le symptôme est traître : rien
 * ne casse côté acheteur — les commandes restent simplement en attente pour
 * l'éternité, et personne n'est crédité. C'est le constat qu'on veut voir en
 * premier.
 *
 * **Des commandes bloquées.** Ouvertes, jamais rappelées. Soit l'opérateur ne
 * nous joint pas — pare-feu, URL de rappel mal déclarée —, soit les acheteurs
 * abandonnent en masse, ce qui est une information commerciale et non une
 * panne. Le nombre tranche : un ou deux, c'est la vie ; trente, c'est un tuyau
 * coupé.
 *
 * **Des montants discordants.** Rare, et grave. Soit quelqu'un forge des
 * rappels, soit on reçoit ceux d'un autre marchand. Dans les deux cas rien n'a
 * été crédité — la chaîne a fait son travail —, mais il faut regarder.
 *
 * Module pur : il reçoit des nombres déjà comptés. C'est ce qui permet
 * d'éprouver « douze refus en une heure est une panne » sans base de données.
 */

/** Un seul refus est déjà une question. Au-delà, c'est une panne. */
export const REFUS_INQUIETANT = 1;
export const REFUS_GRAVE = 5;

/** Passé ce délai, une commande ouverte n'attend plus personne. */
export const BLOCAGE_MS = 30 * 60_000;

/** En dessous, l'abandon d'acheteurs explique tout. */
export const BLOQUEES_INQUIETANT = 5;
export const BLOQUEES_GRAVE = 20;

export interface FaitsEncaissement {
  /** Le pilote actif, ou `null` si aucun opérateur n'est branché. */
  pilote: string | null;
  /** Appels refusés dans la dernière heure. */
  refusRecents: number;
  /** Rappels au montant ou à la devise discordants, dernière heure. */
  discordancesRecentes: number;
  /** Commandes ouvertes depuis plus de `BLOCAGE_MS`. */
  bloquees: number;
  /** Rappels traités dans les dernières 24 h. */
  traites24h: number;
}

function pire(a: Gravite, b: Gravite): Gravite {
  if (a === "panne" || b === "panne") return "panne";
  if (a === "attention" || b === "attention") return "attention";
  return "ok";
}

export function constatOperateur(faits: FaitsEncaissement): Constat {
  if (!faits.pilote) {
    return {
      cle: "operateur",
      libelle: "Opérateur",
      gravite: "panne",
      detail: "Aucun opérateur branché — aucun achat payant n'est possible.",
      remede:
        "Renseigne PAYMENTS_DRIVER, et le secret que ce pilote exige. Le tunnel d'achat refuse franchement en attendant.",
    };
  }

  return {
    cle: "operateur",
    libelle: "Opérateur",
    gravite: "ok",
    detail: `${faits.pilote} · ${faits.traites24h} rappel(s) traité(s) en 24 h.`,
  };
}

export function constatRefus(faits: FaitsEncaissement): Constat {
  if (faits.refusRecents >= REFUS_GRAVE) {
    return {
      cle: "refus",
      libelle: "Appels refusés",
      gravite: "panne",
      detail: `${faits.refusRecents} appels refusés dans la dernière heure.`,
      // La panne la plus fréquente d'une intégration, et la plus silencieuse :
      // rien ne casse côté acheteur, les commandes restent juste en attente.
      remede:
        "Compare le secret de signature avec celui déclaré chez l'opérateur. Un secret tourné d'un seul côté produit exactement cela.",
    };
  }

  if (faits.refusRecents >= REFUS_INQUIETANT) {
    return {
      cle: "refus",
      libelle: "Appels refusés",
      gravite: "attention",
      detail: `${faits.refusRecents} appel(s) refusé(s) dans la dernière heure.`,
      remede:
        "Regarde le corps reçu : un tâtonnement isolé n'a rien d'alarmant, une série signale un secret décalé.",
    };
  }

  return {
    cle: "refus",
    libelle: "Appels refusés",
    gravite: "ok",
    detail: "Aucun sur la dernière heure.",
  };
}

export function constatDiscordances(faits: FaitsEncaissement): Constat {
  if (faits.discordancesRecentes > 0) {
    return {
      cle: "discordances",
      libelle: "Montants discordants",
      gravite: "panne",
      detail: `${faits.discordancesRecentes} rappel(s) annonçant un montant ou une devise qui n'est pas le nôtre.`,
      remede:
        "Rien n'a été crédité. Ouvre les corps reçus : soit ils sont forgés, soit l'opérateur nous adresse les rappels d'un autre marchand.",
    };
  }

  return {
    cle: "discordances",
    libelle: "Montants discordants",
    gravite: "ok",
    detail: "Aucun.",
  };
}

export function constatBloquees(faits: FaitsEncaissement): Constat {
  if (faits.bloquees >= BLOQUEES_GRAVE) {
    return {
      cle: "bloquees",
      libelle: "Commandes en attente",
      gravite: "panne",
      detail: `${faits.bloquees} commandes ouvertes depuis plus de trente minutes.`,
      remede:
        "L'opérateur ne nous joint probablement pas. Vérifie l'URL de rappel déclarée chez lui, et qu'elle est atteignable depuis l'extérieur.",
    };
  }

  if (faits.bloquees >= BLOQUEES_INQUIETANT) {
    return {
      cle: "bloquees",
      libelle: "Commandes en attente",
      gravite: "attention",
      detail: `${faits.bloquees} commandes ouvertes depuis plus de trente minutes.`,
      remede:
        "Des acheteurs abandonnent, ou les rappels n'arrivent plus. Croise avec le nombre d'appels reçus.",
    };
  }

  return {
    cle: "bloquees",
    libelle: "Commandes en attente",
    gravite: "ok",
    detail:
      faits.bloquees === 0
        ? "Aucune."
        : `${faits.bloquees} — dans la normale des abandons.`,
  };
}

export function constatsEncaissement(faits: FaitsEncaissement): Constat[] {
  return [
    constatOperateur(faits),
    constatRefus(faits),
    constatDiscordances(faits),
    constatBloquees(faits),
  ];
}

/** Le pire l'emporte : un bandeau vert au-dessus d'une panne ne sert personne. */
export function graviteEncaissement(faits: FaitsEncaissement): Gravite {
  return constatsEncaissement(faits)
    .map((c) => c.gravite)
    .reduce(pire, "ok" as Gravite);
}

export type StatutRappel = "RECEIVED" | "PROCESSED" | "IGNORED" | "REJECTED";

export const LIBELLE_RAPPEL: Record<StatutRappel, string> = {
  RECEIVED: "REÇU",
  PROCESSED: "TRAITÉ",
  IGNORED: "SANS EFFET",
  REJECTED: "REFUSÉ",
};

/**
 * La gravité d'une ligne.
 *
 * « Sans effet » n'est pas une anomalie : c'est le cas nominal d'un rejeu, et
 * un opérateur qui rejoue fait son travail. Le peindre en orange apprendrait à
 * ignorer l'orange.
 */
export function graviteRappel(statut: StatutRappel): Gravite {
  if (statut === "REJECTED") return "panne";
  // Reçu mais jamais traité : le traitement est tombé au milieu.
  if (statut === "RECEIVED") return "attention";
  return "ok";
}
