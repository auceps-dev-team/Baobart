import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Un ruban qui défile sans fin.
 *
 * Adapté d'Animata, `animata/container/marquee.tsx` (MIT, voir
 * LICENCE-animata.md). Ce qui a changé :
 *
 * - le masque en dégradé blanc (`applyMask`) a disparu : un fondu sur un
 *   ruban contouré de noir contredit la charte (« jamais flou ») ;
 * - les copies sont masquées au lecteur d'écran, sauf la première : il
 *   lisait cinq fois le même texte ;
 * - sous mouvement réduit, le ruban s'arrête (voir `animata.css`).
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
  /** Assez pour déborder du conteneur, sinon un trou apparaît en fin de boucle. */
  repetitions?: number;
  inverse?: boolean;
  pauseAuSurvol?: boolean;
}) {
  return (
    <div
      {...props}
      className={cn(
        "relative flex h-full w-full overflow-hidden [--duration:20s] [--gap:12px] [gap:var(--gap)]",
        vertical ? "flex-col" : "flex-row",
        pauseAuSurvol && "animata-defile-pause",
        className,
      )}
    >
      {Array.from({ length: repetitions }, (_, i) => (
        <div
          key={i}
          aria-hidden={i > 0 || undefined}
          className={cn(
            "flex shrink-0 [gap:var(--gap)]",
            vertical ? "animata-defile-y flex-col" : "animata-defile-x flex-row",
          )}
          style={inverse ? { animationDirection: "reverse" } : undefined}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
