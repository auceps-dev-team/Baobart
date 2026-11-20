"use client";

import { useState, type ReactNode } from "react";

/**
 * Le menu du tableau de bord, replié sous 980 px (D2a, Q-04 de la recette du 14/11).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI
 *
 * Sous 980 px, la barre latérale passe au-dessus du contenu, sur toute la
 * largeur (`globals.css`, « Le tableau de bord sous 980 px »). Avec ses vingt
 * entrées, elle occupait tout le premier écran : le titre de la page commençait
 * à 982 px pour un écran de 740 (mesuré le 20/11, `e2e/qa-personas.spec.ts`,
 * Q-04). Après l'inscription, on ne voyait que le menu.
 *
 * Replié, le menu tient sur une ligne, et la page commence dans le premier écran.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUE LA MAQUETTE DIT, ET CE QU'ELLE NE DIT PAS
 *
 * `Baobart Mobile.dc.html`, écran 04, ne dessine qu'une barre d'onglets de cinq
 * entrées (Accueil, Explorer, Achats, Atelier, Profil). Les vingt entrées du
 * menu créateur n'y ont pas de place. Ce bouton est donc un ajout, en attendant
 * la barre d'onglets de D2b : elle ne pourra pas, seule, remplacer le menu.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SANS SAUT À L'AFFICHAGE
 *
 * Le serveur rend le menu REPLIÉ. Au bureau, la règle qui le cache ne
 * s'applique pas (elle vit sous `@media (max-width: 980px)`) et ce composant
 * est transparent (`display: contents`) : rien ne bouge. Sur un téléphone, la
 * première image est déjà la bonne, avant même que JavaScript ne s'exécute.
 */
export function RepliMobile({ children }: { children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="repli-mobile" data-repli={ouvert ? "ouvert" : "replie"}>
      <button
        type="button"
        className="repli-mobile-bouton pression"
        aria-expanded={ouvert}
        aria-controls="menu-espace"
        onClick={() => setOuvert((o) => !o)}
      >
        <span>Menu de l&apos;espace</span>
        <span aria-hidden="true">{ouvert ? "▾" : "▸"}</span>
      </button>
      <div id="menu-espace" className="repli-mobile-corps">
        {children}
      </div>
    </div>
  );
}
