import type { Barre } from "@/lib/dashboard/mois";
import { ENCRE, ORANGE } from "@/lib/systeme/charte";

/**
 * « Revenus par mois » de la maquette : six barres orange, le montant au-dessus.
 *
 * Sans bibliothèque de graphiques : six barres se dessinent en CSS, et une
 * dépendance de plus pour cela serait du poids envoyé à chaque visite.
 * Un mois négatif (plus de remboursements que de ventes) garde une barre
 * nulle et affiche son montant : la hauteur ne ment pas, le chiffre non plus.
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
      style={{ display: "grid", gridTemplateColumns: `repeat(${barres.length}, 1fr)`, gap: 12, alignItems: "end", height: 190, borderTop: `2px solid ${ENCRE}`, paddingTop: 14 }}
    >
      {barres.map((b) => (
        <div key={b.cle} style={{ display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end", height: "100%", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "center", opacity: 0.75 }}>{format(b.montant)}</span>
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
