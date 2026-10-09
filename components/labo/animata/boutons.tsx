"use client";

import { type ButtonHTMLAttributes, type MouseEvent, useCallback, useRef } from "react";

import { cn } from "@/lib/cn";

/**
 * Trois boutons d'Animata (MIT, voir LICENCE-animata.md), passés à la charte :
 * contour d'encre 2,5 px, ombre dure, jaune pour l'action principale.
 */

type Bouton = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Le bouton qui s'enfonce.
 *
 * Adapté de `animata/button/duolingo.tsx`. L'original simule l'épaisseur par
 * une bordure basse de 4 px qui passe en haut au clic. Chez Baobart,
 * l'épaisseur est déjà là : c'est l'ombre dure. On garde donc l'idée — le
 * bouton descend sur son ombre — avec les outils de la charte.
 *
 * L'original posait aussi un `<span absolute inset-0 -z-10>` dans un bouton
 * sans `relative`. Lu dans le code, non rendu : le calque se place alors
 * contre le premier ancêtre positionné, pas contre le bouton. Il disparaît.
 */
export function BoutonEnfonce({ className, children, ...props }: Bouton) {
  return (
    <button
      type="button"
      className={cn(
        "h-11 cursor-pointer touch-manipulation whitespace-nowrap rounded-sticker-md border-[2.5px] border-encre bg-jaune px-5",
        "font-display text-sm uppercase tracking-wide text-encre shadow-sticker",
        "transition-[transform,box-shadow] duration-100 ease-out",
        "hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_var(--color-encre)]",
        "active:translate-x-1 active:translate-y-1 active:shadow-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * La flèche qui s'étire jusqu'à remplir le bouton.
 *
 * Adapté de `animata/button/slide-arrow-button.tsx`. Ce qui a changé : la
 * flèche de `lucide-react` devient le glyphe « → » — le site n'utilise aucune
 * bibliothèque d'icônes, et n'en prend pas une pour un trait ; la couleur
 * libre (`primaryColor`, un hexadécimal) est fixée à l'orange de la marque ;
 * l'effet joue aussi au focus clavier, que l'original ignorait.
 */
export function BoutonFleche({ className, children, ...props }: Bouton) {
  return (
    <button
      type="button"
      className={cn(
        "group/fleche relative cursor-pointer overflow-hidden rounded-pastille border-[2.5px] border-encre bg-blanc p-2 shadow-sticker",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 flex h-full w-11 items-center justify-end rounded-pastille bg-orange transition-all duration-200 ease-in-out group-hover/fleche:w-full group-focus-visible/fleche:w-full"
      >
        <span className="mr-3.5 text-lg font-bold text-blanc">→</span>
      </span>
      <span className="relative left-4 z-10 whitespace-nowrap px-8 font-bold text-encre transition-all duration-200 ease-in-out group-hover/fleche:-left-3 group-hover/fleche:text-blanc group-focus-visible/fleche:-left-3 group-focus-visible/fleche:text-blanc">
        {children}
      </span>
    </button>
  );
}

/**
 * Une tache d'encre qui suit la souris et remplit le bouton.
 *
 * Adapté de `animata/button/ripple-button.tsx`. Ce qui a changé : vert et
 * police Jost remplacés par le jaune et l'encre ; le calcul de position,
 * répété trois fois dans l'original, est rassemblé dans `placer`.
 *
 * Au clavier et au toucher, rien ne se passe : l'effet ne dépend que du
 * survol. Le bouton reste utilisable, il est seulement moins vivant.
 */
export function BoutonTache({ className, children, ...props }: Bouton) {
  const bouton = useRef<HTMLButtonElement>(null);
  const tache = useRef<HTMLSpanElement>(null);
  const dedans = useRef(false);

  const placer = useCallback((e: MouseEvent<HTMLButtonElement>, taille: boolean) => {
    const b = bouton.current;
    const t = tache.current;
    if (!b || !t) return null;
    const r = b.getBoundingClientRect();
    const cote = Math.max(r.width, r.height) * 2;
    if (taille) {
      t.style.width = `${cote}px`;
      t.style.height = `${cote}px`;
    }
    t.style.left = `${e.clientX - r.left - cote / 2}px`;
    t.style.top = `${e.clientY - r.top - cote / 2}px`;
    return t;
  }, []);

  const entrer = (e: MouseEvent<HTMLButtonElement>) => {
    if (dedans.current || e.target !== e.currentTarget) return;
    const t = placer(e, true);
    if (!t) return;
    dedans.current = true;
    t.classList.remove("animata-ride-sort");
    t.classList.add("animata-ride-entre");
  };

  const sortir = (e: MouseEvent<HTMLButtonElement>) => {
    if (e.target !== e.currentTarget) return;
    const t = placer(e, false);
    if (!t) return;
    dedans.current = false;
    t.classList.remove("animata-ride-entre");
    t.classList.add("animata-ride-sort");
    t.addEventListener("animationend", () => t.classList.remove("animata-ride-sort"), {
      once: true,
    });
  };

  return (
    <button
      type="button"
      ref={bouton}
      className={cn(
        "relative flex cursor-pointer items-center justify-center overflow-hidden rounded-pastille border-[2.5px] border-encre bg-jaune px-7 py-3.5",
        "font-bold text-encre shadow-sticker transition-colors duration-300 hover:text-blanc",
        className,
      )}
      onMouseEnter={entrer}
      onMouseLeave={sortir}
      onMouseMove={(e) => {
        if (dedans.current) placer(e, false);
      }}
      {...props}
    >
      <span className="relative z-[2]">{children}</span>
      <span ref={tache} aria-hidden className="animata-ride" />
    </button>
  );
}
