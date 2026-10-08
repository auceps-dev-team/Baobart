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

export type NomPiloteSms = "console" | "twilio" | "textbee" | "aucun";

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
 * Le texte **est** journalisé ici, contrairement au pilote de courriel : pouvoir
 * relire ce qu'on aurait envoyé est tout l'intérêt de ce pilote.
 *
 * ⚠️ Depuis la connexion par SMS (08/10/2026), ce texte peut porter un CODE DE
 * CONNEXION — ce commentaire disait le contraire, « un SMS ne porte aucun
 * jeton ». En développement c'est le but : on lit le code dans le terminal. En
 * production, un code dans le journal ouvrirait le compte à quiconque lit les
 * journaux : `lib/auth/telephone.ts` refuse donc d'émettre un code par ce
 * pilote quand `NODE_ENV=production`.
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

// ────────────────────────────────────────────────────────────────── textbee ──

/**
 * textbee : un téléphone Android sert de passerelle SMS (textbee.dev, libre et
 * auto-hébergeable). Pas de numéro loué, pas de coût par message au-delà du
 * forfait de la carte SIM — de quoi éprouver la connexion par SMS sans compte
 * chez un opérateur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'API, LUE DANS LE CODE DE TEXTBEE LE 08/10/2026
 *
 * `POST {base}/api/v1/gateway/send-sms`, en-tête `x-api-key`, corps
 * `{ recipients: [e164], message, deviceId? }` (`api/src/gateway/
 * gateway.controller.ts`). Sans `deviceId`, textbee choisit l'appareil par
 * défaut du compte. Réponses : 200 accepté, 400 aucun appareil disponible,
 * 401 clé refusée, 429 quota du forfait épuisé.
 *
 * « Accepté » veut dire encore moins ici qu'ailleurs : le message part d'un
 * téléphone, qui doit être allumé et en ligne. Un téléphone éteint accepte
 * en silence, et le code n'arrive jamais. C'est une passerelle d'essai et de
 * petit volume ; pour la production, un opérateur garde un engagement de
 * distribution que ce téléphone n'a pas.
 */
const TEXTBEE_BASE_PAR_DEFAUT = "https://api.textbee.dev";

/** Un appel qui pend tient un formulaire de connexion en suspens. */
const TEXTBEE_DELAI_MS = 10_000;

function baseTextbee(): string | null {
  const brut = (process.env.TEXTBEE_BASE_URL ?? "").trim() || TEXTBEE_BASE_PAR_DEFAUT;
  try {
    const url = new URL(brut);
    // La clé part dans un en-tête : jamais en clair, sauf vers une instance
    // auto-hébergée sur la machine même.
    const locale = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && locale)) return null;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

const TEXTBEE: PiloteSms = {
  nom: "textbee",

  configure() {
    // Une clé d'au moins seize caractères : un espace réservé (« à-remplir »)
    // ne doit pas passer pour une configuration.
    return (
      (process.env.TEXTBEE_API_KEY ?? "").trim().length >= 16 &&
      baseTextbee() !== null
    );
  },

  async envoyer(numero, texte) {
    const base = baseTextbee();
    const cle = (process.env.TEXTBEE_API_KEY ?? "").trim();
    const appareil = (process.env.TEXTBEE_DEVICE_ID ?? "").trim();
    if (!base) return { ok: false, motif: "adresse textbee invalide" };

    let reponse: Response;
    try {
      reponse = await fetch(`${base}/api/v1/gateway/send-sms`, {
        method: "POST",
        headers: { "x-api-key": cle, "content-type": "application/json" },
        body: JSON.stringify({
          recipients: [numero],
          message: texte,
          ...(appareil ? { deviceId: appareil } : {}),
        }),
        signal: AbortSignal.timeout(TEXTBEE_DELAI_MS),
      });
    } catch (cause) {
      journal.erreur("passerelle textbee injoignable", {
        vers: masquer(numero),
        cause: cause instanceof Error ? cause.message : String(cause),
      });
      return { ok: false, motif: "injoignable" };
    }

    const lu = (await reponse.json().catch(() => null)) as {
      data?: { smsBatchId?: string; success?: boolean; message?: string };
      message?: string | string[];
      error?: string;
    } | null;

    if (!reponse.ok || lu?.data?.success === false) {
      const detail = Array.isArray(lu?.message)
        ? lu.message.join(" ; ")
        : (lu?.message ?? lu?.data?.message ?? lu?.error ?? "");
      journal.erreur("SMS refusé par textbee", {
        vers: masquer(numero),
        code: reponse.status,
        detail,
      });
      const motifs: Record<number, string> = {
        400: "aucun appareil textbee disponible",
        401: "clé textbee refusée",
        429: "quota textbee épuisé",
      };
      return { ok: false, motif: motifs[reponse.status] ?? (detail || "refusé") };
    }

    return { ok: true, reference: lu?.data?.smsBatchId };
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
  textbee: TEXTBEE,
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

export const POUR_TESTS = { CONSOLE, TWILIO, TEXTBEE, AUCUN, plafondDuJour };
