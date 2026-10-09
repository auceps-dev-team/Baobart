"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

import { cn } from "@/lib/cn";

import { useMouvementReduit } from "./mouvement-reduit";

/**
 * Passer de la grille à la liste : chaque carte glisse jusqu'à sa nouvelle
 * place au lieu de sauter.
 *
 * Hors Animata. API View Transitions du navigateur
 * (`document.startViewTransition`), aucune dépendance.
 *
 * Le principe : le navigateur photographie la page, on change le DOM, il
 * photographie de nouveau, et anime d'une photo à l'autre. Chaque carte porte
 * un `view-transition-name` unique : il sait donc que la carte « Pack Wax »
 * d'avant est celle d'après, et la fait voyager. `flushSync` force React à
 * écrire le DOM DANS le rappel — sans lui, la mise à jour arriverait après la
 * seconde photo, et il n'y aurait rien à animer (succès silencieux : aucune
 * erreur, simplement aucun mouvement).
 *
 * Replis :
 * - navigateur sans l'API : le DOM change d'un coup, comme un simple
 *   `setState` ;
 * - mouvement réduit : même chose. La règle globale de `globals.css` vise
 *   `*`, `::before`, `::after` — pas les pseudo-éléments `::view-transition-*`,
 *   qui garderaient leur durée. On ne démarre donc pas la transition du tout.
 *
 * `view-transition-class: explo-vt` limite le réglage de durée (dans
 * `explorations.css`) à ces cartes-là.
 */

const PRODUITS = [
  { id: "wax", titre: "Pack Wax", prix: "4 500 F", fond: "bg-lavande-profond" },
  { id: "akwaba", titre: "Police Akwaba", prix: "Gratuit", fond: "bg-jaune" },
  { id: "plateau", titre: "Mockups Plateau", prix: "7 000 F", fond: "bg-blanc" },
  { id: "kente", titre: "Icônes Kente", prix: "2 000 F", fond: "bg-orange" },
];

export function GrilleListe() {
  const reduit = useMouvementReduit();
  const [vue, setVue] = useState<"grille" | "liste">("grille");

  const changer = (v: "grille" | "liste") => {
    if (v === vue) return;
    if (reduit || typeof document.startViewTransition !== "function") {
      setVue(v);
      return;
    }
    document.startViewTransition(() => flushSync(() => setVue(v)));
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex gap-2" role="group" aria-label="Affichage">
        {(["grille", "liste"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={vue === v}
            onClick={() => changer(v)}
            className={cn(
              "cursor-pointer rounded-pastille border-2 border-encre px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest",
              vue === v ? "bg-jaune" : "bg-blanc",
            )}
          >
            {v}
          </button>
        ))}
      </div>
      <ul
        data-vue={vue}
        className={cn("grid gap-4", vue === "grille" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1")}
      >
        {PRODUITS.map((p) => (
          <li
            key={p.id}
            style={{ viewTransitionName: `explo-vt-${p.id}` }}
            className={cn(
              "explo-vt flex overflow-clip rounded-sticker-md border-[2.5px] border-encre bg-blanc shadow-sticker",
              vue === "grille" ? "flex-col" : "flex-row items-center",
            )}
          >
            <div
              className={cn(
                "shrink-0 border-encre",
                p.fond,
                vue === "grille" ? "h-28 border-b-[2.5px]" : "h-16 w-20 border-r-[2.5px]",
              )}
            />
            <div className="flex flex-1 items-baseline justify-between gap-2 px-3 py-2">
              <span className="font-bold">{p.titre}</span>
              <span className="meta">{p.prix}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
