"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

import { useMouvementReduit } from "./mouvement-reduit";

/**
 * Une frise d'étapes qui se remplit en cascade quand on avance.
 *
 * Adapté d'Animata, `animata/progress/animatedtimeline.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`). Ce qui a changé :
 *
 * - L'ÉTAT EST UNE DONNÉE, PAS UN SURVOL. L'original allume les étapes
 *   jusqu'à celle que la souris survole, et éteint tout quand elle sort : une
 *   frise qui ne dit rien tant qu'on ne la touche pas. Au clavier, rien ne
 *   s'allume : `onFocus` est posé sur un `div` qui n'est focusable que si
 *   `onEventClick` est fourni (lu dans le code). Ici, l'étape vient du
 *   serveur (`etape`), la cascade ne joue que quand elle change.
 * - LA CASCADE EST GARDÉE : `computeDelays` est repris presque tel quel
 *   (ici `delais`), avec ses constantes.
 * - MOUVEMENT RÉDUIT : les délais sont écrits en style en ligne. La règle
 *   globale raccourcit les DURÉES, pas les délais : sans garde, les points
 *   s'allumeraient encore un par un, avec 80 ms d'écart. Ils passent à zéro.
 * - SÉMANTIQUE : une liste ordonnée, `aria-current="step"` sur l'étape en
 *   cours. Les couleurs codées en dur (`#22c55e`) et `hsl(var(--background))`
 *   (une variable de shadcn, absente ici) deviennent les jetons de la charte.
 *
 * Les boutons « avancer / reculer » n'existent que pour le labo.
 */

const PASSAGE_POINT = 0.12;
const PASSAGE_TRAIT = 0.15;
const ECART = 0.08;
const DECALAGE_TRAIT = 0.04;

/** `computeDelays` d'Animata, renommé. `a` : nouvelle étape, `p` : précédente. */
function delais(i: number, a: number, p: number) {
  if (a > p) {
    if (p < 0) return { point: i * ECART, trait: i * ECART + DECALAGE_TRAIT };
    return {
      point: i > p ? (i - p) * ECART : 0,
      trait: i === p ? 0 : i > p ? (i - p) * ECART + DECALAGE_TRAIT : 0,
    };
  }
  if (a < p) {
    return {
      point: i <= p && i > a ? (p - i) * ECART : 0,
      trait: i >= Math.max(a, 0) && i < p ? (p - 1 - i) * ECART + DECALAGE_TRAIT : 0,
    };
  }
  return { point: 0, trait: 0 };
}

export function Frise({
  etapes,
  initiale = 0,
}: {
  etapes: { titre: string; detail: string }[];
  initiale?: number;
}) {
  const reduit = useMouvementReduit();
  // L'étape et la précédente ensemble, comme l'original : la cascade dépend des deux.
  const [{ etape, precedente }, setEtat] = useState({ etape: initiale, precedente: initiale });

  const aller = (n: number) =>
    setEtat((s) => ({ etape: Math.max(0, Math.min(etapes.length - 1, n)), precedente: s.etape }));

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col">
        {etapes.map((e, i) => {
          const point = i <= etape;
          const trait = i < etape;
          const d = reduit ? { point: 0, trait: 0 } : delais(i, etape, precedente);
          const dernier = i === etapes.length - 1;
          return (
            <li key={e.titre} className="flex" aria-current={i === etape ? "step" : undefined}>
              <div className="relative mr-4 flex flex-col items-center">
                {!dernier ? (
                  <div className="absolute inset-y-0 w-1 bg-lavande-profond">
                    <div
                      className="h-full w-full origin-top bg-encre"
                      style={{
                        transform: trait ? "scaleY(1)" : "scaleY(0)",
                        transition: `transform ${PASSAGE_TRAIT}s ease-in-out ${d.trait}s`,
                      }}
                    />
                  </div>
                ) : null}
                <div
                  className={cn(
                    "relative z-10 size-6 rounded-pastille border-[2.5px] border-encre",
                    point ? "bg-jaune" : "bg-blanc",
                  )}
                  style={{
                    transform: i === etape ? "scale(1.25)" : "scale(1)",
                    transition: `background-color ${PASSAGE_POINT}s ease ${d.point}s, transform ${PASSAGE_POINT}s ease ${d.point}s`,
                  }}
                />
              </div>
              <div className={cn("pb-5 leading-5", dernier && "pb-0")}>
                <div className={cn("font-bold", !point && "opacity-50")}>{e.titre}</div>
                <div className="text-sm opacity-70">{e.detail}</div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => aller(etape - 1)}
          disabled={etape === 0}
          className="cursor-pointer rounded-pastille border-2 border-encre bg-lavande-clair px-3 py-1 font-mono text-[11px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Reculer
        </button>
        <button
          type="button"
          onClick={() => aller(etape + 1)}
          disabled={etape === etapes.length - 1}
          className="cursor-pointer rounded-pastille border-2 border-encre bg-jaune px-3 py-1 font-mono text-[11px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
        >
          Avancer →
        </button>
        <button
          type="button"
          onClick={() => aller(etapes.length - 1)}
          className="cursor-pointer rounded-pastille border-2 border-encre bg-blanc px-3 py-1 font-mono text-[11px] uppercase tracking-widest"
        >
          Tout d&apos;un coup
        </button>
      </div>
    </div>
  );
}
