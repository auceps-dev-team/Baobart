import type { Route } from "next";
import Link from "next/link";

/**
 * Une rangée d'avatars qui se chevauchent ; celui qu'on vise passe devant et
 * dit son nom.
 *
 * Adapté d'Animata, `animata/list/avatar-list.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`), par le labo « explorations »
 * (`components/labo/explorations/pile-avatars.tsx`), qui en corrigeait :
 *
 * - les tailles inversées (`lg` = 24 px, plus petit que `md` = 48 px, lu dans
 *   le code) ;
 * - le nom lisible seulement à la souris : chaque avatar est un lien, et
 *   l'infobulle s'ouvre aussi au focus clavier ;
 * - le nom lu deux fois (`alt` ET infobulle) : ici l'infobulle est le nom du
 *   lien, l'image est décorative.
 *
 * Ce qui change ici : de vraies personnes. Leur photo quand elles en ont
 * une, leurs initiales sur un aplat de la charte sinon ; chaque avatar mène à
 * son profil public. CSS seulement (`group-hover`, `group-focus-visible`).
 */

type Visage = { id: string; username: string | null; nom: string; lieu: string | null; avatarUrl: string | null };

const APLATS = ["#C9A8F5", "#FFD84A", "#FFFFFF", "#E2622C"];

const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .map((m) => m[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function PileAvatars({ visages, taille = 36 }: { visages: Visage[]; taille?: number }) {
  if (visages.length === 0) return null;

  return (
    <ul style={{ display: "flex", listStyle: "none", margin: 0, padding: 0 }}>
      {visages.map((v, i) => {
        const pastille = (
          <>
            <span
              aria-hidden
              style={{
                display: "grid",
                placeItems: "center",
                width: taille,
                height: taille,
                borderRadius: 999,
                border: "2.5px solid #121212",
                background: v.avatarUrl
                  ? `center / cover no-repeat url(${JSON.stringify(v.avatarUrl)})`
                  : APLATS[i % APLATS.length],
                fontFamily: "var(--font-display)",
                fontSize: taille * 0.34,
                color: "#121212",
              }}
            >
              {v.avatarUrl ? null : initiales(v.nom)}
            </span>
            <span
              className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-sticker-sm border-[2.5px] border-encre bg-encre px-3 py-1.5 text-left text-blanc opacity-0 shadow-sticker transition-[opacity,transform] duration-200 group-hover/avatar:translate-y-0 group-hover/avatar:opacity-100 group-focus-visible/avatar:translate-y-0 group-focus-visible/avatar:opacity-100"
            >
              <span className="block text-[13px] font-bold">{v.nom}</span>
              {v.lieu ? (
                <span className="block font-mono text-[10.5px] uppercase tracking-widest opacity-80">
                  {v.lieu}
                </span>
              ) : null}
            </span>
          </>
        );
        const classe =
          "group/avatar relative z-0 block rounded-pastille transition-transform duration-200 ease-out hover:z-10 hover:-translate-y-1 focus-visible:z-10 focus-visible:-translate-y-1";
        return (
          <li key={v.id} style={{ position: "relative", marginLeft: i > 0 ? -10 : 0 }}>
            {v.username ? (
              <Link href={`/@${v.username}` as Route} className={classe}>
                {pastille}
              </Link>
            ) : (
              <span tabIndex={0} className={classe}>
                {pastille}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
