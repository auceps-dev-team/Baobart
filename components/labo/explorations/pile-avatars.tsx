import { cn } from "@/lib/cn";

/**
 * Une rangée d'avatars qui se chevauchent ; celui qu'on vise passe devant et
 * dit son nom.
 *
 * Adapté d'Animata, `animata/list/avatar-list.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`). Ce qui a changé :
 *
 * - LES TAILLES ÉTAIENT INVERSÉES. L'original déclare `lg: "size-6"`,
 *   `md: "size-12"`, `sm: "size-8"` : le « grand » avatar fait 24 px, la
 *   moitié du moyen (lu dans le code). Ici sm < md < lg.
 * - LE NOM SE LIT AU CLAVIER. L'original n'affiche l'infobulle qu'au survol
 *   d'un `div` : ni focusable, ni lien. Chaque avatar est ici un lien, et
 *   l'infobulle s'ouvre aussi au focus clavier.
 * - LE NOM N'EST DIT QU'UNE FOIS. L'original pose `alt={nom}` sur l'image ET
 *   le nom dans l'infobulle : deux lectures. Ici l'infobulle est le nom du
 *   lien ; les initiales sont décoratives.
 * - Retirés : le dégradé violet-cyan-rose animé (`animate-bg-position`, une
 *   boucle infinie sans repli), et un `<div className="z-1 blur-lg" />` vide
 *   qui ne floute rien. Les photos Unsplash deviennent des initiales sur les
 *   aplats de la charte : pas de requête réseau dans le labo.
 *
 * Composant serveur, CSS seulement.
 */

type Createur = { nom: string; role: string; fond: string };

const TAILLES = {
  sm: "size-8 text-[11px]",
  md: "size-12 text-sm",
  lg: "size-16 text-lg",
} as const;

const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .map((m) => m[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function PileAvatars({
  createurs,
  taille = "md",
}: {
  createurs: Createur[];
  taille?: keyof typeof TAILLES;
}) {
  return (
    <ul className="flex pt-14">
      {createurs.map((c, i) => (
        <li key={c.nom} className={cn("relative", i > 0 && "-ml-3")}>
          <a
            href="#createur"
            className="group/avatar relative z-0 block rounded-pastille transition-transform duration-200 ease-out hover:z-10 hover:-translate-y-1 focus-visible:z-10 focus-visible:-translate-y-1"
          >
            <span
              aria-hidden
              className={cn(
                "grid place-items-center rounded-pastille border-[2.5px] border-encre font-display",
                TAILLES[taille],
                c.fond,
              )}
            >
              {initiales(c.nom)}
            </span>
            <span
              className={cn(
                "pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap",
                "rounded-sticker-sm border-[2.5px] border-encre bg-encre px-3 py-1.5 text-left text-blanc shadow-sticker",
                "opacity-0 transition-[opacity,transform] duration-200",
                "group-hover/avatar:translate-y-0 group-hover/avatar:opacity-100",
                "group-focus-visible/avatar:translate-y-0 group-focus-visible/avatar:opacity-100",
              )}
            >
              <span className="block text-sm font-bold">{c.nom}</span>
              <span className="block font-mono text-[11px] uppercase tracking-widest opacity-80">
                {c.role}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
