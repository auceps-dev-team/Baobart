"use client";

import { useRef } from "react";

import { useMouvementReduit } from "./mouvement-reduit";

/**
 * La galerie d'aperçus d'une fiche produit : on fait défiler, chaque image
 * s'aimante au bord.
 *
 * Hors Animata. `scroll-snap` fait tout le travail : c'est le défilement
 * natif du navigateur (doigt, molette, pavé tactile, clavier), auquel on
 * demande seulement de s'arrêter sur une image plutôt qu'entre deux. Sans
 * prise en charge, c'est un défilement horizontal ordinaire.
 *
 * Les deux flèches font défiler d'une image. `behavior: "smooth"` est un
 * mouvement en JavaScript que la règle globale ne voit pas : sous mouvement
 * réduit, on passe en `"auto"` (saut direct).
 *
 * Le ruban est focusable (`tabIndex={0}`) : au clavier, les flèches gauche et
 * droite le font défiler sans qu'on ait à viser les boutons.
 */

const APERCUS = [
  { titre: "Motif 01", fond: "bg-lavande-profond" },
  { titre: "Motif 02", fond: "bg-jaune" },
  { titre: "Sur un t-shirt", fond: "bg-blanc" },
  { titre: "Palette", fond: "bg-orange" },
  { titre: "Motif 03", fond: "bg-lavande-clair" },
];

export function Carrousel() {
  const reduit = useMouvementReduit();
  const ruban = useRef<HTMLUListElement>(null);

  const defiler = (sens: 1 | -1) => {
    const r = ruban.current;
    const premier = r?.firstElementChild as HTMLElement | null;
    if (!r || !premier) return;
    r.scrollBy({ left: sens * (premier.offsetWidth + 16), behavior: reduit ? "auto" : "smooth" });
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <ul
        ref={ruban}
        tabIndex={0}
        aria-label="Aperçus du pack"
        className="explo-ruban flex gap-4 overflow-x-auto pb-3"
      >
        {APERCUS.map((a, i) => (
          <li
            key={a.titre}
            className={`explo-ruban-item flex h-44 w-[70%] shrink-0 items-end rounded-sticker-md border-[2.5px] border-encre p-3 shadow-sticker sm:w-[40%] ${a.fond}`}
          >
            <span className="rounded-pastille border-2 border-encre bg-blanc px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest">
              {i + 1}/{APERCUS.length} · {a.titre}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => defiler(-1)}
          className="cursor-pointer rounded-pastille border-2 border-encre bg-blanc px-3 py-1 font-bold"
        >
          <span aria-hidden>←</span>
          <span className="sr-only">Aperçu précédent</span>
        </button>
        <button
          type="button"
          onClick={() => defiler(1)}
          className="cursor-pointer rounded-pastille border-2 border-encre bg-blanc px-3 py-1 font-bold"
        >
          <span aria-hidden>→</span>
          <span className="sr-only">Aperçu suivant</span>
        </button>
      </div>
    </div>
  );
}
