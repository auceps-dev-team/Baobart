import { APLATS, Icone } from "@/components/icones/icone";
import { NOTE_MAX, noteEnToutesLettres } from "@/lib/avis/regles";

/**
 * Cinq icônes « star » (Halo, 14/11/2026) — lues « 4 sur 5 » par un lecteur d'écran, pas
 * « étoile étoile étoile… » : le libellé est porté par l'enveloppe, les icônes sont muettes.
 * Le contraste tient au contour encre (bien au-delà des 3:1 d'un graphique, WCAG 1.4.11).
 *
 * Avant, c'était du texte « ★ » : l'orange de la charte y donnait 3,07:1 sur lavande
 * (mesuré par axe le 08/11), d'où un orange assombri (#B4471A). Une icône à contour
 * encre n'a plus ce problème.
 */
export function Etoiles({ note, taille = 13 }: { note: number; taille?: number }) {
  const pleines = Math.round(note);
  return (
    <span
      role="img"
      aria-label={noteEnToutesLettres(note)}
      style={{ display: "inline-flex", alignItems: "center", gap: 2, whiteSpace: "nowrap", lineHeight: 1 }}
    >
      {Array.from({ length: NOTE_MAX }, (_, i) => (
        <Icone
          key={i}
          nom="star"
          taille={taille + 3}
          decalage={1.2}
          aplat={i < pleines ? APLATS.jaune : APLATS.lavande}
          style={i < pleines ? undefined : { opacity: 0.45 }}
        />
      ))}
    </span>
  );
}
