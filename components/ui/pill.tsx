import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Étiquettes & statuts : GRATUIT, NOUVEAU, EN LIGNE, MODÉRATION, VERSÉE, URGENT.
 * Toujours contourées, toujours en Space Mono majuscules (ANALYSE §2.4).
 */

export type PillTone =
  | "jaune" // GRATUIT, NOUVEAU
  | "blanc" // neutre, pastille sur image
  | "lavande" // information
  | "encre" // état fort
  | "orange"; // alerte — surface orange, texte encre

const TONES: Record<PillTone, string> = {
  jaune: "bg-jaune text-encre",
  blanc: "bg-blanc text-encre",
  lavande: "bg-lavande-profond text-encre",
  encre: "bg-encre text-blanc",
  orange: "bg-orange text-encre",
};

export function Pill({
  tone = "blanc",
  children,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "meta inline-flex items-center gap-1.5 rounded-pastille border-[2px] border-encre px-3 py-1.5",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
