"use client";

import { Children, type CSSProperties, type ReactNode, useEffect, useRef } from "react";

/**
 * Des cartes qui s'empilent au défilement : chacune se colle en haut, un cran
 * plus bas que la précédente, et la recouvre ; la carte recouverte recule.
 *
 * Adapté d'Animata, `animata/scroll/stacked-sections.tsx` (MIT, voir
 * LICENCE-animata.md). Ce qui a changé :
 *
 * - le recul (`scale`) se calcule toujours en JavaScript, à chaque image où
 *   la page défile : une carte collée ne bouge plus par rapport à l'écran, et
 *   une animation CSS au défilement (`view()`) ne la voit donc pas avancer —
 *   essayé le 08/10, abandonné avant d'être écrit ;
 * - recherche du parent qui défile, `stackOffset`, `paneGap` et
 *   `scrollRunway` retirés : le labo n'en a qu'un usage ;
 * - mouvement réduit respecté, comme dans l'original : rien ne recule, les
 *   cartes se collent quand même — c'est du `position: sticky`, pas une
 *   animation.
 *
 * ATTENTION avant de le sortir du labo : `position: sticky` colle au plus
 * proche ancêtre qui défile. Un ancêtre en `overflow-x: hidden` passe aussi
 * en `overflow-y: auto` ; s'il ne défile pas lui-même, rien ne colle. C'est
 * le cas de l'enveloppe de l'accueil (`HomeShell`) — lu dans le code, non
 * essayé.
 */
export function SectionsEmpilees({
  children,
  decalage = 28,
}: {
  children: ReactNode;
  /** L'écart, en pixels, entre deux cartes empilées. */
  decalage?: number;
}) {
  const cartes = useRef<(HTMLDivElement | null)[]>([]);
  const contenus = useRef<(HTMLDivElement | null)[]>([]);
  const items = Children.toArray(children);
  const total = items.length;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let image = 0;
    const mettreAJour = () => {
      image = 0;
      for (let i = 0; i < total; i++) {
        const contenu = contenus.current[i];
        const suivante = cartes.current[i + 1];
        const carte = cartes.current[i];
        if (!contenu || !carte) continue;
        if (!suivante) {
          contenu.style.transform = "";
          continue;
        }
        // Plus la suivante approche de sa place collée, plus celle-ci recule.
        const place = (i + 1) * decalage;
        const reste = suivante.getBoundingClientRect().top - place;
        const course = Math.max(carte.offsetHeight - place, 1);
        const avancee = Math.min(1, Math.max(0, 1 - reste / course));
        const echelle = 1 - 0.06 * (total - 1 - i) * avancee;
        contenu.style.transform = avancee <= 0.001 ? "" : `scale(${echelle})`;
      }
    };
    const auDefilement = () => {
      if (!image) image = requestAnimationFrame(mettreAJour);
    };

    mettreAJour();
    window.addEventListener("scroll", auDefilement, { passive: true });
    window.addEventListener("resize", auDefilement);
    return () => {
      window.removeEventListener("scroll", auDefilement);
      window.removeEventListener("resize", auDefilement);
      if (image) cancelAnimationFrame(image);
    };
  }, [total, decalage]);

  return (
    <div className="flex w-full flex-col gap-4" style={{ paddingBottom: total * decalage }}>
      {items.map((enfant, i) => (
        <div
          key={i}
          ref={(el) => {
            cartes.current[i] = el;
          }}
          className="sticky w-full"
          style={{ top: (i + 1) * decalage, zIndex: i + 1 } as CSSProperties}
        >
          <div
            ref={(el) => {
              contenus.current[i] = el;
            }}
            className="origin-[50%_0%] transition-transform duration-75"
          >
            {enfant}
          </div>
        </div>
      ))}
    </div>
  );
}
