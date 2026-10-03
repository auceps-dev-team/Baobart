import type { ReactNode } from "react";

import {
  BANDEAU,
  CADRE,
  ENCRE,
  TON,
  type TonGravite,
} from "@/lib/systeme/charte";
import type { Gravite } from "@/lib/systeme/diagnostic";

/**
 * Les briques communes aux trois écrans de l'espace système.
 *
 * Elles suivent `Baobart Design/Baobart Dashboard.dc.html` au pixel : cadre de
 * 2,5 px, ombre portée à 45°, pastilles en Space Mono capitales.
 */

export interface Puce {
  texte: string;
  fond: string;
}

/** Le bandeau de tête : une gravité, une phrase, des compteurs. */
export function BandeauGravite({
  gravite,
  puces = [],
}: {
  gravite: Gravite;
  puces?: Puce[];
}) {
  const b = BANDEAU[gravite];

  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        padding: "20px 22px",
        border: CADRE,
        borderRadius: 22,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        background: b.fond,
        color: b.encre,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 46,
          height: 46,
          flex: "0 0 auto",
          border: CADRE,
          borderRadius: 99,
          background: b.medaillon,
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--font-display)",
          fontSize: 20,
          color: ENCRE,
        }}
      >
        {b.glyphe}
      </div>

      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: ".14em",
            opacity: 0.7,
          }}
        >
          {b.surtitre}
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(19px,2.1vw,26px)",
            lineHeight: 1.1,
            letterSpacing: "-.7px",
            marginTop: 5,
          }}
        >
          {b.texte}
        </div>
      </div>

      {puces.length > 0 ? (
        <div
          // Rétrécissable : en `0 0 auto`, le groupe gardait la largeur de ses
          // puces sur une ligne, et ne passait jamais à la ligne sur téléphone.
          style={{ flex: "0 1 auto", minWidth: 0, display: "flex", flexWrap: "wrap", gap: 9 }}
        >
          {puces.map((p) => (
            <div
              key={p.texte}
              style={{
                padding: "8px 14px",
                border: CADRE,
                borderRadius: 999,
                background: p.fond,
                color: ENCRE,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              {p.texte}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Phrase d'introduction — ce que l'écran surveille, en une respiration. */
export function Intro({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 15,
        fontWeight: 600,
        opacity: 0.75,
        maxWidth: 760,
        textWrap: "pretty",
      }}
    >
      {children}
    </p>
  );
}

/** Panneau blanc à ombre portée, avec son titre et sa mention de fraîcheur. */
export function Panneau({
  titre,
  mention,
  fond = "#FFFFFF",
  children,
}: {
  titre: string;
  mention?: string;
  fond?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: CADRE,
        borderRadius: 24,
        background: fond,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, flex: "1 1 auto" }}>
          {titre}
        </div>
        {mention ? (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              opacity: 0.6,
            }}
          >
            {mention}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function PastilleEtat({
  gravite,
  texte,
}: {
  gravite: Gravite;
  /** Remplace le mot par défaut — « ENVOYÉ » plutôt que « OK ». La couleur,
   *  elle, reste celle de la gravité : c'est le code que l'œil apprend. */
  texte?: string;
}) {
  const t: TonGravite = TON[gravite];
  return (
    <span
      style={{
        flex: "0 0 auto",
        padding: "6px 13px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 999,
        background: t.pastilleFond,
        color: t.pastilleEncre,
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".08em",
        alignSelf: "flex-start",
        whiteSpace: "nowrap",
      }}
    >
      {texte ?? t.mot}
    </span>
  );
}

export interface CompteurAffiche {
  cle: string;
  libelle: string;
  valeur: string;
  note: string;
  gravite: Gravite;
}

/**
 * Les chiffres de tête.
 *
 * Le point coloré porte la gravité, pas le fond de la carte : quatre cartes
 * orange côte à côte ne se distinguent plus, et l'œil ne sait plus laquelle
 * regarder en premier.
 */
export function Compteurs({ liste }: { liste: CompteurAffiche[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(215px,1fr))",
        gap: 16,
      }}
    >
      {liste.map((c) => (
        <div
          key={c.cle}
          style={{
            border: CADRE,
            borderRadius: 20,
            boxShadow: `5px 5px 0 ${ENCRE}`,
            padding: 18,
            background: "#FFFFFF",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              aria-hidden
              style={{
                width: 11,
                height: 11,
                flex: "0 0 auto",
                border: `2px solid ${ENCRE}`,
                borderRadius: 99,
                background: TON[c.gravite].pastilleFond,
              }}
            />
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: ".1em",
                opacity: 0.75,
              }}
            >
              {c.libelle}
            </div>
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              lineHeight: 1.05,
              marginTop: 9,
            }}
          >
            {c.valeur}
          </div>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              lineHeight: 1.35,
              marginTop: 5,
              opacity: 0.78,
            }}
          >
            {c.note}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Le pied : qui regarde, et ce qu'il doit savoir avant d'agir. */
export function PiedEcran({
  libelle,
  qui,
  note,
}: {
  libelle: string;
  qui: string;
  note: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        alignItems: "center",
        padding: "18px 20px",
        border: CADRE,
        borderRadius: 20,
        background: "#FFFFFF",
      }}
    >
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: ".12em",
            opacity: 0.6,
          }}
        >
          {libelle}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>{qui}</div>
      </div>
      <div
        style={{
          flex: "2 1 340px",
          minWidth: 0,
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.45,
          opacity: 0.8,
          textWrap: "pretty",
        }}
      >
        {note}
      </div>
    </div>
  );
}
