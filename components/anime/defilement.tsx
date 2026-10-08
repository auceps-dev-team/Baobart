import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Effets au défilement, essayés au labo le 08/10/2026 puis posés sur les vues.
 *
 * Tous en CSS, par `animation-timeline` (classes `defil-*`, section
 * ANIMATIONS de `app/globals.css`) : pas de JavaScript, pas d'écouteur de
 * défilement. Sans prise en charge, ou sous mouvement réduit, l'élément est
 * simplement là, immobile — voir la note dans `globals.css`.
 *
 * `view()` suit le plus proche ancêtre qui DÉFILE. Un ancêtre en
 * `overflow-x: hidden` passe en `overflow-y: auto` et en devient un, même
 * s'il ne défile pas : la chronologie reste alors inerte, et rien ne bouge
 * — sans erreur. D'où `overflow-x: clip` sur l'enveloppe de l'accueil.
 *
 * Les cartes empilées demandent du JavaScript : `sections-empilees.tsx`.
 */

/**
 * L'élément se pose comme un sticker en entrant à l'écran (`popin`).
 *
 * L'apparition se joue sur les 260 premiers pixels de l'entrée, quelle que
 * soit la hauteur de l'élément : au labo, sur des cartes de 112 px, la plage
 * était une fraction de leur hauteur ; sur une section de l'accueil plus
 * haute que l'écran, la même fraction la laisserait à moitié transparente
 * pendant tout un écran de défilement (déduit de la définition de `entry`,
 * pas observé).
 */
export function Apparition({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("defil-apparait", className)}>{children}</div>;
}

/**
 * L'élément glisse moins vite que la page.
 *
 * `amplitude` : l'écart total, en pixels, sur toute la traversée de l'écran.
 * Positif, l'élément traîne ; négatif, il devance.
 */
export function Parallaxe({
  children,
  amplitude = 80,
  className,
}: {
  children: ReactNode;
  amplitude?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("defil-parallaxe", className)}
      style={{ "--amplitude": `${amplitude}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Une barre en haut de l'écran, remplie à proportion de la page parcourue.
 *
 * Posée DANS un élément qui porte la classe `defil-lecture`, elle suit cet
 * élément seul (un article) au lieu de toute la page : sinon le pied de page
 * compte, et la barre n'atteint le bout qu'en bas de celui-ci.
 *
 * Vide par défaut (`scaleX(0)` en ligne) : sans prise en charge, elle reste
 * invisible plutôt que pleine — une barre pleine dirait « tout lu » à qui
 * arrive. L'animation, elle, l'emporte sur le style en ligne.
 */
export function BarreLecture() {
  return (
    <div
      aria-hidden
      className="defil-barre fixed inset-x-0 top-0 z-[60] h-1.5 border-b-2 border-encre bg-orange"
      style={{ transform: "scaleX(0)" }}
    />
  );
}

/**
 * Un paragraphe dont les mots s'allument un à un pendant qu'il traverse
 * l'écran.
 *
 * Adapté d'Animata, `animata/text/scroll-reveal.tsx` (MIT). L'original
 * n'écoutait que SA PROPRE boîte à défilement (`h-96 overflow-y-scroll`) :
 * un défilement dans le défilement, qu'on ne croise sur aucun site. Il
 * suivait le pointeur avec `motion.span` — la partie de `motion` qui pèse
 * 41 Kio. Ici, le paragraphe nomme sa traversée de la page (`view-timeline`)
 * et chaque mot y prend sa tranche, en CSS seul.
 *
 * Sans prise en charge, le texte est entièrement allumé : la garde
 * `@supports` empêche l'état « éteint » de s'appliquer.
 */
export function TexteQuiSAllume({
  texte,
  className,
  style,
}: {
  texte: string;
  className?: string;
  style?: CSSProperties;
}) {
  const mots = texte.trim().split(/\s+/);
  const n = mots.length;
  return (
    <p className={cn("defil-allume", className)} style={style}>
      {mots.map((mot, i) => (
        <span
          key={i}
          style={
            {
              "--debut": `${(i / n) * 100}%`,
              "--fin": `${((i + 1) / n) * 100}%`,
            } as CSSProperties
          }
        >
          {mot}
          {i < n - 1 ? " " : null}
        </span>
      ))}
    </p>
  );
}
