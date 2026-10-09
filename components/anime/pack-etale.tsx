import type { CSSProperties } from "react";

/**
 * Les ressources d'une collection, en paquet qu'on étale d'un clic.
 *
 * Adapté d'Animata, `animata/card/card-spread.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`), par le labo « explorations »
 * (`components/labo/explorations/cartes-etalees.tsx`), qui en avait gardé
 * l'essentiel : AUCUN JAVASCRIPT — une case à cocher porte l'état, `:has()`
 * le lit (`.etale*`, globals.css).
 *
 * Ce qui change ici :
 * - N'IMPORTE QUEL NOMBRE DE CARTES. Le labo plaçait quatre cartes par quatre
 *   règles `nth-child` écrites à la main ; une collection en montre jusqu'à
 *   huit (`APERCU`, lib/forum/collections.ts). Chaque carte porte son rang
 *   (--i) et le total (--n), et une seule formule les resserre vers le centre ;
 * - de vraies vignettes : la couverture de la ressource, ou son titre sur la
 *   lavande quand elle n'en a pas — comme la grille qu'il remplace.
 *
 * Sans `:has()`, aucune règle de paquet ne s'applique : les vignettes sont à
 * plat, côte à côte, toutes visibles. Composant serveur.
 */
export function PackEtale({
  items,
}: {
  items: Array<{ id: string; titre: string; couverture: string | null }>;
}) {
  const n = items.length;
  return (
    <div className="etale" style={{ marginTop: 14 }}>
      <label className="etale-bouton">
        <input type="checkbox" className="etale-case sr-only" />
        <span className="etale-ouvrir">Étaler les {n}</span>
        <span className="etale-fermer">Ranger</span>
      </label>
      <div className="etale-scene">
        <ul className="etale-grille" style={{ "--n": n } as CSSProperties}>
          {items.map((r, i) => (
            <li key={r.id} className="etale-carte" style={{ "--i": i } as CSSProperties}>
              <div className="etale-interne">
                <div
                  title={r.titre}
                  style={{
                    height: 96,
                    border: "2.5px solid #121212",
                    borderRadius: 13,
                    boxShadow: "3px 3px 0 #121212",
                    background: r.couverture
                      ? `center/cover no-repeat url(${JSON.stringify(r.couverture)})`
                      : "#EADFF9",
                    display: "flex",
                    alignItems: "flex-end",
                    padding: 7,
                    overflow: "hidden",
                  }}
                >
                  {r.couverture ? (
                    <span className="sr-only">{r.titre}</span>
                  ) : (
                    <span style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.25, opacity: 0.75 }}>
                      {r.titre}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
