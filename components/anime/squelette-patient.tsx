"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";

import { DELAI_SQUELETTE_MS, FONDU_MS, resteAMontrer } from "@/lib/systeme/patience";

/**
 * Le squelette qui ne clignote pas, et le contenu qui arrive en fondu.
 *
 * La règle et ses chiffres : `lib/systeme/patience.ts`. Ici, sa mécanique.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX MOITIÉS, PARCE QUE LE SQUELETTE ET LE CONTENU NE COEXISTENT JAMAIS
 *
 * Le squelette est un `loading.tsx` : React le retire du DOM à l'instant où la
 * page arrive. Il ne peut donc pas « rester encore 300 ms » de lui-même.
 *
 *   — `MarqueurSquelette`, posé dans le `loading.tsx`, note l'instant où le
 *     squelette devient visible — `DELAI_SQUELETTE_MS` après son insertion,
 *     le même délai que la classe CSS `squelette-patient` qui le cache
 *     jusque-là ;
 *   — `Revelation`, autour du contenu, lit cet instant à son arrivée. S'il
 *     manque du temps pour atteindre le minimum, il repose un VOILE identique
 *     au squelette par-dessus le contenu, puis le lève en fondu.
 *
 * L'instant passe par une variable de module : les deux moitiés vivent dans le
 * même module, chargé une fois par onglet.
 *
 * L'ordre de React rend la lecture sûre : le `useLayoutEffect` de
 * `Revelation` s'exécute avant le nettoyage (`useEffect`) du marqueur retiré.
 * Le marqueur remet la variable à zéro ensuite, ce qui couvre le cas où l'on
 * quitte la page avant l'arrivée du contenu.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SANS JAVASCRIPT, RIEN NE RESTE CACHÉ
 *
 * Les deux fondus sont des animations CSS (`globals.css`), pas des états
 * React : le contenu rendu par le serveur apparaît même si ce module n'est
 * jamais exécuté. Seul le voile, qui retarde, dépend de JavaScript — et sans
 * JavaScript il n'y a simplement pas de voile.
 *
 * Sous mouvement réduit, la règle globale de `globals.css` ramène les fondus à
 * zéro ; le délai et le minimum restent, car ils ne sont pas du mouvement.
 */

let visibleDepuis: number | null = null;

export function MarqueurSquelette() {
  useEffect(() => {
    const minuteur = window.setTimeout(() => {
      visibleDepuis = performance.now();
    }, DELAI_SQUELETTE_MS);
    return () => {
      window.clearTimeout(minuteur);
      visibleDepuis = null;
    };
  }, []);
  return null;
}

export function Revelation({ squelette, children }: { squelette: ReactNode; children: ReactNode }) {
  const [voile, setVoile] = useState<"pose" | "leve" | null>(null);

  // Avant la première peinture : posé dans un `useEffect`, le voile
  // arriverait une image trop tard, et le contenu aurait déjà flashé.
  useLayoutEffect(() => {
    const reste = resteAMontrer(visibleDepuis, performance.now());
    visibleDepuis = null;
    if (reste === 0) return;

    setVoile("pose");
    const lever = window.setTimeout(() => setVoile("leve"), reste);
    const retirer = window.setTimeout(() => setVoile(null), reste + FONDU_MS);
    return () => {
      window.clearTimeout(lever);
      window.clearTimeout(retirer);
    };
  }, []);

  return (
    <>
      <div className="apparition-douce" style={{ animationDuration: `${FONDU_MS}ms` }}>
        {children}
      </div>
      {voile && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            // Au-dessus de l'en-tête et de ses menus (40 à 55), sous le
            // bandeau des cookies (1000) : le squelette d'origine ne montrait
            // pas l'en-tête non plus.
            zIndex: 60,
            overflow: "hidden",
            opacity: voile === "leve" ? 0 : 1,
            transition: `opacity ${FONDU_MS}ms ease-out`,
            // Tant qu'il couvre, il retient les clics : on ne clique pas sur
            // une carte qu'on ne voit pas encore. Il les laisse passer dès
            // qu'il se lève.
            pointerEvents: voile === "leve" ? "none" : "auto",
          }}
        >
          {squelette}
        </div>
      )}
    </>
  );
}
