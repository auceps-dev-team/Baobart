import Image from "next/image";

import { cn } from "@/lib/cn";

import { Vague } from "./vague";

/**
 * Le logo de l'en-tête, animé de trois façons.
 *
 * Le balisage est celui de `components/shell/header.tsx` (pastille orange de
 * 40 px, baobab blanc de 27 px, mot en Archivo Black 22 px, point orange),
 * lui-même tiré de la variante 1a de « Baobart Logo.dc.html ». La maquette du
 * logo ne prévoit AUCUNE animation (vérifié le 08/10 : aucun `animation`,
 * `transition` ni `@keyframes` dans le fichier, seulement une couleur de lien
 * au survol). Les trois essais ci-dessous sont donc des propositions, pas des
 * traductions.
 *
 * - `vague`   : le mot arrive lettre à lettre (Wave Reveal d'Animata) ;
 * - `survol`  : la pastille pivote et le mot se souligne d'orange au survol ;
 * - `sticker` : la pastille arrive comme un autocollant posé (`popin` des
 *   maquettes), puis flotte (`floaty`, déjà dans `globals.css`).
 */
export function LogoAnime({
  variante,
  taille = 1,
}: {
  variante: "vague" | "survol" | "sticker";
  /** Facteur d'échelle : 1 = l'en-tête, 2 = une page d'accueil. */
  taille?: number;
}) {
  const pastille = 40 * taille;
  const arbre = 27 * taille;

  const mot =
    variante === "vague" ? (
      <Vague
        texte="Baobart"
        sens="up"
        duree="700ms"
        delai={150}
        flou={false}
        fin={<span className="text-orange">.</span>}
      />
    ) : (
      <span className="relative">
        Baobart<span className="text-orange">.</span>
        {variante === "survol" && (
          <span
            aria-hidden
            className="absolute -bottom-0.5 left-1/2 h-[2.5px] w-0 -translate-x-1/2 rounded-full bg-orange transition-[width] duration-300 ease-out group-hover/logo:w-full group-focus-visible/logo:w-full"
          />
        )}
      </span>
    );

  return (
    <a
      href="#logo"
      className="group/logo flex w-fit cursor-pointer items-center text-encre"
      style={{ gap: 10 * taille }}
    >
      <span
        className={cn(
          "grid flex-none place-items-center overflow-hidden rounded-pastille border-[2.5px] border-encre bg-orange",
          variante === "survol" &&
            "transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/logo:-rotate-12 group-hover/logo:scale-110 group-focus-visible/logo:-rotate-12",
          variante === "sticker" &&
            // Boucle infinie : sous mouvement réduit, on l'arrête nous-mêmes
            // (voir la note de `animata.css`).
            "animate-[popin_.35s_cubic-bezier(0.34,1.56,0.64,1)_both,floaty_6s_ease-in-out_.6s_infinite] motion-reduce:animate-none",
        )}
        style={{ width: pastille, height: pastille }}
      >
        <Image
          src="/img/baobab-white.svg"
          alt="Baobart"
          width={arbre}
          height={arbre}
          style={{ width: arbre, height: "auto", display: "block", marginTop: 2 * taille }}
        />
      </span>
      <span
        className="font-display"
        style={{ fontSize: 22 * taille, letterSpacing: `${-0.5 * taille}px` }}
      >
        {mot}
      </span>
    </a>
  );
}
