"use client";

import { type PointerEvent, type ReactNode, useRef } from "react";

import { useMouvementReduit } from "./mouvement-reduit";

/**
 * Ce qu'il enveloppe s'incline vers le pointeur, comme un sticker qu'on
 * soulève par un coin.
 *
 * Repris de `components/labo/explorations/carte-inclinee.tsx` (hors Animata).
 * Le JavaScript n'écrit que deux variables CSS ; React ne refait aucun rendu
 * pendant le mouvement. La transformation est en CSS (`.incline`).
 *
 * Ce qui a changé : l'ombre ne glisse plus. Au labo, l'élément incliné
 * portait lui-même son ombre ; ici il enveloppe une carte qui a la sienne,
 * en style en ligne, que des variables posées sur l'enveloppe ne
 * déplaceraient pas.
 *
 * Ne réagit qu'à la souris et au stylet : au doigt, incliner une carte qu'on
 * fait défiler gêne. Sous mouvement réduit, rien ne bouge. Au clavier, rien
 * non plus : l'effet n'apporte aucune information.
 */
const ANGLE = 6; // degrés, au bord

export function Inclinable({ children }: { children: ReactNode }) {
  const reduit = useMouvementReduit();
  const zone = useRef<HTMLDivElement>(null);

  const poser = (rx: number, ry: number, suit: boolean) => {
    const z = zone.current;
    if (!z) return;
    z.style.setProperty("--rx", `${rx}deg`);
    z.style.setProperty("--ry", `${ry}deg`);
    z.dataset.suit = suit ? "1" : "";
  };

  const bouger = (e: PointerEvent<HTMLDivElement>) => {
    if (reduit || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    poser(-y * 2 * ANGLE, x * 2 * ANGLE, true);
  };

  return (
    <div ref={zone} className="incline" onPointerMove={bouger} onPointerLeave={() => poser(0, 0, false)}>
      {children}
    </div>
  );
}
