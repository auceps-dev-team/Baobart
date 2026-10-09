import type { CSSProperties } from "react";

/**
 * Les huit éclats d'un « j'aime » qui part.
 *
 * Repris de `components/labo/explorations/jaime.tsx` (hors Animata). Ils ne
 * s'affichent que si `salve` est positif ; l'appelant l'augmente à chaque
 * nouveau « j'aime », et la clé qui change REMONTE les éclats, ce qui relance
 * leur animation. Retirer son « j'aime » n'en montre aucun.
 *
 * Décoratifs : `aria-hidden`, et retirés sous mouvement réduit
 * (`globals.css`, section INTERACTIONS).
 *
 * Le parent doit être positionné (`position: relative`).
 */
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function Eclats({ salve }: { salve: number }) {
  if (salve <= 0) return null;
  return (
    <span key={salve} aria-hidden className="eclats">
      {ANGLES.map((a) => (
        <span key={a} className="eclat" style={{ "--a": `${a}deg` } as CSSProperties} />
      ))}
    </span>
  );
}
