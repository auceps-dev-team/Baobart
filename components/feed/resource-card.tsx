"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import type { CarteRessource } from "@/lib/feed/types";
import { formatCount } from "@/lib/i18n/money";

/**
 * Carte de ressource du feed.
 *
 * Traduction fidèle du balisage de « Baobart Accueil.dc.html » (bloc
 * `data-masonry` et grille `featured`) et de sa fonction `decorate`.
 * Les valeurs sont écrites en dur parce que ce sont celles de la maquette :
 * les passer par des utilitaires les ferait dériver au premier refactor.
 */

export type StyleCarte = "Sticker" | "Contour fin" | "Image pleine";

const ENCRE = "#121212";

/** Reprend `decorate()` de la maquette, à l'identique. */
export function decorer(style: StyleCarte, aUneImage: boolean, survolee: boolean) {
  const fin = style === "Contour fin";
  const photo = style === "Image pleine";

  return {
    bd: fin ? `1.5px solid ${ENCRE}` : `2.5px solid ${ENCRE}`,
    sh: fin ? "0 8px 20px rgba(18,18,18,.16)" : `4px 4px 0 ${ENCRE}`,
    shBig: fin ? "0 14px 30px rgba(18,18,18,.18)" : `6px 6px 0 ${ENCRE}`,
    chipShow: aUneImage ? "none" : "inline-block",
    // En « image pleine », les informations n'apparaissent qu'au survol.
    showInfo: photo ? survolee : true,
  };
}

/** Trame diagonale de repli quand la ressource n'a pas encore de visuel. */
function trameDe(id: string): string {
  const teintes = ["#C9A8F5", "#FFD84A", "#E2622C", "#EADFF9", "#F4EEFC"];
  let somme = 0;
  for (let i = 0; i < id.length; i += 1) somme += id.charCodeAt(i);
  const accent = teintes[somme % teintes.length] as string;
  return `repeating-linear-gradient(135deg, ${accent} 0 8px, #FFFFFF 8px 18px)`;
}

/**
 * Le signe du format, sur une carte qui n'a pas de visuel.
 *
 * Une vidéo et une police sans couverture affichaient exactement la même
 * trame : on ne pouvait pas savoir, avant de cliquer, si l'on regardait un
 * motion design ou un fichier de fontes. Dire « ▶ » ne remplace pas un
 * aperçu, mais c'est une information vraie, et elle coûte un caractère.
 *
 * On ne met rien sur les familles qui devraient, elles, avoir une image :
 * une illustration sans visuel est une fiche incomplète, et lui coller un
 * pictogramme masquerait ce qu'il faut corriger.
 */
function glypheDe(famille: string | null): string {
  if (famille === "Vidéo") return "▶ ";
  if (famille === "Audio") return "♪ ";
  return "";
}

/**
 * L'extrait vidéo, joué au survol, à la place de la trame.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RIEN NE SE CHARGE AVANT LE SURVOL
 *
 * C'est la contrainte qui décide de tout le reste. Une page de feed porte
 * vingt-quatre cartes ; vingt-quatre vidéos qui se chargent à l'ouverture
 * coûteraient des dizaines de mégaoctets — sur une connexion mobile ivoirienne,
 * la page ne s'afficherait jamais.
 *
 * `preload="none"` : le navigateur ne demande rien tant qu'on n'a pas appelé
 * `play()`. La première image apparaît donc au survol, pas avant. C'est un
 * compromis assumé — la carte au repos reste une trame — mais l'inverse
 * rendrait le feed inutilisable.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * MUETTE, ET C'EST CE QUI PERMET LA LECTURE AUTOMATIQUE
 *
 * Les navigateurs refusent `play()` sur une vidéo sonore que l'internaute n'a
 * pas explicitement lancée. `muted` lève ce refus — et c'est de toute façon ce
 * qu'on veut : vingt-quatre cartes qui se mettent à parler au passage de la
 * souris seraient insupportables. Le son s'écoute sur la fiche.
 *
 * `play()` rend une promesse qui **rejette** quand on quitte la carte avant
 * qu'elle n'aboutisse. On l'avale : ce n'est pas un incident, c'est une souris
 * qui passe.
 */
function ApercuVideo({
  url,
  actif,
  hauteur,
}: {
  url: string;
  actif: boolean;
  hauteur: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    if (actif) {
      void v.play().catch(() => {});
    } else {
      v.pause();
      // Retour à l'image de la vignette, pas à zéro : c'est celle que la carte
      // montrait avant le survol (voir le `#t=0.5` ci-dessous), et y revenir
      // évite qu'elle change d'aspect après qu'on l'a survolée une fois.
      v.currentTime = 0.5;
    }
  }, [actif]);

  return (
    <video
      ref={ref}
      /*
        ══════════════════════════════════════════════════════════════════════
        LE FRAGMENT `#t=` EST CE QUI DONNE UNE VIGNETTE

        Sans lui, une carte vidéo au repos était un rectangle noir. Le
        diagnostic tenait en deux valeurs relevées dans la page :
        `readyState = 0`, `videoWidth = 0` — l'élément existait, aucune image
        n'avait jamais été décodée.

        La cause était `preload="none"`, qui ne télécharge rien avant la
        lecture. Rien ne plantait : la balise était bien là, à la bonne taille,
        et elle jouait parfaitement au survol. Seule l'image fixe manquait, et
        une image manquante ne lève aucune erreur.

        `preload="metadata"` seul ne suffit pas : il lit l'en-tête et s'arrête
        avant la première image. C'est le fragment `#t=0.5` qui demande au
        navigateur de se placer à cette seconde-là, donc de décoder l'image
        qui s'y trouve et de la peindre.

        Une demi-seconde plutôt que zéro : beaucoup de vidéos ouvrent sur un
        fondu au noir, et `#t=0` rendrait la vignette noire pour une tout
        autre raison.

        Ce que cela coûte : l'en-tête et quelques kilo-octets par vidéo, au
        lieu de rien. Ce que cela évite : une miniature de fichier `poster`
        à fabriquer, qu'il aurait fallu générer avec ffmpeg — absent de cette
        machine — et surtout produire pour chaque vidéo téléversée par un
        créateur. Ici la règle vaut pour toutes, y compris celles qui n'ont
        pas encore été mises en ligne.
      */
      src={`${url}#t=0.5`}
      muted
      loop
      playsInline
      preload="metadata"
      style={{
        width: "100%",
        height: hauteur,
        objectFit: "cover",
        display: "block",
        // Transparent, et non noir : derrière, le conteneur porte déjà la
        // trame diagonale de la carte. Tant que l'image n'est pas décodée,
        // on voit la trame — qui ressemble à une carte — plutôt qu'un carré
        // noir, qui ressemble à une panne.
        background: "transparent",
      }}
    />
  );
}

interface ActionsProps {
  taille: number;
  rayon: number;
  ecart: number;
  decalage: number;
  aime: boolean;
  epingle: boolean;
  onLike: () => void;
  onSave: () => void;
}

function ActionsSurvol({
  taille,
  rayon,
  ecart,
  decalage,
  aime,
  epingle,
  onLike,
  onSave,
}: ActionsProps) {
  const bouton = (fond: string): CSSProperties => ({
    width: taille,
    height: taille,
    border: `2.5px solid ${ENCRE}`,
    borderRadius: rayon,
    background: fond,
    display: "grid",
    placeItems: "center",
    fontSize: taille >= 40 ? 15 : 13,
    fontWeight: 800,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: decalage,
        right: decalage,
        display: "flex",
        gap: ecart,
        animation: "popin .14s ease-out",
      }}
    >
      <button
        type="button"
        aria-label={aime ? "Retirer le like" : "Aimer"}
        aria-pressed={aime}
        onClick={(e) => {
          // `preventDefault` autant que `stopPropagation` : la carte entière
          // est un lien, et arrêter la propagation n'annule pas l'action par
          // défaut de l'ancre. Sans lui, aimer une carte ouvre sa fiche.
          e.preventDefault();
          e.stopPropagation();
          onLike();
        }}
        style={bouton(aime ? "#E2622C" : "#FFFFFF")}
      >
        ♥
      </button>
      <button
        type="button"
        aria-label={epingle ? "Retirer du tableau" : "Épingler"}
        aria-pressed={epingle}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSave();
        }}
        style={bouton(epingle ? "#FFD84A" : "#FFFFFF")}
      >
        ⌸
      </button>
      <button
        type="button"
        aria-label="Télécharger"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={bouton("#FFFFFF")}
      >
        ↓
      </button>
    </div>
  );
}

/**
 * Pastille de sélection éditoriale.
 *
 * `isStaffPicked` vivait dans les données et dans le feed sans jamais
 * atteindre l'écran : une distinction qu'on accorde à un créateur doit se voir.
 */
function PastilleSelection({ compacte }: { compacte: boolean }) {
  return (
    <span
      style={{
        position: "absolute",
        left: compacte ? 10 : 14,
        top: compacte ? 10 : 14,
        padding: compacte ? "5px 9px" : "6px 11px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 999,
        background: "#FFD84A",
        fontFamily: "var(--font-mono)",
        fontSize: compacte ? 10 : 11,
        fontWeight: 800,
      }}
    >
      ★ {compacte ? "Sélection" : "Sélection éditoriale"}
    </span>
  );
}

export interface CarteProps {
  ressource: CarteRessource;
  style: StyleCarte;
  survolee: boolean;
  aime: boolean;
  epingle: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onLike: () => void;
  onSave: () => void;
  onOpen: () => void;
}

/** Carte de la mosaïque. */
export function CarteMosaique(props: CarteProps) {
  const { ressource: r, style, survolee } = props;
  const d = decorer(style, r.coverUrl !== null, survolee);
  const prixGratuit = r.offerte;

  // L'extrait ne remplace que ce qui manque : une couverture choisie par le
  // créateur passe avant, toujours. On ne joue que la vidéo — un fichier audio
  // n'a rien à montrer, il garde son « ♪ ».
  const apercuVideo =
    !r.coverUrl && r.extrait?.nature === "video" ? r.extrait.url : null;

  return (
    <div
      onClick={props.onOpen}
      onMouseEnter={props.onEnter}
      onMouseLeave={props.onLeave}
      style={{
        breakInside: "avoid",
        marginBottom: 20,
        borderRadius: 20,
        background: "#FFFFFF",
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        display: "inline-block",
        width: "100%",
        border: d.bd,
        boxShadow: d.sh,
      }}
    >
      <div
        style={{
          borderBottom: d.bd,
          display: "grid",
          placeItems: "center",
          padding: apercuVideo ? 0 : 8,
          height: r.visualHeight,
          position: "relative",
          overflow: "hidden",
          background: r.coverUrl
            ? `center / cover no-repeat url(${r.coverUrl})`
            : trameDe(r.id),
        }}
      >
        {apercuVideo ? (
          <div style={{ position: "absolute", inset: 0 }}>
            <ApercuVideo
              url={apercuVideo}
              actif={survolee}
              hauteur={r.visualHeight}
            />
          </div>
        ) : null}

        {r.isStaffPicked ? <PastilleSelection compacte /> : null}
        <span
          style={{
            padding: "6px 12px",
            // Le cartouche disparaît pendant la lecture : il masquerait
            // l'image même qu'on est venu regarder.
            display: apercuVideo && survolee ? "none" : d.chipShow,
            border: `2px solid ${ENCRE}`,
            borderRadius: 999,
            background: "#FFFFFF",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textAlign: "center",
            position: "relative",
          }}
        >
          {glypheDe(r.famille)}
          {r.title}
        </span>
      </div>

      {d.showInfo ? (
        <div
          style={{
            padding: "12px 13px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}>
              {r.title}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.65 }}>
              {r.author}
              {r.famille ? ` · ${r.famille}` : ""}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                opacity: 0.55,
                marginTop: 2,
              }}
            >
              {formatCount(r.downloadsCount)} dl · {formatCount(r.salesCount)} ventes
            </div>
          </div>
          <div
            style={{
              padding: "5px 10px",
              border: `2px solid ${ENCRE}`,
              borderRadius: 9,
              fontSize: 11,
              fontWeight: 800,
              background: prixGratuit ? "#FFD84A" : "#FFFFFF",
              whiteSpace: "nowrap",
            }}
          >
            {r.prixAffiche}
          </div>
        </div>
      ) : null}

      {survolee ? (
        <ActionsSurvol
          taille={34}
          rayon={10}
          ecart={6}
          decalage={10}
          aime={props.aime}
          epingle={props.epingle}
          onLike={props.onLike}
          onSave={props.onSave}
        />
      ) : null}
    </div>
  );
}

/** Carte mise en avant, au-dessus de la mosaïque. */
export function CarteAlaUne(props: CarteProps) {
  const { ressource: r, style, survolee } = props;
  const d = decorer(style, r.coverUrl !== null, survolee);
  const prixGratuit = r.offerte;

  // Même règle que la mosaïque : l'extrait ne comble qu'une couverture absente.
  const apercuVideo =
    !r.coverUrl && r.extrait?.nature === "video" ? r.extrait.url : null;

  return (
    <div
      onClick={props.onOpen}
      onMouseEnter={props.onEnter}
      onMouseLeave={props.onLeave}
      style={{
        borderRadius: 24,
        background: "#FFFFFF",
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        border: d.bd,
        boxShadow: d.shBig,
      }}
    >
      <div
        style={{
          height: 280,
          borderBottom: d.bd,
          display: "grid",
          placeItems: "center",
          position: "relative",
          overflow: "hidden",
          background: r.coverUrl
            ? `center / cover no-repeat url(${r.coverUrl})`
            : trameDe(r.id),
        }}
      >
        {apercuVideo ? (
          <div style={{ position: "absolute", inset: 0 }}>
            <ApercuVideo url={apercuVideo} actif={survolee} hauteur={280} />
          </div>
        ) : null}

        {r.isStaffPicked ? <PastilleSelection compacte={false} /> : null}
        <span
          style={{
            padding: "7px 14px",
            display: apercuVideo && survolee ? "none" : d.chipShow,
            border: `2px solid ${ENCRE}`,
            borderRadius: 999,
            background: "#FFFFFF",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            position: "relative",
          }}
        >
          {glypheDe(r.famille)}
          {r.title}
        </span>
      </div>

      {d.showInfo ? (
        <div
          style={{
            padding: 16,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div style={{ flex: "1 1 auto" }}>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>
              {r.title}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.7 }}>
              par {r.author}
              {r.famille ? ` · ${r.famille}` : ""}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                opacity: 0.58,
                marginTop: 4,
              }}
            >
              {formatCount(r.downloadsCount)} téléchargements ·{" "}
              {formatCount(r.salesCount)} ventes
            </div>
          </div>
          <div
            style={{
              padding: "8px 14px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 11,
              fontSize: 13,
              fontWeight: 800,
              background: prixGratuit ? "#FFD84A" : "#FFFFFF",
              whiteSpace: "nowrap",
            }}
          >
            {r.prixAffiche}
          </div>
        </div>
      ) : null}

      {survolee ? (
        <ActionsSurvol
          taille={40}
          rayon={12}
          ecart={8}
          decalage={14}
          aime={props.aime}
          epingle={props.epingle}
          onLike={props.onLike}
          onSave={props.onSave}
        />
      ) : null}
    </div>
  );
}
