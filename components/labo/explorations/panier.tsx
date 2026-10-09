"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Ajouter au panier : le libellé bascule, la pastille du panier rebondit.
 *
 * Deux morceaux, deux provenances.
 *
 * LE BOUTON est adapté d'Animata, `animata/text/swap-text.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`). Ce qui a changé :
 *
 * - LA BASCULE SUIT UN ÉTAT, PLUS LE SURVOL. L'original bascule au survol
 *   (`supportsHover`, vrai par défaut) ET au clic : survoler montre « l'autre »
 *   libellé sans que rien ne soit arrivé. Pour un panier, le libellé dit ce
 *   qui est vrai, il ne s'essaie pas.
 * - UN SEUL LIBELLÉ POUR LES LECTEURS D'ÉCRAN. L'original laisse les deux
 *   textes dans le bouton : un lecteur d'écran annonce « Ajouter au panier
 *   Dans le panier » (lu dans le code). Ici les deux lignes visuelles sont
 *   `aria-hidden` et le nom accessible est l'état courant. Pas
 *   d'`aria-pressed` : un bouton bascule garde le même libellé (motif ARIA) ;
 *   ici c'est le libellé qui porte l'état, les deux ensemble se
 *   contrediraient (« Dans le panier, enfoncé »).
 * - `ease-slow` retiré : ce n'est pas une classe de Tailwind. Vérifié le
 *   08/10 : absente de `app/globals.css` ET de `styles/globals.css` d'Animata,
 *   qui déclare pourtant ses autres extensions (`--animate-bg-position`…).
 *   Elle ne ferait donc rien, même chez eux — un succès silencieux, la
 *   transition retombe sur `ease`. Non vérifié : une définition dans un autre
 *   fichier d'Animata que ces deux-là.
 * - durée 1000 ms → 350 ms : une seconde pour un libellé de bouton, c'est un
 *   bouton qui hésite.
 *
 * LA PASTILLE est hors Animata : un rebond CSS, rejoué en changeant la clé de
 * l'élément, et seulement quand le nombre change — pas au premier rendu.
 */
export function AjoutPanier() {
  const [dedans, setDedans] = useState(false);
  const [nombre, setNombre] = useState(2);
  const [abouge, setAbouge] = useState(false);

  const basculer = () => {
    setDedans((d) => !d);
    setNombre((n) => (dedans ? n - 1 : n + 1));
    setAbouge(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-6">
      <button
        type="button"
        onClick={basculer}
        className={cn(
          "relative h-12 cursor-pointer overflow-clip rounded-sticker-md border-[2.5px] border-encre px-5 shadow-sticker",
          "font-display text-sm uppercase tracking-wide sticker-press",
          dedans ? "bg-lavande-profond" : "bg-jaune",
        )}
      >
        <span className="sr-only">{dedans ? "Dans le panier — retirer" : "Ajouter au panier"}</span>
        <span aria-hidden className="explo-bascule grid" data-actif={dedans || undefined}>
          <span className="col-start-1 row-start-1">Ajouter au panier</span>
          <span className="col-start-1 row-start-1">Dans le panier ✓</span>
        </span>
      </button>

      <a
        href="#panier"
        className="relative inline-flex h-12 items-center gap-2 rounded-pastille border-[2.5px] border-encre bg-blanc px-5 font-bold shadow-sticker"
      >
        Panier
        <span
          key={nombre}
          className={cn(
            "inline-grid h-7 min-w-7 place-items-center rounded-pastille border-2 border-encre bg-orange px-1.5 font-mono text-xs text-encre",
            abouge && "explo-rebond",
          )}
        >
          {nombre}
          <span className="sr-only"> article{nombre > 1 ? "s" : ""}</span>
        </span>
      </a>
      {/* Annonce polie : la pastille change sans que le focus bouge. */}
      <span role="status" className="sr-only">
        {abouge ? `${nombre} article${nombre > 1 ? "s" : ""} dans le panier` : ""}
      </span>
    </div>
  );
}
