import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Une carte qui se retourne au survol.
 *
 * Adaptée d'Animata, `animata/card/flip-card.tsx` (MIT, voir
 * LICENCE-animata.md). Ce qui a changé :
 *
 * - les deux faces passent en propriétés (`recto`, `verso`) au lieu de
 *   `<FlipCard.Front>` / `<FlipCard.Back>` reliés par un contexte React. Sans
 *   contexte, plus besoin de `"use client"` : la carte se rend côté serveur ;
 * - la carte prend le focus clavier et se retourne avec lui. L'original ne
 *   réagissait qu'au survol : au clavier, le verso était inatteignable ;
 * - l'axe reste au choix (`x` ou `y`), comme dans l'original.
 *
 * Ce que ça ne règle pas : sur un écran tactile, le retournement dépend du
 * « survol collant » du navigateur après un toucher. Un contenu qui ne vit
 * QUE sur le verso — un prix, un lien — reste donc une mauvaise idée.
 */
export function CarteRetournee({
  recto,
  verso,
  axe = "y",
  className,
  etiquette,
}: {
  recto: ReactNode;
  verso: ReactNode;
  axe?: "x" | "y";
  className?: string;
  /** Ce que le lecteur d'écran annonce en arrivant sur la carte. */
  etiquette: string;
}) {
  const tourne =
    axe === "y"
      ? "group-hover/carte:rotate-y-180 group-focus-visible/carte:rotate-y-180"
      : "group-hover/carte:rotate-x-180 group-focus-visible/carte:rotate-x-180";
  const dos = axe === "y" ? "rotate-y-180" : "rotate-x-180";

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={etiquette}
      className={cn("group/carte h-72 w-56 rounded-sticker-lg perspective-[1000px] outline-offset-4", className)}
    >
      <div
        className={cn(
          "relative h-full rounded-sticker-lg transition-transform duration-500 ease-out transform-3d will-change-transform motion-reduce:transition-none",
          tourne,
        )}
      >
        <div className="absolute inset-0 backface-hidden">{recto}</div>
        <div className={cn("absolute inset-0 backface-hidden", dos)}>{verso}</div>
      </div>
    </div>
  );
}
