import type { Barre } from "@/lib/dashboard/mois";
import { ENCRE, ORANGE } from "@/lib/systeme/charte";

/**
 * « Revenus par mois » de la maquette : six barres orange, le montant au-dessus.
 *
 * Sans bibliothèque de graphiques : six barres se dessinent en CSS, et une
 * dépendance de plus pour cela serait du poids envoyé à chaque visite.
 * Un mois négatif (plus de remboursements que de ventes) garde une barre
 * nulle et affiche son montant : la hauteur ne ment pas, le chiffre non plus.
 *
 * En `flex`, pas en `grid` : sous 900 px, `app/globals.css` ramène à une
 * colonne toute grille déclarée en ligne (une règle de mise en page, v1.72.2).
 * En grille, les six mois s'empilaient dans les 190 px et recouvraient la carte
 * suivante (mesuré le 21/11 à 360 px : six rangées au lieu d'une, sur les trois
 * pages qui l'emploient). Gardé par `e2e/mobile.spec.ts`.
 *
 * Sous 620 px, la maquette mobile (`Baobart Mobile.dc.html`, écrans 04 et 10)
 * dessine les barres sans montant, à 5 px d'écart : `.graphique-mois` dans
 * `globals.css`. Ce n'est pas qu'une question de goût — mesuré le 21/11 à
 * 360 px, « 1 234,6k » fait 51 px dans une colonne de 31 et mordait sur ses
 * voisines. Les montants restent dans l'`aria-label`, et celui du mois en cours
 * sur la carte du dessus.
 */
export function RevenusParMois({
  barres,
  format,
  couleur = ORANGE,
  quoi = "Revenus",
}: {
  barres: Barre[];
  format: (montant: number) => string;
  /** Orange pour l'argent, jaune pour l'audience — comme la maquette. */
  couleur?: string;
  quoi?: string;
}) {
  const max = Math.max(1, ...barres.map((b) => b.montant));
  return (
    <div
      role="img"
      aria-label={`${quoi} des six derniers mois : ${barres.map((b) => `${b.libelle} ${format(b.montant)}`).join(", ")}`}
      className="graphique-mois"
      style={{ display: "flex", alignItems: "flex-end", height: 190, borderTop: `2px solid ${ENCRE}`, paddingTop: 14 }}
    >
      {barres.map((b) => (
        <div key={b.cle} style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end", height: "100%", gap: 6 }}>
          <span className="graphique-mois-montant" style={{ fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "center", opacity: 0.75 }}>{format(b.montant)}</span>
          <span
            style={{
              height: `${Math.max(0, (b.montant / max) * 100)}%`,
              minHeight: b.montant > 0 ? 6 : 2,
              border: `2px solid ${ENCRE}`,
              borderRadius: 8,
              background: b.montant > 0 ? couleur : "transparent",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 800, textAlign: "center" }}>{b.libelle}</span>
        </div>
      ))}
    </div>
  );
}
