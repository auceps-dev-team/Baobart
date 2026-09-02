"use client";

import { useCallback, useEffect, useState } from "react";

import { enregistrerAppareil, retirerAppareil } from "@/lib/push/actions";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Le réglage des notifications, et le service worker qui va avec.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON NE DEMANDE PAS LA PERMISSION AU CHARGEMENT
 *
 * C'est la faute la plus courante, et elle est irréversible : une demande qui
 * surgit sans que la personne ait rien réclamé se refuse d'un réflexe. Or un
 * refus, sur le web, est **définitif du point de vue du site** — on ne peut
 * plus jamais redemander, et la personne devrait aller le rétablir dans les
 * réglages de son navigateur, ce qu'elle ne fera pas.
 *
 * La permission n'est donc demandée qu'après un clic explicite, sur un écran
 * qui vient de dire à quoi elle sert.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS RAISONS DE NE RIEN AFFICHER DU TOUT
 *
 *   — le navigateur ne sait pas faire (Safari avant iOS 16.4, et tout
 *     navigateur sur une page non installée sous iOS) ;
 *   — le serveur n'a pas de clé VAPID : proposer un bouton qui échouerait
 *     serait pire que de se taire ;
 *   — la permission a déjà été refusée : le bouton ne pourrait rien y changer,
 *     et le proposer laisserait croire le contraire.
 *
 * Dans les trois cas on l'explique, plutôt que d'afficher un bouton mort.
 */

type Etat =
  | "chargement"
  | "impossible"
  | "sans-cle"
  | "refuse"
  | "inactif"
  | "actif";

export function Notifications({ clePublique }: { clePublique: string | null }) {
  const [etat, setEtat] = useState<Etat>("chargement");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /**
   * Enregistre le service worker et lit l'abonnement courant.
   *
   * Réenregistrer à chaque montage n'est pas du gaspillage : c'est ce qui
   * rattrape un `pushsubscriptionchange`, ces renouvellements que le service de
   * poussée fait tout seul. Sans cela, l'ancien endpoint meurt en silence et
   * les relances cessent d'arriver sans que rien ne le signale.
   */
  const relire = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setEtat("impossible");
      return;
    }
    if (!clePublique) {
      setEtat("sans-cle");
      return;
    }
    if (Notification.permission === "denied") {
      setEtat("refuse");
      return;
    }

    const enregistrement = await navigator.serviceWorker.register("/sw.js");
    const abonnement = await enregistrement.pushManager.getSubscription();

    if (!abonnement) {
      setEtat("inactif");
      return;
    }

    // On réenregistre côté serveur même quand l'abonnement existait déjà : le
    // navigateur a pu le renouveler pendant qu'on était parti, et la ligne en
    // base pointerait alors sur un endpoint mort.
    await pousserVersLeServeur(abonnement);
    setEtat("actif");
  }, [clePublique]);

  useEffect(() => {
    void relire();

    // Le service worker nous prévient quand le navigateur a renouvelé
    // l'abonnement de son côté.
    function surMessage(e: MessageEvent) {
      if (e.data?.type === "push-a-reinscrire") void relire();
    }
    navigator.serviceWorker?.addEventListener("message", surMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", surMessage);
  }, [relire]);

  async function activer() {
    if (!clePublique) return;
    setEnCours(true);
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEtat(permission === "denied" ? "refuse" : "inactif");
        return;
      }

      const enregistrement = await navigator.serviceWorker.ready;
      const abonnement = await enregistrement.pushManager.subscribe({
        // Obligatoire, et sans alternative : un abonnement « silencieux » est
        // refusé par tous les navigateurs. Chaque poussée DOIT se voir.
        userVisibleOnly: true,
        applicationServerKey: versOctets(clePublique),
      });

      const suite = await pousserVersLeServeur(abonnement);
      if (!suite) {
        // Le serveur n'a pas voulu de l'abonnement : on le retire du navigateur
        // plutôt que de laisser un abonnement que personne n'utilisera.
        await abonnement.unsubscribe();
        setEtat("inactif");
        setMessage("L'enregistrement a échoué. Réessaie dans un instant.");
        return;
      }

      setEtat("actif");
    } catch {
      setEtat("inactif");
      setMessage("Ton navigateur a refusé l'abonnement.");
    } finally {
      setEnCours(false);
    }
  }

  async function desactiver() {
    setEnCours(true);
    try {
      const enregistrement = await navigator.serviceWorker.ready;
      const abonnement = await enregistrement.pushManager.getSubscription();
      if (abonnement) {
        // Le serveur d'abord : si le navigateur se désabonne et que l'appel
        // échoue ensuite, la ligne resterait en base et on pousserait vers un
        // endpoint mort jusqu'au premier 410.
        await retirerAppareil(abonnement.endpoint);
        await abonnement.unsubscribe();
      }
      setEtat("inactif");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 20,
        background: BLANC,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 22,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 17,
          textTransform: "uppercase",
          letterSpacing: "-.3px",
        }}
      >
        Notifications
      </div>

      <p
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          lineHeight: 1.55,
          margin: "10px 0 16px",
          textWrap: "pretty",
        }}
      >
        {TEXTES[etat]}
      </p>

      {etat === "inactif" ? (
        <button
          type="button"
          onClick={activer}
          disabled={enCours}
          className="sticker-press"
          style={bouton(JAUNE, enCours)}
        >
          {enCours ? "Un instant…" : "Activer les notifications"}
        </button>
      ) : null}

      {etat === "actif" ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              padding: "6px 12px",
              border: CADRE,
              borderRadius: 999,
              background: VERT,
              fontSize: 12.5,
              fontWeight: 800,
            }}
          >
            Actives sur cet appareil
          </span>
          <button
            type="button"
            onClick={desactiver}
            disabled={enCours}
            style={bouton(BLANC, enCours)}
          >
            Désactiver ici
          </button>
        </div>
      ) : null}

      {message ? (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: "10px 13px",
            border: CADRE,
            borderRadius: 12,
            background: ORANGE,
            color: BLANC,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}

const TEXTES: Record<Etat, string> = {
  chargement: "Un instant…",
  impossible:
    "Ton navigateur ne sait pas recevoir de notifications. Sur iPhone, ajoute d'abord Baobart à ton écran d'accueil : le partage, puis « Sur l'écran d'accueil ».",
  "sans-cle":
    "Les notifications ne sont pas encore activées côté Baobart. Tes relances d'abonnement continuent d'arriver par courriel.",
  refuse:
    "Tu as refusé les notifications pour Baobart. On ne peut plus te le redemander : il faut les rétablir dans les réglages de ton navigateur, à la ligne de ce site.",
  inactif:
    "Reçois un rappel avant que ton abonnement n'arrive à échéance, plutôt que de le découvrir une fois l'accès coupé. Rien d'autre ne te sera envoyé.",
  actif:
    "Tu recevras un rappel sur cet appareil avant chaque échéance. Tu peux l'arrêter quand tu veux.",
};

function bouton(fond: string, enCours: boolean) {
  return {
    padding: "11px 16px",
    border: CADRE,
    borderRadius: 12,
    background: fond,
    fontSize: 13.5,
    fontWeight: 800,
    cursor: enCours ? "wait" : "pointer",
    opacity: enCours ? 0.7 : 1,
  } as const;
}

/** Envoie l'abonnement au serveur. Rend `false` si le serveur l'a refusé. */
async function pousserVersLeServeur(abonnement: PushSubscription): Promise<boolean> {
  const brut = abonnement.toJSON();
  const cles = brut.keys ?? {};
  if (!cles.p256dh || !cles.auth) return false;

  const suite = await enregistrerAppareil({
    endpoint: abonnement.endpoint,
    p256dh: cles.p256dh,
    auth: cles.auth,
    // Assez pour reconnaître son appareil dans une liste, pas assez pour
    // constituer une empreinte. Le serveur tronque de toute façon.
    appareil: navigator.userAgent.slice(0, 120),
  });

  return suite.ok;
}

/**
 * La clé VAPID, du base64url vers les octets que l'API réclame.
 *
 * `applicationServerKey` n'accepte pas une chaîne : il lui faut le tableau
 * d'octets. Et le base64url du web (`-` et `_`) n'est pas celui d'`atob`, d'où
 * la traduction — sans elle, la clé est acceptée puis l'abonnement échoue plus
 * tard, chez le service de poussée.
 */
function versOctets(base64url: string): Uint8Array<ArrayBuffer> {
  const bourrage = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + bourrage).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(base64);

  // Le tampon est nommé explicitement : `new Uint8Array(n)` peut, pour le
  // typage, reposer sur un `SharedArrayBuffer`, que `applicationServerKey`
  // n'accepte pas.
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
}
