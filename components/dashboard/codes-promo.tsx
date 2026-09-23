"use client";

import { useActionState, useState } from "react";

import type { EtatPromo } from "@/lib/commerce/actions-promo";
import type { LigneCodePromo } from "@/lib/commerce/codes-promo";

/**
 * Les codes promo d'un vendeur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES CODES INACTIFS RESTENT AFFICHÉS
 *
 * Grisés, avec la raison — expiré, épuisé, retiré — et toujours là. Les
 * cacher répondrait à la mauvaise question : on ouvre cet écran quand un
 * acheteur dit « mon code ne marche pas », et le code qui explique pourquoi
 * est justement celui qui vient de cesser d'agir.
 *
 * C'est le même raisonnement que la liste de blocage, et pour la même raison :
 * un écran qui ne montre que ce qui fonctionne fait chercher ailleurs.
 */

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const GRIS = "#DCDCDC";
const CADRE = `2.5px solid ${ENCRE}`;

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

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

/** Pourquoi ce code n'accorde plus rien. */
function raisonInactif(c: LigneCodePromo): string {
  if (c.retireLe) return `retiré le ${DATE.format(c.retireLe)}`;
  if (c.plafond !== null && c.usages >= c.plafond) return "plafond atteint";
  if (c.expireLe) return `expiré le ${DATE.format(c.expireLe)}`;
  return "inactif";
}

export function PanneauCodesPromo({
  codes,
  creer,
  retirer,
}: {
  codes: LigneCodePromo[];
  creer: (
    precedent: EtatPromo | null,
    donnees: FormData,
  ) => Promise<EtatPromo>;
  retirer: (
    precedent: EtatPromo | null,
    donnees: FormData,
  ) => Promise<EtatPromo>;
}) {
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [suiteCreation, agirCreer, creationEnCours] = useActionState(
    creer,
    null,
  );
  const [suiteRetrait, agirRetirer] = useActionState(retirer, null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <form action={agirCreer}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            gap: 14,
            alignItems: "start",
          }}
        >
          <div>
            <label htmlFor="code" style={etiquette}>
              Le code
            </label>
            <input
              id="code"
              name="code"
              required
              minLength={3}
              autoComplete="off"
              placeholder="NOEL25"
              style={{
                ...champ,
                fontFamily: "var(--font-mono)",
                letterSpacing: ".1em",
                textTransform: "uppercase",
              }}
            />
          </div>

          <div>
            <label htmlFor="type" style={etiquette}>
              Remise
            </label>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")}
              style={champ}
            >
              <option value="PERCENT">En pourcentage</option>
              <option value="FIXED">En francs</option>
            </select>
          </div>

          <div>
            <label htmlFor="montant" style={etiquette}>
              {type === "PERCENT" ? "Combien de %" : "Combien de francs"}
            </label>
            <input
              id="montant"
              name="montant"
              type="number"
              required
              min={1}
              max={type === "PERCENT" ? 100 : undefined}
              step={1}
              placeholder={type === "PERCENT" ? "25" : "2000"}
              style={champ}
            />
          </div>

          <div>
            <label htmlFor="plafond" style={etiquette}>
              Combien de fois
            </label>
            <input
              id="plafond"
              name="plafond"
              type="number"
              min={1}
              step={1}
              placeholder="sans limite"
              style={champ}
            />
          </div>

          <div>
            <label htmlFor="expireLe" style={etiquette}>
              Jusqu&apos;au
            </label>
            <input id="expireLe" name="expireLe" type="date" style={champ} />
          </div>
        </div>

        <p style={{ fontSize: 12.5, opacity: 0.75, margin: "12px 0 0" }}>
          {
            "Le code vaut sur toutes tes ressources. La remise est à ta charge : la commission de Baobart baisse avec elle, mais c'est bien toi qui l'accordes."
          }
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
          <button
            type="submit"
            disabled={creationEnCours}
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
            {creationEnCours ? "Un instant…" : "Créer le code"}
          </button>
          <Message etat={suiteCreation} />
        </div>
      </form>

      {codes.length === 0 ? (
        <p style={{ fontSize: 13.5, opacity: 0.7, margin: 0 }}>
          {"Aucun code pour l'instant."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {codes.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 14px",
                border: CADRE,
                borderRadius: 14,
                background: c.inactif ? GRIS : BLANC,
                opacity: c.inactif ? 0.72 : 1,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: ".08em",
                  minWidth: 110,
                }}
              >
                {c.code}
              </span>

              <span style={{ fontSize: 13.5, fontWeight: 800, minWidth: 74 }}>
                {c.libelleRemise}
              </span>

              <span style={{ flex: "1 1 auto", fontSize: 12.5, opacity: 0.8 }}>
                {c.plafond === null
                  ? `${c.usages} usage${c.usages > 1 ? "s" : ""} · sans limite`
                  : `${c.usages} / ${c.plafond} usage${c.plafond > 1 ? "s" : ""}`}
                {c.inactif ? ` · ${raisonInactif(c)}` : ""}
                {!c.inactif && c.expireLe
                  ? ` · jusqu'au ${DATE.format(c.expireLe)}`
                  : ""}
              </span>

              {c.retireLe ? (
                <span style={{ fontSize: 12.5, opacity: 0.7 }}>retiré</span>
              ) : (
                <form action={agirRetirer}>
                  <input type="hidden" name="id" value={c.id} />
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
                      color: ORANGE,
                      cursor: "pointer",
                    }}
                  >
                    Retirer
                  </button>
                </form>
              )}
            </div>
          ))}

          <Message etat={suiteRetrait} />
        </div>
      )}
    </div>
  );
}
