"use client";

import { useEffect, useRef, useState } from "react";

import { useMouvementReduit } from "./mouvement-reduit";

/**
 * Le paiement a réussi : une poignée de confettis, une fois, puis plus rien.
 *
 * Hors Animata. Un `<canvas>` et une boucle `requestAnimationFrame` d'une
 * soixantaine de lignes — les bibliothèques de confettis pèsent plusieurs
 * kilooctets pour la même chose.
 *
 * Sobre, au sens de la charte : des rectangles aux couleurs de la marque,
 * cernés d'encre, sans flou ni dégradé, 1,6 s et c'est fini. La boucle
 * s'arrête d'elle-même ; elle s'arrête aussi si le composant disparaît.
 *
 * Mouvement réduit : pas de confettis du tout — un `requestAnimationFrame`
 * échappe à la règle globale de `globals.css`. Le message de succès, lui, est
 * identique : l'information ne dépend pas de l'effet.
 *
 * Le canevas est `aria-hidden` et ne capte pas la souris.
 */

const DUREE = 1600;

function lancer(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = window.devicePixelRatio || 1;
  const { width: l, height: h } = canvas.getBoundingClientRect();
  canvas.width = l * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  // Les couleurs viennent des jetons de la charte, pas de codes recopiés.
  const style = getComputedStyle(document.documentElement);
  const jeton = (n: string) => style.getPropertyValue(`--color-${n}`).trim();
  const couleurs = ["jaune", "orange", "lavande-profond", "blanc"].map(jeton);
  const encre = jeton("encre");

  const pieces = Array.from({ length: 70 }, () => ({
    x: l / 2,
    y: h * 0.75,
    vx: (Math.random() - 0.5) * 11,
    vy: -(Math.random() * 8 + 7),
    a: Math.random() * Math.PI,
    va: (Math.random() - 0.5) * 0.3,
    lo: 7 + Math.random() * 6,
    la: 4 + Math.random() * 3,
    c: couleurs[Math.floor(Math.random() * couleurs.length)] ?? encre,
  }));

  const debut = performance.now();
  let id = 0;
  const image = (t: number) => {
    ctx.clearRect(0, 0, l, h);
    if (t - debut > DUREE) return;
    for (const p of pieces) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.a += p.va;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.c;
      ctx.strokeStyle = encre;
      ctx.lineWidth = 1.5;
      ctx.fillRect(-p.lo / 2, -p.la / 2, p.lo, p.la);
      ctx.strokeRect(-p.lo / 2, -p.la / 2, p.lo, p.la);
      ctx.restore();
    }
    id = requestAnimationFrame(image);
  };
  id = requestAnimationFrame(image);
  return () => {
    cancelAnimationFrame(id);
    ctx.clearRect(0, 0, l, h);
  };
}

export function PaiementConfettis() {
  const reduit = useMouvementReduit();
  const toile = useRef<HTMLCanvasElement>(null);
  const arreter = useRef<() => void>(() => {});
  const [paye, setPaye] = useState(false);

  useEffect(() => () => arreter.current(), []);

  const payer = () => {
    setPaye(true);
    arreter.current();
    if (!reduit && toile.current) arreter.current = lancer(toile.current);
  };

  return (
    <div className="relative flex min-h-56 w-full flex-col items-center justify-center gap-4">
      <canvas ref={toile} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
      <div role="status" className="min-h-16 text-center">
        {paye ? (
          <>
            <div className="font-display text-2xl uppercase">Paiement reçu ✓</div>
            <div className="text-sm font-medium opacity-70">Ton pack est dans « Mes achats ».</div>
          </>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={payer}
          className="cursor-pointer rounded-sticker-md border-[2.5px] border-encre bg-jaune px-5 py-3 font-display text-sm uppercase shadow-sticker sticker-press"
        >
          Payer 4 500 F (simulé)
        </button>
        {paye ? (
          <button
            type="button"
            onClick={() => setPaye(false)}
            className="cursor-pointer rounded-pastille border-2 border-encre bg-lavande-clair px-3 py-1 font-mono text-[11px] uppercase tracking-widest"
          >
            ↻ Remettre
          </button>
        ) : null}
      </div>
    </div>
  );
}
