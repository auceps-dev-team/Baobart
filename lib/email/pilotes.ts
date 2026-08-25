import { journal } from "@/lib/observabilite/journal";
import type { Message } from "@/lib/email/modeles";

/**
 * Ce qui parle vraiment au monde extérieur.
 *
 * Trois pilotes possibles, un seul actif, choisi par `EMAIL_DRIVER`. Le reste
 * du système ne sait pas lequel : il demande un envoi et reçoit un verdict.
 */

export type NomPilote = "console" | "resend" | "aucun";

export type Verdict =
  | { ok: true; reference: string | null }
  | {
      ok: false;
      message: string;
      /**
       * Faut-il renoncer ?
       *
       * La distinction porte tout le mécanisme de reprise. Une adresse mal
       * formée ne deviendra pas valide en réessayant : insister cinq fois
       * n'apporte rien et retarde le reste de la file. Un service qui répond
       * 503, lui, sera debout dans dix minutes.
       *
       * Dans le doute, on réessaie : abandonner un message à tort le perd,
       * réessayer à tort ne coûte qu'une tentative.
       */
      definitif: boolean;
    };

export interface Pilote {
  nom: NomPilote;
  envoyer(destinataire: string, message: Message): Promise<Verdict>;
}

/** Une adresse plausible. Le contrôle sérieux, c'est l'expéditeur qui le fait. */
export function adressePlausible(valeur: string): boolean {
  if (valeur.length > 320) return false;
  if (/[\r\n\s]/.test(valeur)) return false;
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(valeur);
}

function expediteur(): string {
  return process.env.EMAIL_FROM ?? "Baobart <bonjour@baobart.com>";
}

/**
 * Pilote de développement : écrit, n'envoie pas.
 *
 * Le corps n'est **pas** journalisé. Il porte des liens de téléchargement
 * personnels et des liens de réinitialisation : les déverser dans un
 * agrégateur de journaux reviendrait à les distribuer. Le sujet et le
 * destinataire suffisent à vérifier que la file tourne.
 */
const CONSOLE: Pilote = {
  nom: "console",
  async envoyer(destinataire, message) {
    journal.info("courriel simulé (pilote console)", {
      destinataire,
      sujet: message.sujet,
      octets: message.texte.length,
    });
    return { ok: true, reference: null };
  },
};

const AUCUN: Pilote = {
  nom: "aucun",
  async envoyer() {
    return {
      ok: false,
      message:
        "Aucun expéditeur configuré : renseigne EMAIL_DRIVER et les variables du pilote.",
      // Réessayer ne changera rien tant que personne n'a posé la variable, mais
      // un abandon définitif perdrait le message. On garde la ligne en attente.
      definitif: false,
    };
  },
};

/** Délai au-delà duquel on considère l'expéditeur muet. */
const DELAI_MS = 10_000;

const RESEND: Pilote = {
  nom: "resend",
  async envoyer(destinataire, message) {
    const cle = process.env.RESEND_API_KEY;
    if (!cle) {
      return {
        ok: false,
        message: "RESEND_API_KEY absente.",
        definitif: false,
      };
    }

    const abandon = AbortSignal.timeout(DELAI_MS);

    try {
      const reponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cle}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: expediteur(),
          to: [destinataire],
          subject: message.sujet,
          text: message.texte,
        }),
        signal: abandon,
      });

      if (reponse.ok) {
        const corps = (await reponse.json().catch(() => null)) as {
          id?: string;
        } | null;
        return { ok: true, reference: corps?.id ?? null };
      }

      // Le corps d'erreur peut porter l'adresse ou la clé : on n'en garde que
      // le début, et il ne part jamais dans un journal.
      const detail = (await reponse.text().catch(() => "")).slice(0, 300);

      // 429 et 5xx passent : le service est débordé ou en panne, pas notre
      // requête. Les autres 4xx décrivent une demande qui restera invalide.
      const reessayable = reponse.status === 429 || reponse.status >= 500;

      return {
        ok: false,
        message: `Resend a répondu ${reponse.status}. ${detail}`.trim(),
        definitif: !reessayable,
      };
    } catch (cause) {
      // Réseau coupé, DNS, délai dépassé : toujours réessayable.
      const message =
        cause instanceof Error ? cause.message : "échec réseau inconnu";
      return { ok: false, message, definitif: false };
    }
  },
};

/**
 * Le pilote en service.
 *
 * `smtp` est reconnu mais pas écrit : il demanderait une dépendance de plus.
 * Le nommer sans l'implémenter serait pire que de l'ignorer — on répond donc
 * comme si rien n'était configuré, avec un message qui le dit.
 */
export function piloteCourant(): Pilote {
  switch ((process.env.EMAIL_DRIVER ?? "").trim().toLowerCase()) {
    case "console":
      return CONSOLE;
    case "resend":
      return RESEND;
    default:
      return AUCUN;
  }
}

export const POUR_TESTS = { CONSOLE, RESEND, AUCUN };
