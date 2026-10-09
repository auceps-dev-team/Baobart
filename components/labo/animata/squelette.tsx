import { cn } from "@/lib/cn";

/**
 * Une liste en cours de chargement.
 *
 * Adaptée d'Animata, `animata/skeleton/list.tsx` (MIT, voir
 * LICENCE-animata.md). Ce qui a changé :
 *
 * - les jetons shadcn (`bg-muted`, `bg-background`) n'existent pas chez
 *   Baobart. Copiés tels quels, ils ne produisent AUCUNE couleur : Tailwind
 *   n'émet pas de classe pour un jeton inconnu, et le squelette rendait des
 *   barres transparentes, sans la moindre erreur. Ils deviennent les lavandes ;
 * - les deux faux boutons (`<button>` sans action) deviennent des `<span>` :
 *   un squelette ne se clique pas, et le clavier s'y arrêtait ;
 * - l'original est STATIQUE — seule l'ombre bouge au survol. On peut lui
 *   ajouter le balayage des maquettes (« Baobart Parcours Achat.dc.html »,
 *   `sweep`, devenu `balayage` dans `globals.css`), avec `balaye`.
 */
export function Squelette({ balaye = false, className }: { balaye?: boolean; className?: string }) {
  // `squelette-balaye` : la classe globale, celle du squelette de /explore.
  const barre = cn("rounded-pastille", balaye ? "squelette-balaye" : "bg-lavande-fond");

  return (
    <div
      aria-busy="true"
      aria-label="Chargement"
      className={cn(
        "flex min-h-52 w-56 flex-col gap-3 rounded-sticker-md border-[2.5px] border-encre bg-blanc p-3 shadow-sticker transition-shadow hover:shadow-none",
        className,
      )}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex w-full items-center justify-between gap-2">
          <div className={cn("h-2 w-2", barre)} />
          <div className={cn("h-3 w-3 rounded-sm", barre)} />
          <div className={cn("h-2 flex-1", barre)} />
        </div>
      ))}
      <div className="mt-auto flex w-full justify-end gap-2">
        <span className="block w-2/5 rounded-sticker-sm border-2 border-encre bg-jaune p-2">
          <span className="block h-1.5 rounded-sm bg-blanc/70" />
        </span>
        <span className="block w-1/5 rounded-sticker-sm bg-lavande-clair p-2">
          <span className="block h-1.5 rounded-sm bg-lavande-profond" />
        </span>
      </div>
    </div>
  );
}
