"use client";

import { useEffect, useRef, useState } from "react";

import { decorer, type StyleCarte } from "@/components/feed/resource-card";
import type { PubCarte } from "@/lib/publicites/types";

const ENCRE = "#121212";
const JAUNE = "#FFD84A";

/** Les bordures haute et basse de la carte, en « sticker » : 2 × 2,5 px. */
export const BORDURES_BANNIERE = 5;

/** La hauteur d'une bannière dans une colonne, avant tout chargement. */
export function hauteurDeBanniere(pub: Pick<PubCarte, "largeur" | "hauteur">, largeurColonne: number): number {
  return (largeurColonne * pub.hauteur) / Math.max(1, pub.largeur) + BORDURES_BANNIERE;
}

/**
 * Une bannière dans la mosaïque.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE SE DIT PUBLICITÉ, TOUJOURS
 *
 * La pastille n'est pas décorative. Une bannière qui ressemble à une carte de
 * ressource sans le dire est une publicité déguisée — et un visiteur qui s'en
 * aperçoit cesse de faire confiance aux cartes qui l'entourent. Le plugin
 * l'affichait aussi (« Publicité »).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN VRAI LIEN, MAIS QUI PASSE PAR NOUS
 *
 * `/api/pub/…/clic` compte le clic puis redirige. `rel="sponsored"` dit aux
 * moteurs de recherche que ce lien est payé, `nofollow` qu'il ne faut pas le
 * suivre — un robot qui le suivrait gonflerait les clics.
 */
export function Banniere({
  pub,
  style = "Sticker",
  apercu = false,
  rang,
}: {
  pub: PubCarte;
  style?: StyleCarte;
  /** Dans le formulaire : ni lien, ni mesure. */
  apercu?: boolean;
  /** Après quel produit elle tombe — lisible dans la page, pour vérifier le placement. */
  rang?: number;
}) {
  const [survolee, setSurvolee] = useState(false);
  const d = decorer(style, true, survolee);
  const ref = useRef<HTMLAnchorElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    let vue = apercu;
    const calme = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const observateur = new IntersectionObserver(
      ([entree]) => {
        const visible = (entree?.intersectionRatio ?? 0) >= 0.5;
        if (visible && !vue) {
          vue = true;
          signalerVue(pub.id);
        }
        // La vidéo ne joue qu'à l'écran : cinquante vidéos qui tournent hors
        // champ videraient le forfait d'un téléphone. Et jamais pour qui a
        // demandé moins d'animations à son système.
        const v = video.current;
        if (v && !calme) {
          if (visible) void v.play().catch(() => {});
          else v.pause();
        }
      },
      { threshold: [0, 0.5] },
    );
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [pub.id, apercu]);

  return (
    <a
      ref={ref}
      href={apercu ? undefined : `/api/pub/${pub.id}/clic`}
      rel="sponsored nofollow noopener"
      target={!apercu && pub.exterieure ? "_blank" : undefined}
      data-pub={pub.id}
      data-rang={rang}
      onMouseEnter={() => setSurvolee(true)}
      onMouseLeave={() => setSurvolee(false)}
      style={{
        display: "block",
        position: "relative",
        marginBottom: 20,
        borderRadius: 20,
        overflow: "hidden",
        background: "#F4EEFC",
        border: d.bd,
        boxShadow: survolee ? d.shBig : d.sh,
        transform: survolee ? "translate(-2px, -2px)" : "none",
        transition: "transform .18s ease, box-shadow .18s ease",
        color: ENCRE,
      }}
    >
      {pub.nature === "VIDEO" && pub.videoUrl ? (
        <video
          ref={(v) => {
            video.current = v;
            // `muted` en attribut React ne se rend pas toujours dans le HTML ;
            // sans lui, le navigateur refuse la lecture automatique.
            if (v) v.muted = true;
          }}
          src={pub.videoUrl}
          poster={pub.imageUrl}
          muted
          loop
          playsInline
          preload="none"
          aria-label={pub.titre}
          style={{
            display: "block",
            width: "100%",
            aspectRatio: `${pub.largeur} / ${pub.hauteur}`,
            objectFit: "cover",
          }}
        />
      ) : (
        // `width` et `height` réservent la place avant le chargement ; une
        // fois l'image arrivée, ce sont ses vraies proportions qui comptent
        // (`height: auto`). Une estimation fausse ne déforme donc rien.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pub.imageUrl}
          alt={pub.titre}
          width={pub.largeur}
          height={pub.hauteur}
          loading="lazy"
          decoding="async"
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            transform: survolee ? "scale(1.03)" : "none",
            transition: "transform .35s ease",
          }}
        />
      )}

      <span
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          padding: "4px 10px",
          border: `2px solid ${ENCRE}`,
          borderRadius: 999,
          background: JAUNE,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".1em",
        }}
      >
        Publicité
      </span>
    </a>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * LES AFFICHAGES PARTENT GROUPÉS
 *
 * Une file commune à toutes les bannières de la page, vidée deux secondes
 * après la première vue, et une dernière fois quand on quitte la page —
 * `sendBeacon` est fait pour ça : le navigateur l'envoie même si l'onglet se
 * ferme.
 * ══════════════════════════════════════════════════════════════════════════ */

let enAttente: string[] = [];
let minuterie: ReturnType<typeof setTimeout> | null = null;
let ecoute = false;

function signalerVue(id: string): void {
  enAttente.push(id);
  if (!ecoute) {
    ecoute = true;
    window.addEventListener("pagehide", vider);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") vider();
    });
  }
  minuterie ??= setTimeout(vider, 2000);
}

function vider(): void {
  if (minuterie) clearTimeout(minuterie);
  minuterie = null;
  if (enAttente.length === 0) return;

  const corps = JSON.stringify({ ids: enAttente });
  enAttente = [];
  const blob = new Blob([corps], { type: "application/json" });
  if (!navigator.sendBeacon?.("/api/pub/vues", blob)) {
    void fetch("/api/pub/vues", { method: "POST", body: corps, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
  }
}
