import Image from "next/image";

import { Vague } from "@/components/anime/vague";
import { cn } from "@/lib/cn";

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
 * - `survol`  : la pastille pivote et le mot se souligne d'orange au survol.
 *   RETENU le 08/10 pour les cinq logos du site : il passe par les classes
 *   globales `logo-anime`, `logo-pastille` et `logo-mot` (`globals.css`),
 *   les mêmes que dans les vraies vues ;
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
        mode="lettre"
        duree="700ms"
        delai={150}
        fin={<span className="text-orange">.</span>}
      />
    ) : (
      <>
        Baobart<span className="text-orange">.</span>
      </>
    );

  return (
    <a
      href="#logo"
      className={cn(
        "flex w-fit cursor-pointer items-center text-encre",
        variante === "survol" && "logo-anime",
      )}
      style={{ gap: 10 * taille }}
    >
      <span
        className={cn(
          "logo-pastille grid flex-none place-items-center overflow-hidden rounded-pastille border-[2.5px] border-encre bg-orange",
          variante === "sticker" &&
            // Boucle infinie : sous mouvement réduit, on l'arrête nous-mêmes.
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
        className="logo-mot font-display"
        style={{ fontSize: 22 * taille, letterSpacing: `${-0.5 * taille}px` }}
      >
        {mot}
      </span>
    </a>
  );
}
