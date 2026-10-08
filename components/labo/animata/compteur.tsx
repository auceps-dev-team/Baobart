"use client";

import {
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

/** Un nombre au format ivoirien : espace fine insécable entre les milliers. */
export const enNombre = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));

/** Un montant en francs CFA, sans décimales. */
export const enFrancs = (v: number) => `${enNombre(v)} F`;

/**
 * Un nombre qui défile jusqu'à sa valeur quand il entre à l'écran.
 *
 * Adapté d'Animata, `animata/text/counter.tsx` (MIT, voir
 * LICENCE-animata.md). Ce qui a changé :
 *
 * - LE RENDU SERVEUR PORTE LA VRAIE VALEUR. L'original rend `0` côté serveur
 *   et compte jusqu'à la cible une fois dans le navigateur. Sans JavaScript,
 *   pour un moteur de recherche ou un aperçu de lien, « 12 480 ressources »
 *   devenait « 0 ressource » : un succès silencieux, la page se rend et ment.
 *   Ici la valeur juste est écrite d'abord, et ramenée à zéro seulement au
 *   montage, juste avant de défiler. Le prix : au-dessus de la ligne de
 *   flottaison, la vraie valeur peut apparaître le temps de l'hydratation,
 *   puis repartir de zéro.
 * - MOUVEMENT RÉDUIT RESPECTÉ. Le ressort est animé en JavaScript : la règle
 *   `prefers-reduced-motion` de `globals.css` ne le voit pas. Il faut le
 *   demander à `motion` (`useReducedMotion`), sinon le nombre défile quand même.
 * - `"use client"` ajouté : l'original appelle des hooks sans le déclarer, et
 *   ne marche dans l'App Router que si son parent est déjà client.
 * - format `fr-FR` au lieu de `en-US`, francs au lieu de dollars.
 */
export function Compteur({
  cible,
  format = enNombre,
  delai = 0,
  className,
}: {
  cible: number;
  format?: (v: number) => string;
  /** Délai avant de défiler, en millisecondes. */
  delai?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduit = useReducedMotion();
  const valeur = useMotionValue(cible);
  const ressort = useSpring(valeur, { damping: 60, stiffness: 80 });
  const visible = useInView(ref, { once: true });

  useEffect(() => {
    if (reduit) return;
    valeur.jump(0);
    ressort.jump(0);
  }, [reduit, valeur, ressort]);

  useEffect(() => {
    if (!visible || reduit) return;
    const minuteur = setTimeout(() => valeur.set(cible), delai);
    return () => clearTimeout(minuteur);
  }, [visible, reduit, delai, cible, valeur]);

  useMotionValueEvent(ressort, "change", (v) => {
    if (ref.current) ref.current.textContent = format(v);
  });

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {format(cible)}
    </span>
  );
}
