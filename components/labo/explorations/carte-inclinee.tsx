"use client";

import { type PointerEvent, useRef } from "react";

import { useMouvementReduit } from "./mouvement-reduit";

/**
 * Une carte produit qui s'incline vers le pointeur, et dont l'ombre dure
 * glisse à l'opposé — comme un sticker qu'on soulève par un coin.
 *
 * Hors Animata. (Animata a bien un `card/tilted-card.tsx`, mais c'est une
 * pastille qui tourne de 2° au survol, sans suivre le pointeur : rien à
 * reprendre. Il pose aussi `text-background` sur un fond gris clair — du
 * texte de la couleur du fond de page, lu dans le code.)
 *
 * Le JavaScript ne fait qu'écrire quatre variables CSS sur l'élément ; React
 * ne refait aucun rendu pendant le mouvement. La transformation et l'ombre
 * sont calculées en CSS (`explorations.css`, `.explo-incline`).
 *
 * Ne réagit qu'à la souris et au stylet : au doigt, incliner une carte qu'on
 * est en train de faire défiler gêne plus qu'autre chose. Sous mouvement
 * réduit, rien ne bouge. Au clavier, la carte est un lien et reçoit le
 * contour de focus du site ; elle ne s'incline pas, l'effet n'apporte aucune
 * information.
 */

const ANGLE = 9; // degrés, au bord de la carte
const OMBRE = 6; // px, décalage de l'ombre au repos

export function CarteInclinee() {
  const reduit = useMouvementReduit();
  const carte = useRef<HTMLAnchorElement>(null);

  const poser = (rx: number, ry: number, suit: boolean) => {
    const c = carte.current;
    if (!c) return;
    c.style.setProperty("--rx", `${rx}deg`);
    c.style.setProperty("--ry", `${ry}deg`);
    // L'ombre fuit le côté qui se soulève.
    c.style.setProperty("--sx", `${OMBRE - (ry / ANGLE) * OMBRE}px`);
    c.style.setProperty("--sy", `${OMBRE + (rx / ANGLE) * OMBRE}px`);
    c.dataset.suit = suit ? "1" : "";
  };

  const bouger = (e: PointerEvent<HTMLAnchorElement>) => {
    if (reduit || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5; // -0,5 … 0,5
    const y = (e.clientY - r.top) / r.height - 0.5;
    poser(-y * 2 * ANGLE, x * 2 * ANGLE, true);
  };

  return (
    <a
      ref={carte}
      href="#produit"
      onPointerMove={bouger}
      onPointerLeave={() => poser(0, 0, false)}
      className="explo-incline block w-60 overflow-clip rounded-sticker-lg border-[2.5px] border-encre bg-blanc"
    >
      <div className="h-40 border-b-[2.5px] border-encre bg-lavande-profond" />
      <div className="flex items-baseline justify-between gap-2 p-4">
        <div>
          <div className="font-bold">Pack Wax</div>
          <div className="meta opacity-70">par Awa K.</div>
        </div>
        <span className="rounded-pastille border-2 border-encre bg-jaune px-2 py-0.5 font-mono text-xs">
          4 500 F
        </span>
      </div>
    </a>
  );
}
