"use client";

import { Children, type ReactNode, useEffect, useRef } from "react";

/**
 * Des cartes qui s'empilent au défilement : chacune se colle un cran plus bas
 * que la précédente et la recouvre ; la carte recouverte recule.
 *
 * Adapté d'Animata, `animata/scroll/stacked-sections.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`). Ce qui a changé :
 *
 * - LE COLLAGE EST POSÉ PAR LE SCRIPT, PAS PAR LE RENDU. L'original rend
 *   chaque carte en `position: sticky` dès le serveur. Avant hydratation, ou
 *   sans JavaScript, les cartes sont alors collées sans que rien n'ait
 *   vérifié qu'elles tiennent à l'écran. Ici le rendu serveur est un flux
 *   ordinaire ; le script colle, une fois les hauteurs mesurées.
 * - UNE CARTE PLUS HAUTE QUE L'ÉCRAN SE COLLE PAR LE BAS. Collée en haut,
 *   elle ne laisse plus jamais voir sa fin : la suivante la recouvre avant.
 *   Aucune erreur, juste du contenu devenu inaccessible — sur téléphone, les
 *   blocs de `/fonctionnalites` dépassent l'écran. Son `top` devient donc
 *   `hauteur d'écran − hauteur de carte` (négatif) : elle défile jusqu'à
 *   montrer son bas, puis se colle.
 * - SOUS L'EN-TÊTE. L'en-tête du site est collant (`[data-entete]`, z-index
 *   40) ; les cartes se collent sous lui, pas derrière. Sous 620 px, il ne
 *   colle plus (`globals.css`), et les cartes partent du haut.
 * - recul (`scale`) calculé à chaque image où la page défile, comme
 *   l'original : une carte collée ne bouge plus par rapport à l'écran, et une
 *   animation CSS au défilement ne la voit pas avancer (essayé au labo le
 *   08/10). Sous mouvement réduit, rien ne recule ; le collage reste — ce
 *   n'est pas une animation.
 *
 * Il colle au défilement de la FENÊTRE. Un ancêtre en `overflow: hidden`
 * (ou `overflow-x: hidden`, qui force `overflow-y: auto`) devient conteneur
 * de défilement et empêche tout collage : utiliser `overflow: clip`.
 */
export function SectionsEmpilees({
  children,
  decalage = 22,
  marge = 14,
}: {
  children: ReactNode;
  /** L'écart, en pixels, entre deux cartes empilées. */
  decalage?: number;
  /** L'espace sous l'en-tête, en pixels. */
  marge?: number;
}) {
  const cartes = useRef<(HTMLDivElement | null)[]>([]);
  const contenus = useRef<(HTMLDivElement | null)[]>([]);
  const items = Children.toArray(children);
  const total = items.length;

  useEffect(() => {
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const places: number[] = [];

    const placer = () => {
      const entete = document.querySelector<HTMLElement>("[data-entete]");
      const colle = entete && getComputedStyle(entete).position === "sticky";
      const base = (colle ? entete.offsetHeight : 0) + marge;
      for (let i = 0; i < total; i++) {
        const carte = cartes.current[i];
        if (!carte) continue;
        const voulu = base + i * decalage;
        // Trop haute pour tenir sous `voulu` : elle se colle par le bas.
        const auPlus = window.innerHeight - carte.offsetHeight - marge;
        const place = Math.min(voulu, auPlus);
        places[i] = place;
        carte.style.position = "sticky";
        carte.style.top = `${place}px`;
        // Elle recule vers le bord qu'on voit : le haut si elle est collée
        // par le haut, le bas si elle l'est par le bas (son haut est hors
        // de l'écran).
        const contenu = contenus.current[i];
        if (contenu) contenu.style.transformOrigin = place < voulu ? "50% 100%" : "50% 0%";
      }
    };

    let image = 0;
    const reculer = () => {
      image = 0;
      if (reduit) return;
      for (let i = 0; i < total - 1; i++) {
        const contenu = contenus.current[i];
        const carte = cartes.current[i];
        const suivante = cartes.current[i + 1];
        if (!contenu || !carte || !suivante) continue;
        // La suivante approche de sa place : celle-ci recule d'autant.
        const reste = suivante.getBoundingClientRect().top - (places[i + 1] ?? 0);
        const course = Math.max(carte.offsetHeight, 1);
        const avancee = Math.min(1, Math.max(0, 1 - reste / course));
        const echelle = 1 - 0.05 * (total - 1 - i) * avancee;
        contenu.style.transform = avancee <= 0.001 ? "" : `scale(${echelle})`;
      }
    };
    const auDefilement = () => {
      if (!image) image = requestAnimationFrame(reculer);
    };
    const auRedimensionnement = () => {
      placer();
      auDefilement();
    };

    placer();
    reculer();
    window.addEventListener("scroll", auDefilement, { passive: true });
    window.addEventListener("resize", auRedimensionnement);
    return () => {
      window.removeEventListener("scroll", auDefilement);
      window.removeEventListener("resize", auRedimensionnement);
      if (image) cancelAnimationFrame(image);
    };
  }, [total, decalage, marge]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {items.map((enfant, i) => (
        <div
          key={i}
          ref={(el) => {
            cartes.current[i] = el;
          }}
          style={{ zIndex: i + 1 }}
        >
          <div
            ref={(el) => {
              contenus.current[i] = el;
            }}
          >
            {enfant}
          </div>
        </div>
      ))}
    </div>
  );
}
