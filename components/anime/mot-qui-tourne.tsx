"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

import { useMouvementReduit } from "./mouvement-reduit";

/**
 * Un mot qui en remplace un autre, par le bas — puis revient au premier.
 *
 * Adapté d'Animata, `animata/text/cycle-text.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`), par le labo « explorations »
 * (`components/labo/explorations/texte.tsx`) :
 *
 * - plus de `motion` (un `<motion.h1>` dans `AnimatePresence`, 41 Kio pour un
 *   mot) : deux images clés CSS, déclenchées par `data-etat` ;
 * - plus de `<h1>` dans un `<span>` (HTML invalide dans l'original, lu dans
 *   le code) ;
 * - la largeur ne saute pas : tous les mots partagent la même case de grille,
 *   qui prend la largeur du plus long ;
 * - IL S'ARRÊTE SUR LE PREMIER MOT, après `tours` passages (WCAG 2.2.2), et
 *   ne démarre pas sous mouvement réduit.
 *
 * Ce qui change ici : le lecteur d'écran n'entend QUE le premier mot. Dans un
 * titre, la liste entière le changerait — « Publie tes ressources,
 * illustrations, polices… » — pour les lecteurs d'écran comme pour les
 * moteurs. Le premier mot est donc celui de la phrase d'origine.
 */
export function MotQuiTourne({
  mots,
  intervalle = 1700,
  tours = 1,
  style,
}: {
  /** Le premier est le mot de la phrase : c'est sur lui qu'on s'arrête. */
  mots: string[];
  intervalle?: number;
  tours?: number;
  style?: CSSProperties;
}) {
  const reduit = useMouvementReduit();
  const [pas, setPas] = useState(0);
  const total = mots.length * tours;
  // Il ne tourne qu'une fois à l'écran : posé loin dans la page, il aurait
  // fini avant qu'on y arrive.
  const zone = useRef<HTMLSpanElement>(null);
  const [vu, setVu] = useState(false);

  useEffect(() => {
    const z = zone.current;
    if (!z || vu) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVu(true);
      },
      { threshold: 0.8 },
    );
    obs.observe(z);
    return () => obs.disconnect();
  }, [vu]);

  useEffect(() => {
    if (reduit || !vu || pas >= total) return;
    const m = setTimeout(() => setPas((p) => p + 1), intervalle);
    return () => clearTimeout(m);
  }, [reduit, vu, pas, total, intervalle]);

  // Au repos — avant le départ, et une fois le dernier mot sorti —, la case
  // se replie sur le mot affiché. Mesuré le 09/10 : gardée à la largeur du
  // plus long (« illustrations »), elle laissait un trou avant le point de
  // « Publie tes ressources . ». Pendant la rotation, la largeur fixe reste :
  // c'est elle qui empêche la ligne de bouger à chaque mot.
  const [fini, setFini] = useState(false);
  useEffect(() => {
    if (pas < total || fini) return;
    const m = setTimeout(() => setFini(true), 500);
    return () => clearTimeout(m);
  }, [pas, total, fini]);
  const repos = pas === 0 || fini;

  const actif = pas % mots.length;
  const precedent = pas === 0 ? -1 : (pas - 1) % mots.length;

  return (
    <>
      <span className="sr-only">{mots[0]}</span>
      <span
        ref={zone}
        aria-hidden
        style={{ display: "inline-grid", overflow: "clip", verticalAlign: "bottom", ...style }}
      >
        {mots.map((m, i) => (
          <span
            key={m}
            className="mot-tourne"
            style={{ gridArea: "1 / 1", display: repos && i !== actif ? "none" : undefined }}
            data-etat={i === actif ? (pas === 0 ? "pose" : "entre") : i === precedent ? "sort" : "cache"}
          >
            {m}
          </span>
        ))}
      </span>
    </>
  );
}
