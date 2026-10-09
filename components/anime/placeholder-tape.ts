"use client";

import { useEffect, useState } from "react";

import { useMouvementReduit } from "./mouvement-reduit";

/**
 * L'indication d'un champ de recherche qui tape ses exemples, une fois.
 *
 * Adapté d'Animata, `animata/text/typing-text.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`), par le labo « explorations »
 * (`components/labo/explorations/texte.tsx`). Ce qui change pour l'en-tête :
 *
 * - c'est l'attribut `placeholder` qui tape, pas un texte posé par-dessus le
 *   champ : le champ garde sa structure, son nom accessible (`aria-label`) et
 *   ses suggestions, et rien ne masque ce qu'on tape ;
 * - LE RENDU SERVEUR PORTE L'INDICATION ENTIÈRE (`base`). L'original rendait
 *   `text.slice(0, 1)` — une lettre sans JavaScript (lu dans le code) ;
 * - UN SEUL TOUR, puis retour à `base` et fin : l'original boucle sans fin,
 *   ce qui tombe sous WCAG 2.2.2. Il s'interrompt dès qu'on entre dans le
 *   champ ou qu'on y tape (`pause`), et ne démarre pas sous mouvement réduit.
 * - le curseur est un caractère « ▏ » pendant la frappe : un `placeholder` ne
 *   se stylise pas en partie, il ne peut donc pas clignoter.
 */
export function usePlaceholderTape({
  base,
  prefixe,
  exemples,
  pause,
  cleSession = "baobart:indication-tapee",
  delai = 55,
  attente = 1300,
}: {
  /** L'indication complète, au repos. */
  base: string;
  /** Ce qui reste écrit entre deux exemples (« Cherche »). */
  prefixe: string;
  /** Ce qui suit le préfixe, tour à tour. */
  exemples: string[];
  /** Vrai dès que l'utilisateur est dans le champ ou y a tapé. */
  pause: boolean;
  /** La clé de `sessionStorage` qui retient que la frappe a eu lieu. */
  cleSession?: string;
  delai?: number;
  attente?: number;
}) {
  const reduit = useMouvementReduit();
  const [texte, setTexte] = useState(base);
  const [fini, setFini] = useState(false);
  const cle = exemples.join("\u0000");

  useEffect(() => {
    if (reduit || fini) return;
    // Une fois par session de navigation : l'en-tête est sur chaque page, et
    // une frappe à chaque clic deviendrait du bruit. Stockage indisponible
    // (navigation privée, données bloquées) : on joue, simplement.
    if (dejaJoue(cleSession)) {
      setFini(true);
      return;
    }
    // L'utilisateur est entré dans le champ : on revient à l'indication
    // entière, et on ne recommencera pas.
    if (pause) {
      setTexte(base);
      setFini(true);
      marquerJoue(cleSession);
      return;
    }
    const liste = cle.split("\u0000");
    let annule = false;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const attendre = (ms: number) =>
      new Promise<void>((r) => {
        minuteur = setTimeout(r, ms);
      });
    const effacerJusqua = async (de: string, longueur: number) => {
      for (let n = de.length - 1; n >= longueur; n--) {
        if (annule) return;
        setTexte(`${de.slice(0, n)}▏`);
        await attendre(delai / 2);
      }
    };
    const taper = async (cible: string, depuis: number) => {
      for (let n = depuis + 1; n <= cible.length; n++) {
        if (annule) return;
        setTexte(`${cible.slice(0, n)}▏`);
        await attendre(delai);
      }
    };

    (async () => {
      let courant = base;
      for (const ex of liste) {
        await attendre(attente);
        if (annule) return;
        const cible = `${prefixe} ${ex}`;
        await effacerJusqua(courant, prefixe.length + 1);
        await taper(cible, prefixe.length + 1);
        courant = cible;
      }
      await attendre(attente);
      if (annule) return;
      await effacerJusqua(courant, prefixe.length + 1);
      await taper(base, prefixe.length + 1);
      if (!annule) {
        setTexte(base);
        setFini(true);
        marquerJoue(cleSession);
      }
    })();

    return () => {
      annule = true;
      clearTimeout(minuteur);
      // Le nettoyage remet l'indication entière, mais ne marque PAS la fin :
      // en développement, React monte, démonte et remonte chaque effet (mode
      // strict) ; marquer la fin ici empêcherait la frappe de jamais jouer,
      // sans la moindre erreur.
      setTexte(base);
    };
  }, [reduit, pause, fini, cle, base, prefixe, delai, attente, cleSession]);

  return texte;
}

function dejaJoue(cle: string): boolean {
  try {
    return window.sessionStorage.getItem(cle) === "1";
  } catch {
    return false;
  }
}

function marquerJoue(cle: string) {
  try {
    window.sessionStorage.setItem(cle, "1");
  } catch {
    // Stockage indisponible : la frappe rejouera à la page suivante.
  }
}
