import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Un ruban qui défile sans fin.
 *
 * Adapté d'Animata, `animata/container/marquee.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`). Les images clés vivent dans
 * `app/globals.css` (`defile-x`, `defile-y`). Ce qui a changé :
 *
 * - le masque en dégradé blanc (`applyMask`) a disparu : un fondu sur un
 *   ruban contouré de noir contredit la charte (« jamais flou ») ;
 * - les copies sont masquées au lecteur d'écran, sauf la première : il
 *   lisait cinq fois le même texte ;
 * - sous mouvement réduit, le ruban s'arrête.
 *
 * Chaque copie se décale de sa propre largeur : il en faut assez pour couvrir
 * le conteneur PLUS une copie, sinon un trou passe en fin de boucle.
 */
export function Defile({
  children,
  vertical = false,
  repetitions = 5,
  inverse = false,
  pauseAuSurvol = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  vertical?: boolean;
  repetitions?: number;
  inverse?: boolean;
  pauseAuSurvol?: boolean;
}) {
  return (
    <div
      {...props}
      className={cn(
        "relative flex w-full overflow-hidden [--duration:20s] [--gap:12px] [gap:var(--gap)]",
        vertical ? "h-full flex-col" : "flex-row",
        pauseAuSurvol && "defile-pause",
        className,
      )}
    >
      {Array.from({ length: repetitions }, (_, i) => (
        <div
          key={i}
          aria-hidden={i > 0 || undefined}
          className={cn(
            "flex shrink-0 [gap:var(--gap)]",
            vertical ? "defile-y flex-col" : "defile-x flex-row",
          )}
          style={inverse ? { animationDirection: "reverse" } : undefined}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
