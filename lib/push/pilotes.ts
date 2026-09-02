import "server-only";

import webpush from "web-push";

import { journal } from "@/lib/observabilite/journal";

/**
 * L'envoi de notifications poussées.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QU'EST VRAIMENT UNE NOTIFICATION WEB
 *
 * Ce n'est pas un message qu'on envoie à quelqu'un : c'est un message qu'on
 * dépose chez le **service de poussée de son navigateur** — Google pour Chrome,
 * Mozilla pour Firefox, Apple pour Safari — qui le transmettra à l'appareil.
 *
 * Trois conséquences, et chacune est un piège :
 *
 *   — **le service ne doit pas pouvoir lire le message.** D'où le chiffrement
 *     de bout en bout (RFC 8291) avec les deux clés que le navigateur nous a
 *     données. `web-push` s'en charge ; l'écrire à la main serait de la
 *     cryptographie maison, c'est-à-dire un défaut qu'on ne verrait jamais ;
 *   — **le service doit savoir qui dépose.** D'où VAPID : une paire de clés
 *     qui nous identifie, et dont la publique est aussi ce à quoi le navigateur
 *     s'abonne. Changer la paire invalide TOUS les abonnements existants ;
 *   — **un abonnement meurt sans prévenir.** Navigateur désinstallé, permission
 *     révoquée, données de site effacées : le service répond 404 ou 410, et
 *     c'est définitif. Garder la ligne ferait retenter chaque jour un appareil
 *     qui n'existe plus.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * « DÉPOSÉ » N'EST PAS « LU »
 *
 * Le service accepte en 201 et transmet quand il peut — l'appareil peut être
 * éteint des heures. On ne peut pas attendre : Ndank considère qu'un message
 * accepté est parti. Un refus au dépôt, lui, est un vrai échec.
 */

export type NomPilotePush = "web-push" | "aucun";

export interface Verdict {
  /** Vrai dès qu'AU MOINS un appareil a accepté le message. */
  ok: boolean;
  /** Combien d'appareils ont pris le message. */
  deposes: number;
  /** Abonnements déclarés morts par le service, et donc supprimés. */
  morts: string[];
  motif?: string;
}

/** Un abonnement, tel que le navigateur nous l'a donné. */
export interface Abonnement {
  /** Notre identifiant de ligne — c'est lui qui voyage dans les ports Ndank. */
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Ce qu'on affiche. Volontairement pauvre : une notification se lit d'un œil. */
export interface Notification {
  titre: string;
  corps: string;
  /** Où mène le clic. Chemin relatif, résolu par le service worker. */
  lien: string;
  /**
   * Regroupe les notifications d'un même sujet.
   *
   * Deux relances pour le même abonnement se remplacent au lieu de s'empiler :
   * personne ne veut trouver sept pastilles pour une seule échéance.
   */
  etiquette?: string;
}

/**
 * La clé publique, celle à laquelle le navigateur s'abonne.
 *
 * Elle part au client : c'est sa nature. La privée, jamais.
 */
export function clePubliqueVapid(): string | null {
  const cle = (process.env.VAPID_PUBLIC_KEY ?? "").trim();
  return cle.length > 0 ? cle : null;
}

/**
 * Les trois valeurs sans lesquelles rien ne part.
 *
 * `VAPID_SUBJECT` doit être une adresse de contact — `mailto:` ou une URL. Les
 * services de poussée s'en servent pour joindre l'exploitant quand quelque
 * chose ne va pas ; une valeur absente fait rejeter la requête par certains
 * d'entre eux, et pas par d'autres. Un défaut qui n'apparaît que sur un
 * navigateur sur trois est le pire genre.
 */
function reglages(): { sujet: string; publique: string; privee: string } | null {
  const sujet = (process.env.VAPID_SUBJECT ?? "").trim();
  const publique = (process.env.VAPID_PUBLIC_KEY ?? "").trim();
  const privee = (process.env.VAPID_PRIVATE_KEY ?? "").trim();

  if (!publique || !privee) return null;
  if (!/^(mailto:|https:\/\/)/.test(sujet)) return null;

  // Les longueurs sont celles de la norme : 65 octets pour la publique et 32
  // pour la privée, en base64url. Un espace réservé recopié d'une
  // documentation ne passera pas.
  if (publique.length < 80 || privee.length < 40) return null;

  return { sujet, publique, privee };
}

export function pilotePush(): NomPilotePush {
  const nom = (process.env.PUSH_DRIVER ?? "aucun").trim().toLowerCase();
  if (nom !== "web-push") return "aucun";
  return reglages() ? "web-push" : "aucun";
}

/**
 * Dépose la notification sur tous les appareils de la personne.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN APPAREIL MORT NE FAIT PAS ÉCHOUER LES AUTRES
 *
 * Quelqu'un qui a trois navigateurs enregistrés en a souvent un qui n'existe
 * plus. Si son 410 faisait échouer l'envoi entier, Ndank ne noterait pas la
 * relance et réessaierait demain — indéfiniment, jusqu'à ce que l'accès soit
 * coupé alors que deux appareils ont bien reçu le message.
 *
 * On dépose donc partout, on rend `true` dès qu'un seul a pris, et on rend la
 * liste des morts pour que l'appelant les efface.
 */
export async function pousser(
  abonnements: readonly Abonnement[],
  notification: Notification,
): Promise<Verdict> {
  if (pilotePush() === "aucun") {
    return { ok: false, deposes: 0, morts: [], motif: "aucun service de poussée configuré" };
  }
  if (abonnements.length === 0) {
    return { ok: false, deposes: 0, morts: [], motif: "aucun appareil enregistré" };
  }

  const r = reglages()!;
  webpush.setVapidDetails(r.sujet, r.publique, r.privee);

  const charge = JSON.stringify(notification);
  const morts: string[] = [];
  let deposes = 0;

  // En série et non en parallèle : quelqu'un a rarement plus de trois
  // appareils, et une rafale simultanée vers le même service de poussée se
  // fait limiter — ce qui produirait des échecs qui n'en sont pas.
  for (const a of abonnements) {
    try {
      await webpush.sendNotification(
        {
          endpoint: a.endpoint,
          keys: { p256dh: a.p256dh, auth: a.auth },
        },
        charge,
        { TTL: TTL_SECONDES, urgency: "normal" },
      );
      deposes += 1;
    } catch (cause) {
      const code =
        cause && typeof cause === "object" && "statusCode" in cause
          ? Number((cause as { statusCode: unknown }).statusCode)
          : 0;

      if (estMort(code)) {
        // 404 et 410 sont définitifs : cet abonnement n'existe plus, et
        // réessayer demain ne le ressuscitera pas.
        morts.push(a.id);
        continue;
      }

      journal.avertissement("poussée refusée par le service", {
        code,
        // Jamais l'endpoint entier : il identifie un appareil, et il vaut
        // jeton — qui l'a peut pousser sur ce navigateur.
        service: hote(a.endpoint),
      });
    }
  }

  return {
    ok: deposes > 0,
    deposes,
    morts,
    motif: deposes === 0 ? "aucun appareil n'a pris le message" : undefined,
  };
}

/**
 * Combien de temps le service garde le message pour un appareil éteint.
 *
 * Trois jours. Une relance d'abonnement reste utile pendant la grâce ; au-delà,
 * l'accès est coupé et la notification ne dirait plus la vérité. Mieux vaut
 * qu'elle expire que d'arriver périmée.
 */
const TTL_SECONDES = 3 * 24 * 3600;

/** Le service dit-il que cet abonnement n'existe plus ? */
export function estMort(code: number): boolean {
  return code === 404 || code === 410;
}

/** L'hôte seul, pour journaliser sans écrire un identifiant d'appareil. */
export function hote(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "inconnu";
  }
}
