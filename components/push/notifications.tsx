"use client";

import { useCallback, useEffect, useState } from "react";

import { enregistrerAppareil, retirerAppareil } from "@/lib/push/actions";
import {
  BLANC,
  CADRE,
  ENCRE,
  GRIS,
  JAUNE,
  LAVANDE,
  MAUVE,
  ORANGE,
  VERT,
} from "@/lib/systeme/charte";

/**
 * Le réglage des notifications, et le service worker qui va avec.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON NE DEMANDE PAS LA PERMISSION AU CHARGEMENT
 *
 * C'est la faute la plus courante, et elle est irréversible : une demande qui
 * surgit sans que la personne ait rien réclamé se refuse d'un réflexe. Or un
 * refus est **définitif du point de vue du site** — on ne peut plus jamais
 * redemander, et la personne devrait aller le rétablir dans les réglages de son
 * navigateur, ce qu'elle ne fera pas.
 *
 * La maquette en tire une conséquence forte : l'état « inactif » porte un
 * avertissement JAUNE qui dit explicitement « ton navigateur ne posera la
 * question qu'une fois ». On prévient avant, plutôt que de regretter après.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CINQ ÉTATS, UN SEUL BOUTON D'ACTIVATION
 *
 * Les quatre autres expliquent pourquoi il n'y a pas de bouton — parce qu'un
 * bouton qui échoue est pire qu'un bouton absent, et parce que sans la phrase
 * sur l'installation, un utilisateur d'iPhone ne comprend pas ce qui lui
 * manque.
 *
 * Traduit de « Baobart Parcours Achat.dc.html », écran `notifs`.
 */

type Etat = "chargement" | "impossible" | "sans-cle" | "refuse" | "inactif" | "actif";

interface Allure {
  pastille: string;
  glyphe: string;
  titre: string;
  texte: string;
  puce: string;
  puceFond: string;
  puceEncre: string;
  avertissement: string;
  avertissementFond: string;
  note: string;
}

const ALLURES: Record<Exclude<Etat, "chargement">, Allure> = {
  inactif: {
    pastille: LAVANDE,
    glyphe: "◌",
    titre: "Recevoir les relances sur cet appareil",
    texte:
      "À quoi ça sert avant que tu décides : un rappel une semaine avant l'échéance, un autre la veille, et la confirmation quand un renouvellement aboutit. Rien d'autre — ni promotions, ni nouveautés.",
    puce: "PAS ENCORE ACTIVÉES",
    puceFond: BLANC,
    puceEncre: ENCRE,
    avertissement:
      "Ton navigateur ne posera la question qu'une seule fois. Si tu refuses, nous ne pourrons plus jamais te la reposer : il faudra passer par ses réglages. Prends la seconde de réfléchir avant de cliquer.",
    avertissementFond: JAUNE,
    note: "Chaque abonné qui active est un SMS de relance que nous n'envoyons pas.",
  },
  actif: {
    pastille: VERT,
    glyphe: "✓",
    titre: "Les notifications sont actives",
    texte:
      "Tu recevras les relances d'échéance et les confirmations de renouvellement sur cet appareil. Elles s'arrêtent si tu te déconnectes ou si tu désinstalles l'application.",
    puce: "ACTIVES SUR CET APPAREIL",
    puceFond: VERT,
    puceEncre: ENCRE,
    avertissement:
      "Actives sur cet appareil seulement. Un autre navigateur ou un autre téléphone demande une activation séparée.",
    avertissementFond: LAVANDE,
    note: "Arrêter est réversible : tu pourras réactiver depuis cet écran, la permission reste acquise.",
  },
  refuse: {
    pastille: ORANGE,
    glyphe: "✕",
    titre: "Ton navigateur les bloque",
    texte:
      "La permission a été refusée, et nous ne pouvons plus la redemander — c'est le navigateur qui décide, pas nous. Rien de cassé de notre côté : le bouton a disparu parce qu'il n'aurait aucun effet.",
    puce: "REFUSÉES PAR LE NAVIGATEUR",
    puceFond: ORANGE,
    puceEncre: BLANC,
    avertissement:
      "Pour les rétablir : clique sur l'icône de cadenas à gauche de l'adresse, puis autorise les notifications pour ce site. Recharge ensuite cette page.",
    avertissementFond: JAUNE,
    note: "En attendant, les relances continuent d'arriver par courriel et par SMS.",
  },
  impossible: {
    pastille: GRIS,
    glyphe: "◍",
    titre: "Il faut d'abord installer Baobart",
    texte:
      "Sur iPhone et iPad, un site ouvert dans Safari ne peut pas envoyer de notifications. Une fois Baobart ajouté à ton écran d'accueil, il le peut — c'est une contrainte d'Apple, pas un choix de notre part.",
    puce: "INDISPONIBLE ICI",
    puceFond: GRIS,
    puceEncre: ENCRE,
    avertissement:
      "Ouvre le menu de partage en bas de Safari, puis « Sur l'écran d'accueil ». Rouvre Baobart depuis l'icône : le bouton d'activation apparaîtra ici.",
    avertissementFond: MAUVE,
    note: "",
  },
  "sans-cle": {
    pastille: GRIS,
    glyphe: "⚙",
    titre: "Les notifications ne sont pas encore branchées",
    texte:
      "Aucune clé n'est configurée côté serveur : le bouton échouerait, donc on ne le montre pas. Ce n'est pas ton appareil, c'est nous.",
    puce: "HORS SERVICE",
    puceFond: GRIS,
    puceEncre: ENCRE,
    avertissement:
      "Les relances d'échéance partent par courriel et par SMS en attendant. Aucune action de ta part n'est nécessaire.",
    avertissementFond: LAVANDE,
    note: "",
  },
};

export function Notifications({
  clePublique,
  relances,
}: {
  clePublique: string | null;
  /** Les paliers, tels que le moteur les tient. Voir `PALIERS`. */
  relances: readonly string[];
}) {
  const [etat, setEtat] = useState<Etat>("chargement");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [installee, setInstallee] = useState(false);
  const [invite, setInvite] = useState<BeforeInstallPromptEvent | null>(null);
  const [cachee, setCachee] = useState(false);

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

    await pousserVersLeServeur(abonnement);
    setEtat("actif");
  }, [clePublique]);

  useEffect(() => {
    void relire();

    // Installée ? Le mode d'affichage le dit, et `standalone` couvre iOS, qui
    // n'implémente pas `display-mode`.
    const autonome =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setInstallee(autonome);

    function surMessage(e: MessageEvent) {
      if (e.data?.type === "push-a-reinscrire") void relire();
    }
    navigator.serviceWorker?.addEventListener("message", surMessage);

    // Chrome nous donne l'invite d'installation, à condition de la retenir :
    // sans `preventDefault`, il l'affiche à sa façon et on perd la main.
    function surInvite(e: Event) {
      e.preventDefault();
      setInvite(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", surInvite);

    function surInstallation() {
      setInstallee(true);
      setInvite(null);
    }
    window.addEventListener("appinstalled", surInstallation);

    return () => {
      navigator.serviceWorker?.removeEventListener("message", surMessage);
      window.removeEventListener("beforeinstallprompt", surInvite);
      window.removeEventListener("appinstalled", surInstallation);
    };
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

      if (!(await pousserVersLeServeur(abonnement))) {
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

  if (etat === "chargement") return null;

  const a = ALLURES[etat];
  const bouton =
    etat === "inactif"
      ? { texte: "Activer les notifications", fond: JAUNE, faire: activer }
      : etat === "actif"
        ? { texte: "Arrêter les notifications", fond: BLANC, faire: desactiver }
        : null;

  return (
    <>
      <div
        style={{
          border: `3px solid ${ENCRE}`,
          borderRadius: 28,
          background: BLANC,
          boxShadow: `8px 8px 0 ${ENCRE}`,
          padding: 28,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 58,
              height: 58,
              flex: "0 0 auto",
              border: CADRE,
              borderRadius: 16,
              background: a.pastille,
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-display)",
              fontSize: 22,
            }}
          >
            {a.glyphe}
          </div>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(21px,2.5vw,28px)",
                lineHeight: 1.08,
                letterSpacing: "-1px",
                textTransform: "uppercase",
              }}
            >
              {a.titre}
            </div>
          </div>
          <div
            style={{
              flex: "0 0 auto",
              padding: "8px 15px",
              border: CADRE,
              borderRadius: 999,
              background: a.puceFond,
              color: a.puceEncre,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".08em",
              whiteSpace: "nowrap",
            }}
          >
            {a.puce}
          </div>
        </div>

        <p
          style={{
            fontSize: 15,
            fontWeight: 500,
            lineHeight: 1.55,
            margin: "16px 0 0",
            maxWidth: 640,
            opacity: 0.85,
            textWrap: "pretty",
          }}
        >
          {a.texte}
        </p>

        <div
          style={{
            display: "flex",
            gap: 13,
            marginTop: 18,
            padding: "16px 18px",
            border: CADRE,
            borderRadius: 18,
            background: a.avertissementFond,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              flex: "0 0 auto",
              border: `2px solid ${ENCRE}`,
              borderRadius: 99,
              background: BLANC,
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            !
          </div>
          <div
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              fontSize: 13.5,
              fontWeight: 700,
              lineHeight: 1.5,
              textWrap: "pretty",
            }}
          >
            {a.avertissement}
          </div>
        </div>

        {bouton ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 14,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={bouton.faire}
              disabled={enCours}
              className="sticker-press"
              style={{
                padding: "15px 26px",
                border: CADRE,
                borderRadius: 15,
                background: bouton.fond,
                boxShadow: `4px 4px 0 ${ENCRE}`,
                fontSize: 14.5,
                fontWeight: 800,
                cursor: enCours ? "wait" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {enCours ? "Un instant…" : bouton.texte}
            </button>
            {a.note ? (
              <div
                style={{
                  flex: "1 1 220px",
                  minWidth: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  lineHeight: 1.5,
                  opacity: 0.65,
                }}
              >
                {a.note}
              </div>
            ) : null}
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

        {/*
          Ce que la personne recevra, listé depuis le moteur lui-même.

          Les libellés viennent de `PALIERS`, jamais d'une chaîne recopiée :
          promettre « relance J−7 » et relancer à J−3 serait un mensonge que
          personne ne verrait — sauf l'abonné, une fois.
        */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            marginTop: 20,
            paddingTop: 18,
            borderTop: CADRE,
          }}
        >
          <div
            style={{
              flex: "1 1 240px",
              minWidth: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              lineHeight: 1.5,
              opacity: 0.6,
            }}
          >
            Ce que tu reçois, et rien de plus :
          </div>
          <div style={{ flex: "0 0 auto", display: "flex", flexWrap: "wrap", gap: 9 }}>
            {relances.map((r) => (
              <span
                key={r}
                style={{
                  padding: "8px 14px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 999,
                  background: "#F4EEFC",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {installee ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 16,
            marginTop: 22,
            padding: "20px 24px",
            border: CADRE,
            borderRadius: 24,
            background: VERT,
            boxShadow: `6px 6px 0 ${ENCRE}`,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              flex: "0 0 auto",
              border: CADRE,
              borderRadius: 99,
              background: BLANC,
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-display)",
              fontSize: 19,
            }}
          >
            ✓
          </div>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              Baobart est installée sur cet appareil
            </div>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                lineHeight: 1.45,
                marginTop: 4,
                opacity: 0.8,
              }}
            >
              Les notifications sont désormais possibles ici. Chaque abonné
              installé est un SMS de relance en moins.
            </div>
          </div>
        </div>
      ) : cachee ? null : (
        <Invitation
          invite={invite}
          surPlusTard={() => setCachee(true)}
          surInstallee={() => setInstallee(true)}
        />
      )}
    </>
  );
}

/**
 * L'invitation à installer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELLE RESTE MÊME SANS BOUTON
 *
 * Chrome fournit `beforeinstallprompt` ; Safari non — sur iOS, l'installation
 * passe par le menu de partage, et aucune API ne peut la déclencher. Masquer
 * l'invitation faute de bouton priverait précisément les utilisateurs pour qui
 * l'installation est la SEULE façon d'avoir des notifications.
 *
 * On garde donc le bloc, et l'on remplace le bouton par la marche à suivre.
 */
function Invitation({
  invite,
  surPlusTard,
  surInstallee,
}: {
  invite: BeforeInstallPromptEvent | null;
  surPlusTard: () => void;
  surInstallee: () => void;
}) {
  async function installer() {
    if (!invite) return;
    await invite.prompt();
    const choix = await invite.userChoice;
    if (choix.outcome === "accepted") surInstallee();
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 20,
        marginTop: 22,
        padding: 26,
        border: `3px solid ${ENCRE}`,
        borderRadius: 28,
        background: MAUVE,
        boxShadow: `8px 8px 0 ${ENCRE}`,
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          flex: "0 0 auto",
          border: `3px solid ${ENCRE}`,
          borderRadius: 24,
          background: JAUNE,
          boxShadow: `5px 5px 0 ${ENCRE}`,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/baobab-ink.svg" alt="" style={{ width: 54, display: "block" }} />
      </div>

      <div style={{ flex: "1 1 300px", minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: ".14em",
            opacity: 0.7,
          }}
        >
          Installer Baobart
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(22px,2.8vw,30px)",
            lineHeight: 1.05,
            letterSpacing: "-1.2px",
            marginTop: 8,
            textTransform: "uppercase",
          }}
        >
          Mets-nous sur ton écran d&apos;accueil
        </div>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            lineHeight: 1.5,
            marginTop: 11,
            maxWidth: 560,
            textWrap: "pretty",
          }}
        >
          Baobart s&apos;installe comme une application : elle s&apos;ouvre en
          plein écran, garde ta session, et c&apos;est le seul moyen de recevoir
          les relances sur iPhone. Aucun téléchargement depuis un magasin.
          {invite ? null : (
            <>
              {" "}
              <strong>
                Sur iPhone : le menu de partage, puis « Sur l&apos;écran
                d&apos;accueil ».
              </strong>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {invite ? (
          <button
            type="button"
            onClick={installer}
            className="sticker-press"
            style={{
              padding: "15px 26px",
              border: CADRE,
              borderRadius: 15,
              background: ENCRE,
              color: BLANC,
              boxShadow: `4px 4px 0 ${BLANC}`,
              fontSize: 14.5,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Installer
          </button>
        ) : null}
        <button
          type="button"
          onClick={surPlusTard}
          style={{
            padding: "13px 22px",
            border: CADRE,
            borderRadius: 15,
            background: BLANC,
            fontSize: 13.5,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Plus tard
        </button>
      </div>
    </div>
  );
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

/** Chrome seulement. TypeScript ne la connaît pas : elle n'est pas normalisée. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
