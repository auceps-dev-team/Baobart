import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, ORANGE } from "@/lib/systeme/charte";

/**
 * Le cadre commun des écrans qui s'affichent quand le cadre habituel a échoué.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI CES ÉCRANS SONT À PART
 *
 * Une page 404 ou une page d'erreur ne peut pas s'appuyer sur ce qui l'entoure :
 * elle s'affiche justement parce que quelque chose n'a pas abouti. Elle ne lit
 * donc ni session, ni base, ni configuration — elle n'a besoin de rien pour
 * fonctionner, et c'est sa seule qualité qui compte.
 *
 * Traduit de « Baobart Parcours Achat.dc.html ».
 */

export interface ActionEtat {
  label: string;
  href: Route;
  /** La première action est pleine, les suivantes creuses. */
  principale?: boolean;
}

export function EcranEtat({
  glyphe,
  fondGlyphe,
  kicker,
  titre,
  texte,
  actions,
  children,
}: {
  glyphe: string;
  fondGlyphe: string;
  kicker: string;
  titre: string;
  texte: string;
  actions: ActionEtat[];
  /** Le bloc propre à l'écran — une référence d'incident, des suggestions. */
  children?: ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: LAVANDE,
        display: "grid",
        placeItems: "center",
        padding: "48px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        <div
          style={{
            border: CADRE,
            borderRadius: 24,
            background: BLANC,
            boxShadow: `8px 8px 0 ${ENCRE}`,
            padding: 32,
          }}
        >
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div
              style={{
                width: 54,
                height: 54,
                flex: "0 0 auto",
                border: CADRE,
                borderRadius: 99,
                background: fondGlyphe,
                display: "grid",
                placeItems: "center",
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              {glyphe}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: ".8px",
                  textTransform: "uppercase",
                  opacity: 0.65,
                }}
              >
                {kicker}
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 30,
                  lineHeight: 1.1,
                  letterSpacing: "-.7px",
                  textTransform: "uppercase",
                  margin: "6px 0 0",
                }}
              >
                {titre}
              </h1>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  lineHeight: 1.6,
                  margin: "14px 0 0",
                  textWrap: "pretty",
                }}
              >
                {texte}
              </p>
            </div>
          </div>

          {children}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
            {actions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="sticker-press"
                style={{
                  padding: "12px 18px",
                  border: CADRE,
                  borderRadius: 14,
                  background: a.principale ? ENCRE : BLANC,
                  color: a.principale ? BLANC : ENCRE,
                  fontSize: 14,
                  fontWeight: 800,
                  boxShadow: a.principale ? `4px 4px 0 ${ORANGE}` : undefined,
                }}
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Le bloc de référence, commun au 404 et à l'erreur.
 *
 * Sa raison d'être tient en une phrase de la maquette : « à citer si tu écris
 * au support — elle nous mène directement à la trace ». Sans elle, un incident
 * signalé se cherche à la main dans les journaux.
 */
export function BlocReference({
  libelle,
  valeur,
  note,
}: {
  libelle: string;
  valeur: string;
  note: string;
}) {
  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        border: CADRE,
        borderRadius: 16,
        background: JAUNE,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px" }}>
        {libelle}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 18,
          fontWeight: 700,
          marginTop: 6,
          wordBreak: "break-all",
        }}
      >
        {valeur}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.75, marginTop: 8 }}>
        {note}
      </div>
    </div>
  );
}
