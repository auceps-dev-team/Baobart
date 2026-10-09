"use client";

import { type KeyboardEvent, type ReactNode, useId, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Des onglets dont la pastille glisse de l'un à l'autre.
 *
 * Adapté d'Animata, `animata/tabs/fluid-tabs.tsx` et `tabs/shared.ts` (MIT,
 * voir `components/labo/animata/LICENCE-animata.md`). Ce qui a changé :
 *
 * - PLUS DE `motion`. L'original fait glisser la pastille par `layoutId` sur
 *   un `motion.span`, qui fait monter le paquet à 41 Kio (mesure du 08/10, labo
 *   Animata). Ici on mesure l'onglet actif (`offsetLeft`, `offsetWidth`) et on
 *   pose une transition CSS sur `transform` et `width`. Le ressort devient une
 *   courbe de Bézier qui dépasse un peu, comme lui.
 * - UN SEUL ARRÊT DE TABULATION. L'original pose `tabIndex={0}` sur la liste,
 *   n'en pose aucun sur les onglets, et calcule un `focusedIndex` qu'aucun
 *   onglet ne lit (lu dans `fluid-tabs.tsx` : `FluidTabsTab` ne déstructure
 *   que `setFocusedIndex`). Résultat attendu, non rendu : Tab passe par chaque
 *   onglet, l'index d'onglet « itinérant » est tenu à jour pour rien — un
 *   succès silencieux. Ici, `tabIndex` vaut 0 sur l'onglet actif, -1 ailleurs.
 * - DES PANNEAUX. L'original n'a ni `aria-controls` ni `role="tabpanel"`.
 * - Activation automatique (les flèches choisissent), au lieu de « flèches
 *   puis Entrée » : les panneaux sont instantanés, c'est le cas où le motif
 *   ARIA la recommande.
 * - Repli : avant la première mesure (rendu serveur, hydratation), l'onglet
 *   actif porte lui-même le fond jaune ; la pastille ne prend le relais
 *   qu'une fois placée. Mouvement réduit : la règle globale ramène la
 *   transition à 0,01 ms, la pastille saute.
 */
export function OngletsGlissants({
  onglets,
}: {
  onglets: { titre: string; contenu: ReactNode }[];
}) {
  const base = useId();
  const [actif, setActif] = useState(0);
  const [pastille, setPastille] = useState<{ x: number; l: number } | null>(null);
  const liste = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const l = liste.current;
    if (!l) return;
    const mesurer = () => {
      const b = l.querySelectorAll<HTMLElement>('[role="tab"]')[actif];
      if (b) setPastille({ x: b.offsetLeft, l: b.offsetWidth });
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(l);
    return () => obs.disconnect();
  }, [actif]);

  const choisir = (i: number) => {
    setActif(i);
    liste.current?.querySelectorAll<HTMLElement>('[role="tab"]')[i]?.focus();
  };

  const clavier = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = onglets.length;
    const suivant =
      e.key === "ArrowRight"
        ? (actif + 1) % n
        : e.key === "ArrowLeft"
          ? (actif - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (suivant === null) return;
    e.preventDefault();
    choisir(suivant);
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <div
        ref={liste}
        role="tablist"
        aria-label="Tableau de bord"
        onKeyDown={clavier}
        className="relative flex w-fit gap-1 rounded-pastille border-[2.5px] border-encre bg-blanc p-1 shadow-sticker"
      >
        {pastille ? (
          <span
            aria-hidden
            className="explo-pastille absolute inset-y-1 left-0 rounded-pastille border-2 border-encre bg-jaune"
            style={{ width: pastille.l, transform: `translateX(${pastille.x}px)` }}
          />
        ) : null}
        {onglets.map((o, i) => (
          <button
            key={o.titre}
            type="button"
            role="tab"
            id={`${base}-o${i}`}
            aria-selected={i === actif}
            aria-controls={`${base}-p${i}`}
            tabIndex={i === actif ? 0 : -1}
            onClick={() => choisir(i)}
            className={cn(
              "relative z-10 cursor-pointer rounded-pastille border-2 px-4 py-2 font-bold whitespace-nowrap",
              // Avant la mesure, l'onglet actif se marque lui-même.
              i === actif && !pastille ? "border-encre bg-jaune" : "border-transparent",
            )}
          >
            {o.titre}
          </button>
        ))}
      </div>
      {onglets.map((o, i) => (
        <div
          key={o.titre}
          role="tabpanel"
          id={`${base}-p${i}`}
          aria-labelledby={`${base}-o${i}`}
          hidden={i !== actif}
          tabIndex={0}
          className="rounded-sticker-md border-[2.5px] border-encre bg-lavande-clair p-5"
        >
          {o.contenu}
        </div>
      ))}
    </div>
  );
}
