import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Les 3 traitements de carte du design system (ANALYSE §2.4) — c'est la
 * grammaire visuelle du feed :
 *   1. sticker   — contour 2,5 px + ombre 4 px          (vedette)
 *   2. contour-fin — 1,5 px + ombre douce                (standard)
 *   3. image-pleine — infos au survol                    (immersion)
 */
export type CardTreatment = "sticker" | "contour-fin" | "image-pleine";

const TREATMENTS: Record<CardTreatment, string> = {
  sticker: "trait shadow-sticker bg-blanc",
  "contour-fin": "trait-fin shadow-douce bg-blanc",
  "image-pleine": "trait shadow-sticker bg-encre overflow-hidden",
};

export function Card({
  treatment = "sticker",
  interactive = false,
  children,
  className,
}: {
  treatment?: CardTreatment;
  interactive?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-sticker-lg",
        TREATMENTS[treatment],
        interactive && "sticker-press cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Zone visuelle d'une carte : image plein cadre, sinon trame diagonale 135°.
 * Le libellé se pose toujours sur une pastille blanche contournée (§2.5-4).
 */
export function CardVisual({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "trame relative flex aspect-4/3 items-end justify-start p-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
