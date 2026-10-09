import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Une carte qui se retourne au survol et au focus clavier.
 *
 * Adaptée d'Animata, `animata/card/flip-card.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`). Ce qui a changé :
 *
 * - les deux faces passent en propriétés (`recto`, `verso`) au lieu de
 *   `<FlipCard.Front>` / `<FlipCard.Back>` reliés par un contexte : sans
 *   contexte, plus de `"use client"`, la carte se rend côté serveur ;
 * - la carte prend le focus et se retourne avec lui ; l'original ne
 *   réagissait qu'au survol, et le verso était inatteignable au clavier ;
 * - avec `href`, la carte EST le lien. Une carte focalisable posée dans un
 *   lien ferait deux arrêts de tabulation pour une seule destination.
 *
 * Ce que ça ne règle pas : au toucher, le retournement dépend du « survol
 * collant » du navigateur. D'où la règle d'usage : le recto doit se suffire.
 * Rien d'important ne doit vivre QUE sur le verso.
 *
 * Les deux faces sont posées l'une sur l'autre : la carte a besoin d'une
 * hauteur fixe, que l'appelant donne par `className` ou `style`.
 */
export function CarteRetournee({
  recto,
  verso,
  axe = "y",
  etiquette,
  href,
  className,
  style,
}: {
  recto: ReactNode;
  verso: ReactNode;
  axe?: "x" | "y";
  /** Ce que le lecteur d'écran annonce : le nom de la destination, ou de la carte. */
  etiquette: string;
  href?: Route;
  className?: string;
  style?: CSSProperties;
}) {
  const tourne =
    axe === "y"
      ? "group-hover/carte:rotate-y-180 group-focus-visible/carte:rotate-y-180"
      : "group-hover/carte:rotate-x-180 group-focus-visible/carte:rotate-x-180";
  const dos = axe === "y" ? "rotate-y-180" : "rotate-x-180";

  // Des `div` : la racine est un `<a>` ou un `<div>`, qui les acceptent tous
  // deux, et les faces peuvent alors contenir des blocs.
  const interieur = (
    <div
      className={cn(
        "relative h-full transition-transform duration-500 ease-out transform-3d will-change-transform motion-reduce:transition-none",
        tourne,
      )}
    >
      <div className="absolute inset-0 backface-hidden">{recto}</div>
      <div aria-hidden className={cn("absolute inset-0 backface-hidden", dos)}>
        {verso}
      </div>
    </div>
  );

  const racine = cn("group/carte block perspective-[1000px]", className);

  if (href) {
    return (
      <Link href={href} aria-label={etiquette} className={racine} style={style}>
        {interieur}
      </Link>
    );
  }

  return (
    <div tabIndex={0} role="group" aria-label={etiquette} className={racine} style={style}>
      {interieur}
    </div>
  );
}
