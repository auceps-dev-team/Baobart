import type { CSSProperties } from "react";

/**
 * Une frise d'étapes qui s'allume en cascade jusqu'à l'étape courante.
 * Sert sur la page de confirmation d'achat (`app/achat/[orderId]`).
 *
 * Adapté d'Animata, `animata/progress/animatedtimeline.tsx` (MIT, voir
 * `components/labo/animata/LICENCE-animata.md`), par le labo « explorations »
 * (`components/labo/explorations/frise.tsx`), qui avait déjà fait de l'étape
 * une donnée (l'original n'allumait qu'au survol, et rien au clavier) et posé
 * la sémantique (liste ordonnée, `aria-current="step"`).
 *
 * Ce qui change ici : PLUS D'ÉTAT REACT, PLUS DE JAVASCRIPT. Le labo animait
 * le passage d'une étape à l'autre ; la page de confirmation, elle, se
 * recharge en entier toutes les 8 s pendant l'attente (`<meta refresh>`), et
 * un état React repartirait de zéro à chaque fois. Ici, chaque point et
 * chaque trait allumés jouent une animation CSS au premier affichage, avec le
 * délai en cascade du labo (80 ms par étape, trait 40 ms après son point) :
 * quand la commande passe de « en attente » à « payée », le rechargement
 * montre la frise se remplir jusqu'au bout. Composant serveur ; sous
 * mouvement réduit, tout est allumé d'emblée (`globals.css`).
 */
const ECART = 80;
const DECALAGE_TRAIT = 40;

export function Frise({
  etapes,
  courante,
}: {
  etapes: Array<{ titre: string; detail: string }>;
  /** Rang de l'étape en cours ; celles d'avant sont faites. */
  courante: number;
}) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {etapes.map((e, i) => {
        const allume = i <= courante;
        const dernier = i === etapes.length - 1;
        return (
          <li
            key={e.titre}
            aria-current={i === courante ? "step" : undefined}
            style={{ display: "flex", gap: 14 }}
          >
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
              {!dernier ? (
                <div style={{ position: "absolute", top: 0, bottom: 0, width: 4, background: "#C9A8F5" }}>
                  {i < courante ? (
                    <div
                      className="frise-trait"
                      style={
                        {
                          height: "100%",
                          background: "#121212",
                          "--d": `${i * ECART + DECALAGE_TRAIT}ms`,
                        } as CSSProperties
                      }
                    />
                  ) : null}
                </div>
              ) : null}
              <div
                className="frise-point"
                data-allume={allume || undefined}
                style={
                  {
                    position: "relative",
                    zIndex: 1,
                    width: 22,
                    height: 22,
                    flex: "0 0 auto",
                    borderRadius: 999,
                    border: "2.5px solid #121212",
                    // L'état FINAL, en style en ligne : sous mouvement réduit,
                    // sans animation, c'est lui qu'on voit. (Un blanc ici,
                    // avec le jaune laissé à la classe, aurait été perdu : le
                    // style en ligne l'emporte sur la classe.)
                    background: allume ? "#FFD84A" : "#FFFFFF",
                    transform: i === courante ? "scale(1.2)" : undefined,
                    "--d": `${i * ECART}ms`,
                  } as CSSProperties
                }
              />
            </div>
            <div style={{ paddingBottom: dernier ? 0 : 16, lineHeight: 1.35 }}>
              <div style={{ fontSize: 14, fontWeight: 800, opacity: allume ? 1 : 0.5 }}>{e.titre}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.7 }}>{e.detail}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
