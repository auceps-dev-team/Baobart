"use client";

import { useEffect, useRef } from "react";

import { CHAMP_LEURRE, CHAMP_OUVERTURE } from "@/lib/securite/antibot-champs";

/**
 * Les deux champs que l'anti-bot lit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE LEURRE SE CACHE EN CSS, PAS EN `type="hidden"`
 *
 * Un `<input type="hidden">` se repère d'un coup d'œil dans le HTML : c'est le
 * premier champ qu'un robot un peu écrit laisse vide. Il faut qu'il ressemble à
 * un champ normal pour la machine, et qu'il soit invisible pour la personne.
 *
 * D'où le déport hors de l'écran plutôt qu'un `display: none`, que certains
 * remplisseurs automatiques reconnaissent aussi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ET IL SE DÉCLARE AUX LECTEURS D'ÉCRAN
 *
 * `aria-hidden` et `tabIndex={-1}` : une personne qui navigue au clavier ou à
 * la synthèse vocale ne doit pas tomber dedans. Sans ça, l'anti-bot refuserait
 * précisément les gens qu'un site doit le plus soigner — et le refus serait
 * muet, puisqu'on ne dit jamais quel signal a joué.
 *
 * `autoComplete="off"` pour la même raison, côté remplisseurs de mots de passe.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'HORODATAGE EST POSÉ PAR LE NAVIGATEUR, DONC IL MENT SI ON VEUT
 *
 * Il est écrit après le rendu, ce qui le rend faux pour qui le veut : rien
 * n'empêche de forger la valeur. Ce n'est pas un contrôle d'authenticité,
 * c'est un filtre à robots paresseux — et la plupart le sont.
 *
 * Écrit dans un `useEffect` et non au rendu : le rendu a lieu sur le serveur,
 * et son horloge n'est pas celle de la personne.
 */
export function ChampsAntiBot() {
  const ouverture = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ouverture.current) {
      ouverture.current.value = String(Date.now());
    }
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: -9999,
        top: "auto",
        width: 1,
        height: 1,
        overflow: "hidden",
      }}
    >
      <label htmlFor={CHAMP_LEURRE}>Société</label>
      <input
        id={CHAMP_LEURRE}
        name={CHAMP_LEURRE}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
      <input ref={ouverture} name={CHAMP_OUVERTURE} type="text" tabIndex={-1} />
    </div>
  );
}
