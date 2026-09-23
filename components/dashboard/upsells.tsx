"use client";

import { useActionState } from "react";

import type { EtatPromo } from "@/lib/commerce/actions-promo";
import type { LigneUpsell } from "@/lib/commerce/upsell";

/**
 * Les offres post-achat d'un vendeur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ÉCRAN DIT QUAND L'OFFRE NE S'AFFICHERA PAS
 *
 * Une offre orpheline — dont une des deux ressources a été supprimée — reste
 * en base et ne se déclenchera jamais. La cacher ferait chercher pourquoi
 * rien n'apparaît ; l'afficher marquée laisse le choix de la retirer.
 *
 * C'est la même règle que les codes promo inactifs et que la liste de
 * blocage : un écran qui ne montre que ce qui fonctionne fait chercher
 * ailleurs.
 */

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const GRIS = "#DCDCDC";
const CADRE = `2.5px solid ${ENCRE}`;

const champ = {
  padding: "11px 13px",
  border: CADRE,
  borderRadius: 12,
  background: BLANC,
  fontFamily: "inherit",
  fontSize: 13.5,
  width: "100%",
};

const etiquette = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: ".1em",
  opacity: 0.55,
  marginBottom: 6,
};

function Message({ etat }: { etat: EtatPromo | null }) {
  if (!etat) return null;

  return (
    <p
      style={{
        margin: "10px 0 0",
        fontSize: 13.5,
        fontWeight: 700,
        color: etat.ok ? ENCRE : ORANGE,
      }}
    >
      {etat.message}
    </p>
  );
}

export function PanneauUpsells({
  upsells,
  ressources,
  declarer,
  basculer,
}: {
  upsells: LigneUpsell[];
  /** Les ressources publiées du vendeur, pour les deux listes. */
  ressources: Array<{ id: string; nom: string }>;
  declarer: (
    precedent: EtatPromo | null,
    donnees: FormData,
  ) => Promise<EtatPromo>;
  basculer: (
    precedent: EtatPromo | null,
    donnees: FormData,
  ) => Promise<EtatPromo>;
}) {
  const [suiteDeclaration, agirDeclarer, enCours] = useActionState(
    declarer,
    null,
  );
  const [suiteBascule, agirBasculer] = useActionState(basculer, null);

  if (ressources.length < 2) {
    return (
      <p style={{ fontSize: 13.5, opacity: 0.8, margin: 0 }}>
        {
          "Il faut au moins deux ressources publiées pour proposer l'une après l'achat de l'autre."
        }
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <form action={agirDeclarer}>
        <p style={{ margin: "0 0 14px", fontSize: 13.5, lineHeight: 1.55 }}>
          {
            "Quand quelqu'un vient d'acheter une ressource, on lui en propose une autre sur la page de remerciement. Jamais pendant le paiement : en mobile money, une seconde décision fait abandonner les deux achats."
          }
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
            gap: 14,
          }}
        >
          <div>
            <label htmlFor="declencheur" style={etiquette}>
              Après l&apos;achat de
            </label>
            <select id="declencheur" name="declencheur" required style={champ}>
              {ressources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="offre" style={etiquette}>
              On propose
            </label>
            <select id="offre" name="offre" required style={champ}>
              {ressources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="remise" style={etiquette}>
              Remise (%)
            </label>
            <input
              id="remise"
              name="remise"
              type="number"
              min={1}
              max={100}
              step={1}
              placeholder="sans remise"
              style={champ}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
          <button
            type="submit"
            disabled={enCours}
            style={{
              padding: "11px 18px",
              border: CADRE,
              borderRadius: 13,
              background: JAUNE,
              fontFamily: "inherit",
              fontSize: 13.5,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {enCours ? "Un instant…" : "Déclarer l'offre"}
          </button>
          <Message etat={suiteDeclaration} />
        </div>
      </form>

      {upsells.length === 0 ? (
        <p style={{ fontSize: 13.5, opacity: 0.7, margin: 0 }}>
          {"Aucune offre pour l'instant."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upsells.map((u) => (
            <div
              key={u.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 14px",
                border: CADRE,
                borderRadius: 14,
                background: u.orpheline || !u.actif ? GRIS : BLANC,
                opacity: u.orpheline || !u.actif ? 0.72 : 1,
              }}
            >
              <span style={{ flex: "1 1 auto", fontSize: 13.5, minWidth: 0 }}>
                <strong>{u.declencheur?.nom ?? "ressource supprimée"}</strong>
                {" → "}
                <strong>{u.offre?.nom ?? "ressource supprimée"}</strong>
                {u.remisePourcent ? ` · −${u.remisePourcent} %` : ""}
                {u.orpheline ? " · ne se déclenchera jamais" : ""}
                {!u.orpheline && !u.actif ? " · coupée" : ""}
              </span>

              <form action={agirBasculer}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="actif" value={u.actif ? "0" : "1"} />
                <button
                  type="submit"
                  style={{
                    padding: "8px 13px",
                    border: CADRE,
                    borderRadius: 11,
                    background: BLANC,
                    fontFamily: "inherit",
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: u.actif ? ORANGE : ENCRE,
                    cursor: "pointer",
                  }}
                >
                  {u.actif ? "Couper" : "Réactiver"}
                </button>
              </form>
            </div>
          ))}

          <Message etat={suiteBascule} />
        </div>
      )}
    </div>
  );
}
