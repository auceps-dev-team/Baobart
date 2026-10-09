"use client";

import { type CSSProperties, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Le bouton « j'aime » qui éclate quand on aime — et seulement là.
 *
 * Hors Animata (Animata a `icon/hover-interaction.tsx`, des icônes qui
 * s'animent au survol : rien sur un état qui change).
 *
 * CSS seulement, React ne fait que basculer l'état :
 * - le cœur grossit et revient (`explo-coeur-bat`) ;
 * - huit éclats partent en étoile, chacun avec son angle (`--a`), puis
 *   s'éteignent. Ils sont REMONTÉS à chaque « j'aime » (la clé change), ce
 *   qui relance leur animation ; retirer son « j'aime » ne les montre pas.
 *
 * Couleurs : l'orange de la marque ne sert qu'en SURFACE (§4.2). Aimé, le
 * bouton entier passe en orange, texte d'encre — contraste 5,37:1 (calculé
 * le 08/10, formule WCAG, #121212 sur #e2622c ; le blanc n'y ferait que 3,49:1).
 *
 * Mouvement réduit : les éclats ne sont pas affichés et le cœur ne bat pas
 * (`explorations.css`) ; l'état, lui, change pareil. Lecteurs d'écran :
 * `aria-pressed` dit l'état, le nombre est lu avec le libellé.
 */

const ECLATS = [0, 45, 90, 135, 180, 225, 270, 315];

export function BoutonJaime({ depart = 127 }: { depart?: number }) {
  const [aime, setAime] = useState(false);
  const [salve, setSalve] = useState(0);
  const nombre = depart + (aime ? 1 : 0);

  return (
    <button
      type="button"
      aria-pressed={aime}
      onClick={() => {
        if (!aime) setSalve((s) => s + 1);
        setAime((a) => !a);
      }}
      className={cn(
        "relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-pastille border-[2.5px] border-encre px-4 font-bold shadow-sticker sticker-press",
        aime ? "bg-orange" : "bg-blanc",
      )}
    >
      <span className="relative grid place-items-center" aria-hidden>
        <span key={salve} className={cn("text-lg leading-none", salve > 0 && aime && "explo-coeur-bat")}>
          {aime ? "♥" : "♡"}
        </span>
        {aime && salve > 0 ? (
          <span key={`e${salve}`} className="explo-eclats absolute inset-0">
            {ECLATS.map((a) => (
              <span key={a} className="explo-eclat" style={{ "--a": `${a}deg` } as CSSProperties} />
            ))}
          </span>
        ) : null}
      </span>
      <span className="tabular-nums">
        <span className="sr-only">J&apos;aime, </span>
        {nombre}
      </span>
    </button>
  );
}
