"use client";

import { useEffect, useId, useState } from "react";

import { cn } from "@/lib/cn";

import { useMouvementReduit } from "./mouvement-reduit";

/**
 * Le champ de recherche qui tape ses propres exemples.
 *
 * Adapté d'Animata, `animata/text/typing-text.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`). Ce qui a changé :
 *
 * - LE RENDU SERVEUR PORTE LE PREMIER EXEMPLE ENTIER. L'original rend
 *   `text.slice(0, 1)` : sans JavaScript, une seule lettre (lu dans le code).
 * - LE CURSEUR NE CLIGNOTE PLUS À 5 HZ. L'original enveloppe son curseur (qui
 *   clignote déjà à 500 ms) dans `CursorWrapper`, qui le masque une fois sur
 *   deux toutes les 100 ms pendant la frappe (lu dans le code, non rendu). Ici
 *   un seul clignotement, en CSS, arrêté sous mouvement réduit.
 * - IL S'ARRÊTE. L'original boucle sans fin (`repeat` vaut `true` par défaut),
 *   ce qui tombe sous WCAG 2.2.2 (contenu qui bouge plus de 5 s sans pause).
 *   Ici : un tour des exemples, retour au premier, fin. Et il s'interrompt dès
 *   qu'on entre dans le champ.
 * - LES LECTEURS D'ÉCRAN NE L'ENTENDENT PAS TAPER. La frappe est `aria-hidden` ;
 *   les exemples sont dits une fois, entiers, par `aria-describedby`.
 * - Deux `setInterval` et deux crochets d'état remplacés par une boucle unique
 *   qu'on annule au démontage.
 */
export function RechercheTapee({
  exemples,
  delai = 55,
  attente = 1400,
}: {
  exemples: string[];
  /** Entre deux lettres, en millisecondes. */
  delai?: number;
  /** Pause sur un exemple complet, en millisecondes. */
  attente?: number;
}) {
  const reduit = useMouvementReduit();
  const id = useId();
  const [valeur, setValeur] = useState("");
  const [focus, setFocus] = useState(false);
  const [affiche, setAffiche] = useState({ texte: exemples[0] ?? "", tape: true });

  // Une clé stable : un tableau littéral passé par la page change d'identité.
  const cle = exemples.join("\u0000");
  const enPause = reduit || focus || valeur !== "";

  useEffect(() => {
    if (enPause) return;
    const liste = cle.split("\u0000");
    const premier = liste[0] ?? "";
    let annule = false;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const attendre = (ms: number) =>
      new Promise<void>((r) => {
        minuteur = setTimeout(r, ms);
      });

    (async () => {
      let courant = premier;
      for (const suivant of [...liste.slice(1), premier]) {
        await attendre(attente);
        for (let n = courant.length - 1; n >= 0; n--) {
          if (annule) return;
          setAffiche({ texte: courant.slice(0, n), tape: true });
          await attendre(delai / 2);
        }
        for (let n = 1; n <= suivant.length; n++) {
          if (annule) return;
          setAffiche({ texte: suivant.slice(0, n), tape: true });
          await attendre(delai);
        }
        courant = suivant;
      }
      if (!annule) setAffiche({ texte: premier, tape: false });
    })();

    return () => {
      annule = true;
      clearTimeout(minuteur);
      // Interrompu : on se repose sur le premier exemple, entier.
      setAffiche({ texte: premier, tape: false });
    };
  }, [enPause, cle, delai, attente]);

  return (
    <label className="relative block w-full max-w-md">
      <span className="sr-only">Rechercher une ressource</span>
      <input
        type="search"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        aria-describedby={id}
        className="h-12 w-full rounded-pastille border-[2.5px] border-encre bg-blanc pl-5 pr-4 font-medium shadow-sticker outline-none focus-visible:outline-[3px] focus-visible:outline-jaune"
      />
      <span id={id} className="sr-only">
        Exemples : {exemples.join(", ")}.
      </span>
      {valeur === "" && !focus ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-5 flex items-center font-medium text-encre/55"
        >
          Essaie «&nbsp;{affiche.texte}
          {affiche.tape && !reduit ? <span className="explo-curseur">|</span> : null}&nbsp;»
        </span>
      ) : null}
    </label>
  );
}

/**
 * Un mot qui en remplace un autre, par le bas.
 *
 * Adapté d'Animata, `animata/text/cycle-text.tsx`. Ce qui a changé :
 *
 * - PLUS DE `motion`. L'original monte un `<motion.h1>` dans `AnimatePresence`
 *   — 41 Kio pour un mot. Ici, deux images clés CSS, déclenchées par un
 *   attribut `data-etat`.
 * - PLUS DE `<h1>` DANS UN `<span>`. L'original y place son mot (HTML invalide,
 *   et un titre de premier niveau par mot affiché). Lu dans le code.
 * - LA LARGEUR NE SAUTE PLUS. Tous les mots occupent la même case de grille ;
 *   la case prend la largeur du plus long, la ligne ne bouge pas.
 * - IL S'ARRÊTE après `tours` passages (WCAG 2.2.2), et ne démarre pas sous
 *   mouvement réduit. Les lecteurs d'écran entendent la liste une fois.
 */
export function MotQuiTourne({
  mots,
  intervalle = 1800,
  tours = 2,
  className,
}: {
  mots: string[];
  intervalle?: number;
  tours?: number;
  className?: string;
}) {
  const reduit = useMouvementReduit();
  const [pas, setPas] = useState(0);
  const total = mots.length * tours;

  useEffect(() => {
    if (reduit || pas >= total) return;
    const m = setTimeout(() => setPas((p) => p + 1), intervalle);
    return () => clearTimeout(m);
  }, [reduit, pas, total, intervalle]);

  const actif = pas % mots.length;
  const precedent = pas === 0 ? -1 : (pas - 1) % mots.length;

  return (
    <span className={cn("inline-grid", className)}>
      <span className="sr-only">{mots.join(", ")}</span>
      <span
        aria-hidden
        className="explo-mots inline-grid overflow-clip rounded-sticker-sm border-[2.5px] border-encre bg-jaune px-3"
      >
        {mots.map((m, i) => (
          <span
            key={m}
            className="explo-mot col-start-1 row-start-1"
            data-etat={i === actif ? (pas === 0 ? "pose" : "entre") : i === precedent ? "sort" : "cache"}
          >
            {m}
          </span>
        ))}
      </span>
    </span>
  );
}
