import { cn } from "@/lib/cn";

/**
 * Un trait qui s'étire depuis le centre au survol.
 *
 * Adapté d'Animata, `animata/text/underline-hover-text.tsx` (MIT, voir
 * LICENCE-animata.md). Ce qui a changé : les couleurs zinc deviennent l'encre
 * et l'orange de la charte, le trait passe de 3 à 2,5 px (le trait standard,
 * `--trait`), et `"use client"` disparaît — le composant n'a aucun état, tout
 * se joue en CSS.
 */
export function Soulignement({ texte, className }: { texte: string; className?: string }) {
  return (
    <span
      className={cn(
        "group/souligne relative inline-block cursor-pointer px-1 pb-1.5 text-encre",
        "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "will-change-transform hover:-translate-y-[2px]",
        className,
      )}
    >
      <span className="relative z-10">{texte}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-current opacity-25"
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-px left-1/2 h-[2.5px] w-0 -translate-x-1/2 rounded-full bg-orange",
          "transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "group-hover/souligne:w-full",
        )}
      />
    </span>
  );
}
