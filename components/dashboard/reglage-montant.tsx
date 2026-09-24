"use client";

import { useActionState, useState } from "react";

import type { EtatPromo } from "@/lib/commerce/actions-promo";

/**
 * Comment se décide le prix d'une ressource.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX RÉGLAGES QUI N'ONT PAS LE MÊME POIDS
 *
 * Le mode de prix change ce que l'acheteur voit au moment de payer : un champ
 * au lieu d'un montant. Le pourboire n'ajoute qu'une ligne facultative.
 *
 * Ils sont pourtant dans le même formulaire, parce qu'ils répondent à la même
 * question — « qui décide du montant ? » — et que les séparer donnerait deux
 * boutons « Enregistrer » à côté l'un de l'autre, dont on ne saurait plus
 * lequel fait quoi.
 */

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
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

export function ReglageMontant({
  produitId,
  mode,
  minPrice,
  suggeres,
  pourboires,
  parite,
  paritePlafond,
  plancher,
  regler,
}: {
  produitId: string;
  mode: "FIXED" | "LIBRE";
  minPrice: number | null;
  suggeres: number[];
  pourboires: boolean;
  /** Le créateur ajuste-t-il son prix au pays de l'acheteur ? */
  parite: boolean;
  /** Sa réduction maximale, en pourcentage. */
  paritePlafond: number | null;
  /** Le minimum que la plateforme impose, quel que soit le créateur. */
  plancher: number;
  regler: (
    precedent: EtatPromo | null,
    donnees: FormData,
  ) => Promise<EtatPromo>;
}) {
  const [modeChoisi, setModeChoisi] = useState(mode);
  const [pariteActive, setPariteActive] = useState(parite);
  const [etat, agir, enCours] = useActionState(regler, null);

  return (
    <form action={agir} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input type="hidden" name="produitId" value={produitId} />

      <div>
        <label htmlFor="mode-prix" style={etiquette}>
          Qui décide du montant
        </label>
        <select
          id="mode-prix"
          name="mode"
          value={modeChoisi}
          onChange={(e) => setModeChoisi(e.target.value as "FIXED" | "LIBRE")}
          style={{ ...champ, maxWidth: 320 }}
        >
          <option value="FIXED">Toi — le prix affiché</option>
          <option value="LIBRE">L&apos;acheteur — à partir d&apos;un minimum</option>
        </select>
      </div>

      {modeChoisi === "LIBRE" ? (
        <>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, opacity: 0.85 }}>
            {
              "Le prix de la fiche devient une suggestion : c'est lui qui s'affiche dans le fil et qui préremplit le champ. L'acheteur peut donner plus, ou descendre jusqu'au minimum."
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
              <label htmlFor="minPrice" style={etiquette}>
                Minimum accepté (F)
              </label>
              <input
                id="minPrice"
                name="minPrice"
                type="number"
                min={plancher}
                step={1}
                defaultValue={minPrice ?? ""}
                placeholder={String(plancher)}
                style={champ}
              />
              <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0 0" }}>
                {`Pas moins de ${plancher.toLocaleString("fr-FR")} F — en dessous, les frais dépassent ce qui te reste.`}
              </p>
            </div>

            <div>
              <label htmlFor="suggeres" style={etiquette}>
                Montants proposés, séparés par des virgules
              </label>
              <input
                id="suggeres"
                name="suggeres"
                defaultValue={suggeres.join(", ")}
                placeholder="1000, 2500, 5000"
                style={champ}
              />
              <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0 0" }}>
                {
                  "Trois boutons valent mieux qu'un champ vide : personne ne sait quoi donner."
                }
              </p>
            </div>
          </div>
        </>
      ) : null}

      <label
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          fontSize: 13.5,
          lineHeight: 1.5,
        }}
      >
        <input
          name="pourboires"
          type="checkbox"
          defaultChecked={pourboires}
          style={{ width: 18, height: 18, marginTop: 2 }}
        />
        <span>
          <strong>Proposer un pourboire au moment de payer.</strong>{" "}
          {
            "Il s'ajoute au prix et te revient, frais déduits comme le reste. Décoché par défaut : une question de plus à chaque achat n'a pas de sens partout."
          }
        </span>
      </label>

      <div>
        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            fontSize: 13.5,
            lineHeight: 1.5,
          }}
        >
          <input
            name="ppp"
            type="checkbox"
            checked={pariteActive}
            onChange={(e) => setPariteActive(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 2 }}
          />
          <span>
            <strong>Ajuster le prix au pays de l&apos;acheteur.</strong>{" "}
            {
              "Tu es lu plus largement contre un revenu plus faible sur une partie de tes ventes. Personne ne peut prendre cette décision à ta place."
            }
          </span>
        </label>

        {pariteActive ? (
          <div style={{ marginTop: 12, paddingLeft: 28 }}>
            <label htmlFor="pppPlafond" style={etiquette}>
              Réduction maximale (%)
            </label>
            <input
              id="pppPlafond"
              name="pppPlafond"
              type="number"
              min={1}
              max={100}
              step={1}
              defaultValue={paritePlafond ?? ""}
              placeholder="sans limite"
              style={{ ...champ, maxWidth: 200 }}
            />
            <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0 0", maxWidth: 520 }}>
              {
                "Le pays est déclaré par l'acheteur, pas vérifié : il n'y a pas de géolocalisation ici. Ce plafond borne ce que coûte quelqu'un qui cocherait le pays le moins cher."
              }
            </p>
            <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0 0", maxWidth: 520 }}>
              <strong>À savoir :</strong>{" "}
              {
                "aucun coefficient n'est chargé pour l'instant, donc rien ne change encore. Cette option deviendra utile quand les paiements dépasseront l'Afrique de l'Ouest."
              }
            </p>
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
          {enCours ? "Un instant…" : "Enregistrer"}
        </button>

        {etat ? (
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: etat.ok ? ENCRE : ORANGE,
            }}
          >
            {etat.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
