import { BLANC, ENCRE } from "@/lib/systeme/charte";

/**
 * La vignette carrée d'une ressource dans les listes du tableau de bord —
 * « Mes ressources », « Dernières ventes » (`Baobart Dashboard.dc.html`).
 *
 * La couverture quand elle existe (`Product.coverUrl`, déjà résolue : aucune
 * lecture de plus par ligne). Sinon les rayures de la maquette, dont la
 * couleur suit le titre : la même ressource garde la même vignette d'un écran
 * à l'autre, et deux voisines se distinguent.
 */
const RAYURES = ["#C9A8F5", "#E2622C", "#FFD84A", ENCRE];

export function Vignette({ couverture, titre, taille = 42 }: { couverture: string | null; titre: string; taille?: number }) {
  const teinte = RAYURES[[...titre].reduce((s, c) => s + c.charCodeAt(0), 0) % RAYURES.length];
  return (
    <span
      aria-hidden
      style={{
        width: taille,
        height: taille,
        flex: "0 0 auto",
        border: `2px solid ${ENCRE}`,
        borderRadius: 10,
        background: couverture
          ? `center / cover no-repeat url(${JSON.stringify(couverture)})`
          : `repeating-linear-gradient(135deg,${teinte} 0 6px,${BLANC} 6px 12px)`,
      }}
    />
  );
}
