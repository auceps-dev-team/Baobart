"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * LE RAIL CACHAIT SES DERNIÈRES ENTRÉES SANS LE DIRE
   *
   * Mesuré le 23 septembre 2026, sur `/explore` :
   *
   *   1080 px de haut   onze entrées, onze visibles
   *    900 px           onze entrées, onze visibles
   *    768 px           onze entrées, **dix** visibles
   *
   * La liste défile — `overflowY: auto` est bien là — mais la maquette masque
   * la barre de défilement (`scrollbar-width: none`, ligne 53 de
   * « Baobart Accueil.dc.html »), et rien d'autre ne signale qu'il y a une
   * suite. Sur un portable, « Vidéos » n'existait tout simplement pas : elle
   * est la dernière de la liste, donc la première à disparaître.
   *
   * On garde la barre masquée — c'est la maquette — et l'on ajoute le seul
   * signal qui manquait : un dégradé en bas, visible uniquement quand il
   * reste quelque chose à voir.
   *
   * Recalculé au redimensionnement ET au défilement : un dégradé qui resterait
   * allumé en bas de liste dirait « il y a encore quelque chose » alors qu'on
   * est arrivé au bout.
   */
  const listeRef = useRef<HTMLElement>(null);
  const [resteDessous, setResteDessous] = useState(false);

  useEffect(() => {
    const liste = listeRef.current;
    if (!liste) return;

    const mesurer = () => {
      // Deux pixels de tolérance : les hauteurs fractionnaires d'un zoom
      // navigateur laisseraient sinon le dégradé allumé en permanence.
      setResteDessous(
        liste.scrollHeight - liste.scrollTop - liste.clientHeight > 2,
      );
    };

    mesurer();
    liste.addEventListener("scroll", mesurer, { passive: true });

    const observateur = new ResizeObserver(mesurer);
    observateur.observe(liste);

    return () => {
      liste.removeEventListener("scroll", mesurer);
      observateur.disconnect();
    };
  }, []);

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
        // Sous l'en-tête, quelle que soit sa hauteur — voir header.tsx.
        top: "var(--bas-entete, 104px)",
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
        className="logo-anime"
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
        {/*
          ══════════════════════════════════════════════════════════════════
          LA MÊME MARQUE QUE L'EN-TÊTE, AU PIXEL PRÈS

          La maquette met la lettre « B » dans un carré jaune ici
          (« Baobart Accueil.dc.html », ligne 47) et le baobab blanc dans un
          cercle orange dans son en-tête (ligne 78). Deux marques pour une
          seule application.

          La première correction avait gardé le carré jaune en y posant le
          baobab d'encre — cohérent avec le fond, mais toujours deux marques.
          On aligne donc sur l'en-tête : cercle orange, baobab blanc, même
          proportion. Une application n'a qu'un logo, et c'est celui qu'on
          voit en haut de chaque page.

          36 px et non 40 : le rail replié fait 78 px de large, et le cercle
          de l'en-tête y toucherait les bords.
        */}
        <span
          className="logo-pastille"
          style={{
            width: 36,
            height: 36,
            flex: "0 0 auto",
            border: `2.5px solid ${ENCRE}`,
            borderRadius: 99,
            background: ORANGE,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          <Image
            src="/img/baobab-white.svg"
            alt="Baobart"
            width={24}
            height={24}
            style={{ width: 24, height: "auto", display: "block", marginTop: 2 }}
          />
        </span>
        {ouvert ? (
          <span
            className="logo-mot"
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

      <div
        style={{
          position: "relative",
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
        }}
      >
      <nav
        ref={listeRef}
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

        {resteDessous ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 34,
              pointerEvents: "none",
              background: `linear-gradient(to bottom, transparent, ${BLANC})`,
            }}
          />
        ) : null}
      </div>

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
