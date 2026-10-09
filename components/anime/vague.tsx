import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Un texte qui arrive mot à mot, ou lettre à lettre.
 *
 * Adapté d'Animata, `animata/text/wave-reveal.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`). Les images clés vivent dans
 * `app/globals.css` (`vague-monte`, `vague-descend`, `vague-net`). Ce qui a
 * changé par rapport à l'original :
 *
 * - le conteneur est en ligne, plus en `flex flex-wrap` : chaque mot est un
 *   bloc insécable et les espaces sont de vrais espaces. Dans l'original, les
 *   lettres étaient des éléments flexibles indépendants, et la ligne se
 *   coupait en plein mot (« IN / SPIRER », vu au labo le 08/10) ; un
 *   conteneur flexible poussait aussi à la ligne ce qui le suit dans un titre ;
 * - EN MODE MOT, LE TEXTE RESTE DU TEXTE. L'original masquait les morceaux au
 *   lecteur d'écran et ajoutait une copie `sr-only`. Dans un `<h1>`, ça double
 *   le titre pour tout ce qui lit le texte brut — moteur de recherche, aperçu
 *   de lien. Un mot entier se lit très bien : seul le mode lettre, qu'un
 *   lecteur d'écran épellerait, garde la copie ;
 * - `fin` : ce qui suit le texte, animé dans la même vague (le mot-sticker
 *   « créative » du hero, le point orange du logo). Il est enveloppé dans son
 *   propre bloc animé : une transformation posée sur `fin` lui-même — la
 *   rotation du sticker — n'est donc pas écrasée par l'animation ;
 * - `cn` maison, attributs `data-` au lieu de classes arbitraires, taille
 *   laissée à l'appelant.
 *
 * Sans JavaScript, la vague joue quand même : c'est du CSS. Sous mouvement
 * réduit, tout s'affiche d'un coup (règle en fin de `globals.css`).
 */
export function Vague({
  texte,
  sens = "up",
  mode = "mot",
  duree = "700ms",
  delai = 0,
  pas = 50,
  flou = false,
  className,
  classeMorceau,
  fin,
}: {
  texte: string;
  sens?: "up" | "down";
  mode?: "lettre" | "mot";
  duree?: string;
  /** Délai avant le premier morceau, en millisecondes. */
  delai?: number;
  /** Écart entre deux morceaux, en millisecondes. */
  pas?: number;
  flou?: boolean;
  className?: string;
  classeMorceau?: string;
  /** Ce qui suit le texte, animé à la suite. */
  fin?: ReactNode;
}) {
  if (!texte) return null;

  const mots = texte.trim().split(/\s+/);
  const style = (rang: number): CSSProperties => ({
    animationDuration: duree,
    animationDelay: `${delai + rang * pas}ms`,
  });
  const morceau = (contenu: ReactNode, cle: string, rang: number, classe?: string) => (
    <span
      key={cle}
      className={cn("vague-morceau", classeMorceau, classe)}
      data-sens={sens}
      data-flou={flou ? "" : undefined}
      style={style(rang)}
    >
      {contenu}
    </span>
  );

  let rang = 0;
  const morceaux: ReactNode[] = [];
  mots.forEach((mot, i) => {
    if (i > 0) morceaux.push(" ");
    if (mode === "mot") {
      morceaux.push(morceau(mot, `m${i}`, rang));
      rang += 1;
    } else {
      morceaux.push(
        <span key={`m${i}`} className="inline-block whitespace-nowrap">
          {[...mot].map((c, j) => morceau(c, `l${i}-${j}`, rang + j))}
        </span>,
      );
      rang += mot.length + 1;
    }
  });

  const queue = fin ? morceau(fin, "fin", rang) : null;

  if (mode === "mot") {
    // En mode mot, `fin` est un mot de plus : séparé par un espace. En mode
    // lettre, il colle (le point du logo).
    return (
      <span className={className}>
        {morceaux}
        {queue ? " " : null}
        {queue}
      </span>
    );
  }

  return (
    <span className={className}>
      <span aria-hidden>{morceaux}</span>
      <span className="sr-only">{texte}</span>
      {queue}
    </span>
  );
}
