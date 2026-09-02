import "server-only";

import { journal } from "@/lib/observabilite/journal";
import { replier, segments } from "@/lib/sms/gsm7";
import { masquer, versE164 } from "@/lib/sms/numero";

/**
 * L'envoi de SMS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE SEUL CANAL QUI COÛTE
 *
 * Un courriel et une notification ne coûtent rien : on peut en envoyer mille
 * sans y penser. Un SMS se paie à l'unité, et un défaut de boucle — un passage
 * qui rejoue, une relance mal notée — se compte en factures.
 *
 * Ce module porte donc trois choses qu'aucun autre pilote du projet n'a :
 *
 *   — un **plafond journalier**, qui refuse d'envoyer au-delà. Ce n'est pas de
 *     la prudence décorative : c'est la seule chose qui borne le coût d'un
 *     bogue qu'on n'a pas encore écrit ;
 *   — une **normalisation** du numéro, parce qu'un SMS mal adressé est facturé
 *     sans être reçu ;
 *   — un **journal sans numéro complet** : quatre chiffres suffisent à
 *     enquêter, et un numéro entier dans un agrégateur y reste des mois.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * « ACCEPTÉ » N'EST PAS « REÇU »
 *
 * L'opérateur rend la main dès qu'il a pris le message en charge — sa
 * distribution suit, parfois plusieurs minutes après, parfois jamais. On ne
 * peut pas attendre : Ndank considère qu'un message accepté est parti, et c'est
 * la meilleure approximation disponible. Un refus à la soumission, lui, est un
 * vrai échec et rend `false`.
 */

export type NomPiloteSms = "console" | "twilio" | "aucun";

export interface Verdict {
  ok: boolean;
  /** La référence chez l'opérateur, à citer en cas de litige de facturation. */
  reference?: string;
  motif?: string;
  /** Ce que l'envoi a coute, en segments facturables. */
  segments?: number;
}

export interface PiloteSms {
  nom: NomPiloteSms;
  configure(): boolean;
  envoyer(numeroE164: string, texte: string): Promise<Verdict>;
}

/**
 * Au-delà, on cesse d'envoyer pour la journée.
 *
 * Le chiffre n'est pas magique : il doit être largement au-dessus d'un usage
 * normal et largement en dessous d'une facture qui fait mal. À ajuster quand on
 * saura combien d'abonnés arrivent à échéance un jour ordinaire.
 */
function plafondDuJour(): number {
  const lu = Number(process.env.SMS_PLAFOND_JOUR ?? "");
  // Lu à chaque appel, et non figé au chargement : un plafond figé ignore la
  // variable posée au démarrage du conteneur, et empêche de l'éprouver.
  return Number.isFinite(lu) && lu > 0 ? lu : 500;
}

let compteur = { jour: "", envoyes: 0 };

function jourCourant(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Le plafond, remis à zéro chaque jour.
 *
 * En mémoire, donc par instance — imparfait en serverless, exactement comme le
 * limiteur. C'est un garde-fou de dernier recours, pas une comptabilité : le
 * vrai plafond se pose chez l'opérateur, qui sait compter pour de bon.
 */
function sousLePlafond(): boolean {
  const aujourdhui = jourCourant();
  if (compteur.jour !== aujourdhui) compteur = { jour: aujourdhui, envoyes: 0 };
  return compteur.envoyes < plafondDuJour();
}

function compter(): void {
  compteur.envoyes += 1;
}

/** Vidé par les tests. */
export function oublierCompteurSms(): void {
  compteur = { jour: "", envoyes: 0 };
}

// ────────────────────────────────────────────────────────────────── console ──

/**
 * Écrit, n'envoie pas.
 *
 * Le texte **est** journalisé ici, contrairement au pilote de courriel : un SMS
 * ne porte ni lien de téléchargement ni jeton de réinitialisation, et pouvoir
 * relire ce qu'on aurait envoyé est tout l'intérêt de ce pilote.
 */
const CONSOLE: PiloteSms = {
  nom: "console",
  configure: () => true,
  async envoyer(numero, texte) {
    journal.info("SMS simulé (pilote console)", {
      vers: masquer(numero),
      texte: texte.slice(0, 200),
    });
    return { ok: true };
  },
};

// ─────────────────────────────────────────────────────────────────── twilio ──

const TWILIO_BASE = "https://api.twilio.com/2010-04-01";

/**
 * Ce que Twilio répond quand il a pris le message.
 *
 * `accepted` et `queued` veulent dire « pris en charge » ; `failed` et
 * `undelivered` sont des refus. Les autres valeurs décrivent une distribution
 * en cours, qu'on n'observe pas ici.
 */
const PRIS_EN_CHARGE = new Set(["accepted", "queued", "sending", "sent", "delivered"]);

const TWILIO: PiloteSms = {
  nom: "twilio",

  configure() {
    const sid = (process.env.TWILIO_ACCOUNT_SID ?? "").trim();
    const jeton = (process.env.TWILIO_AUTH_TOKEN ?? "").trim();
    const source =
      (process.env.TWILIO_FROM ?? "").trim() ||
      (process.env.TWILIO_MESSAGING_SERVICE_SID ?? "").trim();

    // Le préfixe distingue une vraie référence d'un espace réservé recopié.
    return /^AC[0-9a-f]{10,}$/i.test(sid) && jeton.length > 10 && source.length > 0;
  },

  async envoyer(numero, texte) {
    const sid = (process.env.TWILIO_ACCOUNT_SID ?? "").trim();
    const jeton = (process.env.TWILIO_AUTH_TOKEN ?? "").trim();
    const from = (process.env.TWILIO_FROM ?? "").trim();
    const service = (process.env.TWILIO_MESSAGING_SERVICE_SID ?? "").trim();

    const corps = new URLSearchParams({ To: numero, Body: texte });

    // L'un ou l'autre, jamais les deux : avec un service de messagerie, Twilio
    // choisit lui-même l'expéditeur le mieux placé pour le pays visé — ce qui
    // compte quand on écrit à plusieurs pays d'Afrique de l'Ouest.
    if (service) corps.set("MessagingServiceSid", service);
    else corps.set("From", from);

    let reponse: Response;
    try {
      reponse = await fetch(`${TWILIO_BASE}/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${sid}:${jeton}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: corps,
      });
    } catch (cause) {
      journal.erreur("opérateur SMS injoignable", {
        vers: masquer(numero),
        cause: cause instanceof Error ? cause.message : String(cause),
      });
      return { ok: false, motif: "injoignable" };
    }

    const lu = (await reponse.json().catch(() => null)) as {
      sid?: string;
      status?: string;
      error_code?: number | null;
      message?: string;
    } | null;

    if (!reponse.ok || !lu?.sid || !PRIS_EN_CHARGE.has(lu.status ?? "")) {
      journal.erreur("SMS refusé par l'opérateur", {
        vers: masquer(numero),
        code: reponse.status,
        erreur: lu?.error_code ?? null,
        // Surtout pas `message` : le journal a déjà ce champ, et la clé
        // écraserait « SMS refusé par l'opérateur » par le détail de l'erreur.
        detail: lu?.message ?? lu?.status ?? "",
      });
      return { ok: false, motif: lu?.message ?? lu?.status ?? "refusé" };
    }

    return { ok: true, reference: lu.sid };
  },
};

// ──────────────────────────────────────────────────────────────────── aucun ──

/** N'envoie rien, et le dit. */
const AUCUN: PiloteSms = {
  nom: "aucun",
  configure: () => true,
  async envoyer() {
    return { ok: false, motif: "aucun opérateur SMS branché" };
  },
};

const PILOTES: Record<NomPiloteSms, PiloteSms> = {
  console: CONSOLE,
  twilio: TWILIO,
  aucun: AUCUN,
};

/**
 * Le pilote actif.
 *
 * Par défaut « aucun », et non « console » : le courriel a des pilotes gratuits
 * qu'on peut laisser tourner par défaut, le SMS non. Un défaut bavard sur un
 * canal payant est une facture qui commence sans décision.
 */
export function piloteSms(): PiloteSms {
  const nom = (process.env.SMS_DRIVER ?? "aucun").trim().toLowerCase();
  const pilote = PILOTES[nom as NomPiloteSms];
  if (!pilote) return AUCUN;
  if (!pilote.configure()) return AUCUN;
  return pilote;
}

/**
 * Envoie, après avoir mis le numéro en forme et vérifié le plafond.
 *
 * C'est ce point d'entrée qu'il faut appeler, jamais le pilote directement :
 * lui seul porte la normalisation et le garde-fou de coût.
 */
export async function envoyerSms(input: {
  numero: string;
  pays: string;
  texte: string;
}): Promise<Verdict> {
  const pilote = piloteSms();
  if (pilote.nom === "aucun") {
    return { ok: false, motif: "aucun opérateur SMS branché" };
  }

  const e164 = versE164(input.numero, input.pays);
  if (!e164) {
    // On ne tente pas : un numéro mal formé est facturé sans être reçu.
    journal.avertissement("numéro impossible à mettre en forme", {
      pays: input.pays,
    });
    return { ok: false, motif: "numéro illisible" };
  }

  if (!sousLePlafond()) {
    // Le seul refus qui protège de nous-mêmes.
    journal.erreur("plafond journalier de SMS atteint", {
      plafond: plafondDuJour(),
      remede:
        "Vérifie qu'aucune boucle ne relance : ce plafond existe pour borner le coût d'un bogue.",
    });
    return { ok: false, motif: "plafond atteint" };
  }

  // Le repli est ici, et non chez l'appelant : un seul caractère typographique
  // oublié ferait basculer le message en UCS-2 et doubler la facture, et aucun
  // appelant ne peut raisonnablement y penser à chaque fois.
  const texte = replier(input.texte);
  const cout = segments(texte);

  const verdict = await pilote.envoyer(e164, texte);
  if (verdict.ok) {
    compter();
    // Le coût est journalisé à chaque envoi : c'est la seule façon de voir une
    // relance devenue trop longue avant de la découvrir sur la facture.
    journal.info("SMS envoyé", {
      vers: masquer(e164),
      segments: cout,
      pilote: pilote.nom,
    });
  }

  return { ...verdict, segments: cout };
}

export const POUR_TESTS = { CONSOLE, TWILIO, AUCUN, plafondDuJour };
