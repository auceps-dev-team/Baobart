"use client";

import {
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { useCallback, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/cn";

/**
 * Chaque chiffre roule sur sa bande de 0 à 9, comme un compteur mécanique.
 *
 * Adapté d'Animata, `animata/text/ticker.tsx` (MIT, voir LICENCE-animata.md).
 * Ce qui a changé :
 *
 * - mouvement réduit : comme pour `Compteur`, le ressort est en JavaScript et
 *   la règle CSS globale ne l'atteint pas. Sous `prefers-reduced-motion`, on
 *   prend le chemin qu'Animata réserve déjà au délai nul : le bon chiffre,
 *   posé d'un coup ;
 * - le chiffre interne s'appelle `Chiffre` : l'original le nommait `Number`,
 *   ce qui masquait le `Number` global dans tout le fichier ;
 * - `text-foreground`, un jeton shadcn que Baobart n'a pas, retiré ;
 * - le lecteur d'écran lit le nombre une fois, au lieu des dix chiffres de
 *   chaque bande ;
 * - plus de `<motion.div>` : la bande est un `div` ordinaire dont on écrit le
 *   `transform` à chaque pas du ressort. Mesuré le 08/10 avec esbuild
 *   (minifié, gzip, React exclu) : importer `motion` avec les seuls hooks
 *   coûte 10,0 Kio ; ajouter `motion.div` le porte à 41,2 Kio.
 *
 * Le rendu serveur montre déjà le bon nombre : l'original le prévoyait.
 */
function Chiffre({
  valeur,
  rang,
  total,
  delai,
  className,
  hauteur,
  visible,
  reduit,
}: {
  valeur: string;
  rang: number;
  total: number;
  delai?: number;
  className?: string;
  hauteur: () => number;
  visible: boolean;
  reduit: boolean;
}) {
  const brut = !/^\d$/.test(valeur);
  const bande = useRef<HTMLDivElement>(null);
  const position = useMotionValue(0);
  const ressort = useSpring(position, { stiffness: 150 - rang * 2, damping: 15 });

  useLayoutEffect(() => {
    if (!visible || brut) return;
    const h = hauteur();
    if (!h) return;
    const cible = -h * Number(valeur);

    if (!delai || reduit) {
      position.jump(cible);
      ressort.jump(cible);
      return;
    }

    position.jump(0);
    const minuteur = setTimeout(
      () => position.set(cible),
      (total - rang) * Math.floor(Math.random() * delai),
    );
    return () => clearTimeout(minuteur);
  }, [valeur, brut, visible, reduit, ressort, position, hauteur, rang, total, delai]);

  useMotionValueEvent(ressort, "change", (y) => {
    if (bande.current) bande.current.style.transform = `translateY(${y}px)`;
  });

  if (brut) return <span>{valeur}</span>;
  if (!visible) return <span className={className}>{valeur}</span>;

  return (
    <div ref={bande} style={{ transform: `translateY(${ressort.get()}px)` }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div className={className} key={i}>
          {i}
        </div>
      ))}
    </div>
  );
}

export function Rouleau({
  valeur,
  delai,
  className,
  classeChiffre,
}: {
  valeur: string;
  delai?: number;
  className?: string;
  classeChiffre?: string;
}) {
  const caracteres = valeur.trim().split("");
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true });
  const reduit = useReducedMotion() ?? false;
  const hauteur = useCallback(() => ref.current?.getBoundingClientRect().height ?? 0, []);

  return (
    <div className={cn("relative overflow-hidden whitespace-pre tabular-nums", className)}>
      <div aria-hidden className="absolute inset-0 flex min-w-fit">
        {caracteres.map((c, i) => (
          <Chiffre
            key={i}
            valeur={c}
            rang={i}
            total={caracteres.length}
            delai={delai}
            className={classeChiffre}
            hauteur={hauteur}
            visible={visible}
            reduit={reduit}
          />
        ))}
      </div>
      {/* Il donne la taille. `invisible` le retire aussi du lecteur d'écran. */}
      <div ref={ref} aria-hidden className="invisible min-w-fit">
        {valeur}
      </div>
      {/* L'original laissait le lecteur épeler les bandes : « 0 1 2 3 … 9 ». */}
      <span className="sr-only">{valeur}</span>
    </div>
  );
}
