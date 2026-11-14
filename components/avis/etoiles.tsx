import { NOTE_MAX, noteEnToutesLettres } from "@/lib/avis/regles";

/**
 * L'orange de la charte (#E2622C) donne 3,07:1 sur lavande et 3,5:1 sur blanc
 * pour un petit texte — mesuré par axe le 08/11. Les étoiles des maquettes sont
 * du texte de 12 px : on prend l'orange assombri, celui de « Mes badges ».
 */
export const ORANGE_ETOILES = "#B4471A";

/** ★★★★☆ — lu « 4 sur 5 » par un lecteur d'écran, pas « étoile étoile étoile… ». */
export function Etoiles({ note, taille = 13 }: { note: number; taille?: number }) {
  const pleines = Math.round(note);
  return (
    <span
      role="img"
      aria-label={noteEnToutesLettres(note)}
      style={{ color: ORANGE_ETOILES, fontSize: taille, letterSpacing: ".14em", whiteSpace: "nowrap", lineHeight: 1 }}
    >
      {"★".repeat(pleines)}
      <span style={{ opacity: 0.35 }}>{"★".repeat(NOTE_MAX - pleines)}</span>
    </span>
  );
}
