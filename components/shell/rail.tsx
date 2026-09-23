"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  BLANC,
  ENCRE,
  ENTREES_RAIL,
  JAUNE,
  LAVANDE,
  LAVANDE_CLAIR,
  ORANGE,
  RESEAUX,
} from "@/components/shell/nav-data";
import type { Filtre } from "@/lib/feed/types";

/**
 * Rail latéral fixe.
 *
 * Traduction du bloc `data-rail` de « Baobart Accueil.dc.html ». Il est replié
 * à 78 px et s'ouvre à 230 px — au survol, ou verrouillé par un clic sur le
 * logo, exactement comme la maquette (`railOpen` / `railPinned`).
 *
 * Masqué sous 1180 px par la règle `[data-rail]` de globals.css : c'est la
 * maquette qui le décide, pas nous.
 */
export function Rail({
  filtreActif = "Tous",
  onOuvertureChange,
}: {
  filtreActif?: Filtre;
  onOuvertureChange?: (ouvert: boolean) => void;
}) {
  const [survole, setSurvole] = useState(false);
  const [verrouille, setVerrouille] = useState(false);
  const ouvert = survole || verrouille;

  // Le décalage de la page suit l'ouverture du rail (voir HomeShell).
  useEffect(() => {
    onOuvertureChange?.(ouvert);
  }, [ouvert, onOuvertureChange]);

  return (
    <div
      data-rail="1"
      onMouseEnter={() => setSurvole(true)}
      onMouseLeave={() => setSurvole(false)}
      style={{
        position: "fixed",
        left: 18,
        top: 104,
        bottom: 24,
        zIndex: 45,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        border: `2.5px solid ${ENCRE}`,
        borderRadius: 22,
        background: BLANC,
        boxShadow: `5px 5px 0 ${ENCRE}`,
        padding: "12px 11px",
        overflow: "hidden",
        transition: "width .18s ease",
        width: ouvert ? 230 : 78,
      }}
    >
      <button
        type="button"
        onClick={() => setVerrouille((v) => !v)}
        aria-label={verrouille ? "Déverrouiller le rail" : "Verrouiller le rail ouvert"}
        aria-pressed={verrouille}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          padding: "4px 4px 10px",
          borderBottom: `2.5px solid ${ENCRE}`,
          background: "none",
          border: "none",
          borderBottomWidth: 2.5,
          borderBottomStyle: "solid",
          borderBottomColor: ENCRE,
          width: "100%",
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            flex: "0 0 auto",
            border: `2.5px solid ${ENCRE}`,
            borderRadius: 11,
            background: JAUNE,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          {/*
            LA MAQUETTE ÉCRIT « B », ET C'EST DÉLIBÉRÉMENT QU'ON NE LA SUIT PAS

            « Baobart Accueil.dc.html » ligne 47 met la lettre B dans ce carré
            jaune, là où son en-tête (ligne 78) met déjà `baobab-white.svg`.
            Deux marques différentes pour la même application : la lettre est
            un provisoire de maquette, pas une décision de charte.

            L'encre plutôt que le blanc : le carré est jaune (#FFD84A), et un
            baobab blanc dessus ne se voit pas. C'est la même raison qui fait
            que l'en-tête prend le blanc — son cercle, lui, est orange.
          */}
          <Image
            src="/img/baobab-ink.svg"
            alt="Baobart"
            width={22}
            height={22}
            style={{ width: 22, height: "auto", display: "block" }}
          />
        </span>
        {ouvert ? (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              whiteSpace: "nowrap",
            }}
          >
            Baobart<span style={{ color: ORANGE }}>.</span>
          </span>
        ) : null}
      </button>

      <nav
        data-rail-nav="1"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
        }}
      >
        {ENTREES_RAIL.map((n) => {
          const actif = n.filtre === filtreActif;
          return (
            <Link
              key={n.label}
              href={
                n.filtre === "Tous"
                  ? "/explore"
                  : `/explore?filtre=${encodeURIComponent(n.filtre)}`
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "7px 6px",
                borderRadius: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: actif ? JAUNE : "transparent",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  flex: "0 0 auto",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 15,
                  fontWeight: 800,
                  background: actif ? BLANC : LAVANDE,
                }}
              >
                {n.glyph}
              </span>
              {ouvert ? (
                <span style={{ fontSize: 14, fontWeight: 800 }}>{n.label}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {ouvert ? (
        <div
          style={{
            display: "flex",
            flexWrap: "nowrap",
            gap: 8,
            flex: "0 0 auto",
            overflow: "hidden",
            paddingTop: 10,
            borderTop: `2.5px solid ${ENCRE}`,
          }}
        >
          {RESEAUX.map((s) => (
            <span
              key={s}
              style={{
                width: 26,
                height: 26,
                flex: "0 0 auto",
                border: `2px solid ${ENCRE}`,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                background: LAVANDE_CLAIR,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
