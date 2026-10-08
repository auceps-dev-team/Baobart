import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Le texte qui monte ou descend lettre à lettre.
 *
 * Adapté d'Animata, `animata/text/wave-reveal.tsx` (MIT, voir
 * LICENCE-animata.md). Ce qui a changé :
 *
 * - `cn` maison au lieu de `clsx` + `tailwind-merge` : la syntaxe objet
 *   d'Animata (`{ "classe": condition }`) devient des conditions écrites ;
 * - les images clés passent par des attributs `data-` lus dans
 *   `animata.css`, au lieu de classes arbitraires `animate-[reveal-down]` qui
 *   supposaient les images clés dans la feuille globale ;
 * - les lettres d'un mot sont regroupées, pour que la ligne ne se coupe
 *   qu'entre deux mots ;
 * - plus de taille ni de graisse imposées (`text-4xl md:text-7xl`) : c'est
 *   l'appelant qui choisit, pour que le composant tienne aussi dans un logo.
 *
 * Le texte entier reste lisible par un lecteur d'écran (`sr-only`) ; les
 * lettres, elles, sont masquées pour lui : sinon il épelle.
 */
export function Vague({
  texte,
  sens = "down",
  mode = "lettre",
  duree = "2000ms",
  delai = 0,
  flou = true,
  className,
  classeLettre,
  fin,
}: {
  texte: string;
  sens?: "up" | "down";
  mode?: "lettre" | "mot";
  duree?: string;
  /** Délai avant la première lettre, en millisecondes. */
  delai?: number;
  flou?: boolean;
  className?: string;
  classeLettre?: string;
  /** Ce qui suit le texte sans s'animer — le point orange du logo. */
  fin?: ReactNode;
}) {
  if (!texte) return null;

  const mots = texte.trim().split(/\s/);
  const morceaux: ReactNode[] = [];
  let rang = 0;

  const style = (i: number): CSSProperties => ({
    animationDuration: duree,
    animationDelay: `${delai + i * 50}ms`,
  });

  const lettre = (contenu: string, cle: string, i: number) => (
    <span
      key={cle}
      className={cn("animata-lettre", classeLettre)}
      data-sens={sens}
      data-flou={flou ? "" : undefined}
      style={style(i)}
    >
      {contenu}
    </span>
  );

  mots.forEach((mot, i) => {
    if (mode === "mot") {
      morceaux.push(lettre(mot, `m${i}`, rang));
      rang += 1;
    } else {
      // Les lettres d'un mot restent ensemble : posées une à une dans le
      // conteneur flexible, elles laissaient la ligne se couper en plein mot
      // (« IN / SPIRER »). L'original a la même structure, via `contents`.
      morceaux.push(
        <span key={`m${i}`} className="inline-flex">
          {[...mot].map((c, j) => lettre(c, `l${i}-${j}`, rang + j))}
        </span>,
      );
      rang += mot.length + 1;
    }
    if (i < mots.length - 1) morceaux.push(<span key={`e${i}`}>{" "}</span>);
  });

  return (
    <span className={cn("relative inline-flex flex-wrap whitespace-pre", className)}>
      <span aria-hidden className="contents">
        {morceaux}
        {fin}
      </span>
      <span className="sr-only">{texte}</span>
    </span>
  );
}
