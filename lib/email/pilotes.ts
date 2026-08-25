import "server-only";

import { journal } from "@/lib/observabilite/journal";
import type { Message } from "@/lib/email/modeles";

/**
 * Ce qui parle vraiment au monde extérieur.
 *
 * Trois pilotes possibles, un seul actif, choisi par `EMAIL_DRIVER`. Le reste
 * du système ne sait pas lequel : il demande un envoi et reçoit un verdict.
 */

export type NomPilote = "console" | "resend" | "smtp" | "aucun";

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
 * Transport SMTP, construit une seule fois.
 *
 * Ouvrir une connexion par message reviendrait à refaire la poignée de main
 * TLS et l'authentification à chaque envoi — coûteux, et vu comme un abus par
 * la plupart des serveurs. Le transport garde un petit bassin de connexions et
 * les réutilise.
 *
 * Construit à la première demande, jamais au chargement du module : les tests
 * et le typecheck n'ont pas à exiger une configuration SMTP.
 */
type TransportSmtp = {
  sendMail(options: Record<string, unknown>): Promise<{ messageId?: string }>;
};

const globalé = globalThis as unknown as { transportSmtp?: TransportSmtp };

/**
 * Les réglages de connexion, déduits de `SMTP_URL` mais décidés ici.
 *
 * Passer l'URL brute à nodemailer marcherait, mais laisserait le chiffrement
 * se déduire tout seul. Or c'est la décision qui compte : sur le port 587,
 * sans `requireTLS`, un serveur qui n'annonce pas STARTTLS reçoit le message
 * **en clair** — identifiants compris — et rien ne le signale. On l'exige
 * donc, quitte à échouer bruyamment.
 */
const LOCAUX = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function reglagesSmtp(url: string) {
  const u = new URL(url);
  // `smtps:` chiffre dès la connexion (465). `smtp:` commence en clair et
  // monte en TLS par STARTTLS (587) — d'où l'exigence ci-dessous.
  const implicite = u.protocol === "smtps:";

  // Seule exception à l'exigence de TLS : un serveur sur la machine même. Le
  // trafic ne quitte pas l'hôte, il n'y a rien à écouter entre les deux, et
  // c'est ainsi que fonctionnent les attrape-courriels de développement —
  // MailHog, Mailpit — qui n'offrent pas STARTTLS. Une échappatoire globale du
  // type SMTP_ALLOW_INSECURE, elle, finirait tôt ou tard en production.
  const local = LOCAUX.has(u.hostname);

  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : implicite ? 465 : 587,
    secure: implicite,
    requireTLS: !implicite && !local,
    auth: u.username
      ? {
          user: decodeURIComponent(u.username),
          pass: decodeURIComponent(u.password),
        }
      : undefined,
    // Un serveur muet ne doit pas retenir le passage entier.
    connectionTimeout: DELAI_MS,
    greetingTimeout: DELAI_MS,
    socketTimeout: DELAI_MS,
    pool: true,
    maxConnections: 3,
  };
}

async function transport(): Promise<TransportSmtp | null> {
  if (globalé.transportSmtp) return globalé.transportSmtp;

  const url = process.env.SMTP_URL;
  if (!url) return null;

  // Import dynamique : sans lui, nodemailer entrerait dans tous les paquets
  // serveur, y compris ceux des pages qui n'envoient jamais rien.
  const { createTransport } = await import("nodemailer");

  globalé.transportSmtp = createTransport(
    reglagesSmtp(url),
  ) as unknown as TransportSmtp;

  return globalé.transportSmtp;
}

/**
 * Un échec SMTP est-il définitif ?
 *
 * Le protocole répond par un nombre à trois chiffres dont le premier dit tout :
 * 5 signifie « non, et n'insiste pas » — boîte inexistante, message refusé ;
 * 4 signifie « pas maintenant » — boîte pleine, serveur saturé. Tout le reste
 * (réseau coupé, TLS, authentification refusée) est traité comme passager :
 * une authentification refusée vient d'une configuration qu'on peut corriger,
 * et abandonner les messages en attendant les perdrait.
 */
export function echecDefinitif(cause: unknown): boolean {
  const code = (cause as { responseCode?: unknown })?.responseCode;
  return typeof code === "number" && code >= 500 && code < 600;
}

const SMTP: Pilote = {
  nom: "smtp",
  async envoyer(destinataire, message) {
    const envoi = await transport();
    if (!envoi) {
      return {
        ok: false,
        message: "SMTP_URL absente.",
        definitif: false,
      };
    }

    try {
      const resultat = await envoi.sendMail({
        from: expediteur(),
        to: destinataire,
        subject: message.sujet,
        text: message.texte,
      });
      return { ok: true, reference: resultat.messageId ?? null };
    } catch (cause) {
      const detail =
        cause instanceof Error ? cause.message : "échec SMTP inconnu";
      return {
        ok: false,
        // Le message d'erreur SMTP peut porter l'adresse du serveur : on le
        // borne, et il ne part jamais dans un journal.
        message: detail.slice(0, 300),
        definitif: echecDefinitif(cause),
      };
    }
  },
};

/**
 * Le pilote en service.
 *
 * Un nom inconnu — ou aucun — donne le pilote `aucun`, qui refuse sans
 * abandonner : les messages restent en file plutôt que de se perdre.
 */
export function piloteCourant(): Pilote {
  switch ((process.env.EMAIL_DRIVER ?? "").trim().toLowerCase()) {
    case "console":
      return CONSOLE;
    case "resend":
      return RESEND;
    case "smtp":
      return SMTP;
    default:
      return AUCUN;
  }
}

export const POUR_TESTS = { CONSOLE, RESEND, SMTP, AUCUN };
