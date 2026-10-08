"use client";

import { type ReactNode, useState } from "react";

/**
 * Rejoue les animations d'entrée de ce qu'il entoure.
 *
 * Changer la clé démonte et remonte le sous-arbre : le navigateur crée de
 * nouveaux éléments, et leurs animations CSS repartent de zéro. Outil du
 * labo seulement.
 */
export function Rejouer({ children }: { children: ReactNode }) {
  const [tour, setTour] = useState(0);

  return (
    <div className="flex flex-col items-start gap-3">
      <div key={tour}>{children}</div>
      <button
        type="button"
        onClick={() => setTour((t) => t + 1)}
        className="cursor-pointer rounded-pastille border-2 border-encre bg-lavande-clair px-3 py-1 font-mono text-[11px] uppercase tracking-widest"
      >
        ↻ Rejouer
      </button>
    </div>
  );
}
