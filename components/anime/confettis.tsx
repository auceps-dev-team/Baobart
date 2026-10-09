"use client";

import { useEffect, useRef } from "react";

import { useMouvementReduit } from "./mouvement-reduit";

/**
 * Une poignée de confettis, une fois, quand un achat aboutit.
 *
 * Repris de `components/labo/explorations/confettis.tsx` (hors Animata) : un
 * `<canvas>` et une boucle `requestAnimationFrame` d'une soixantaine de
 * lignes, aux couleurs de la charte, cernés d'encre, 1,6 s et c'est fini.
 *
 * Ce qui change ici :
 * - ils partent à l'affichage, pas au clic : la page de confirmation est
 *   l'événement ;
 * - UNE FOIS PAR COMMANDE (`cle`, gardée dans `localStorage`). On revient sur
 *   cette page depuis ses achats, ou on la recharge : fêter dix fois le même
 *   paiement, c'est du bruit. La clé n'est posée qu'une fois l'animation
 *   finie : en développement, React monte, démonte et remonte chaque effet
 *   (mode strict) — la poser au démarrage empêcherait les confettis de jamais
 *   partir, sans erreur. Stockage indisponible : ils partent à chaque fois ;
 * - la toile couvre l'écran (`position: fixed`) et ne capte pas la souris.
 *
 * Mouvement réduit : pas de confettis du tout — `requestAnimationFrame`
 * échappe à la règle globale. Le message de succès, lui, est le même : rien
 * ne dépend de l'effet.
 */
const DUREE = 1600;

function lancer(canvas: HTMLCanvasElement, fin: () => void): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = window.devicePixelRatio || 1;
  const l = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = l * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const style = getComputedStyle(document.documentElement);
  const jeton = (n: string) => style.getPropertyValue(`--color-${n}`).trim();
  const couleurs = ["jaune", "orange", "lavande-profond", "blanc"].map(jeton);
  const encre = jeton("encre");

  const pieces = Array.from({ length: 90 }, () => ({
    x: l / 2,
    y: h * 0.6,
    vx: (Math.random() - 0.5) * 16,
    vy: -(Math.random() * 10 + 8),
    a: Math.random() * Math.PI,
    va: (Math.random() - 0.5) * 0.3,
    lo: 8 + Math.random() * 6,
    la: 4 + Math.random() * 3,
    c: couleurs[Math.floor(Math.random() * couleurs.length)] ?? encre,
  }));

  const debut = performance.now();
  let id = 0;
  const image = (t: number) => {
    ctx.clearRect(0, 0, l, h);
    if (t - debut > DUREE) {
      fin();
      return;
    }
    for (const p of pieces) {
      p.vy += 0.38;
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

export function Confettis({ cle }: { cle: string }) {
  const reduit = useMouvementReduit();
  const toile = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduit || !toile.current) return;
    try {
      if (window.localStorage.getItem(cle) === "1") return;
    } catch {
      // Stockage indisponible : on fête quand même.
    }
    return lancer(toile.current, () => {
      try {
        window.localStorage.setItem(cle, "1");
      } catch {
        // Rien à retenir.
      }
    });
  }, [reduit, cle]);

  return (
    <canvas
      ref={toile}
      aria-hidden
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 200 }}
    />
  );
}
