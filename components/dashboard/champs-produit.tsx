"use client";

import { useActionState, useState } from "react";

import type { EtatPromo } from "@/lib/commerce/actions-promo";
import type { ChampDeclare } from "@/lib/commerce/champs";

/**
 * Les questions posées à l'achat, sur une ressource.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ÉCRAN DIT CE QUE `FILE` NE FAIT PAS
 *
 * Le schéma déclare cinq types ; quatre sont servis. Ne pas proposer `FILE` du
 * tout laisserait quelqu'un le chercher — il est écrit noir sur blanc dans
 * `prisma/schema.prisma`. On l'affiche donc grisé, avec la raison, comme les
 * entrées de menu sans page.
 */

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const CADRE = `2.5px solid ${ENCRE}`;

const TYPES: Array<{ code: string; libelle: string; aide: string }> = [
  { code: "TEXT", libelle: "Texte libre", aide: "une dédicace, un pseudo" },
  { code: "CHOICE", libelle: "Liste de choix", aide: "au moins deux options" },
  { code: "BOOLEAN", libelle: "Case à cocher", aide: "oui ou rien" },
  {
    code: "TERMS",
    libelle: "Conditions à accepter",
    aide: "obligatoire = il faut cocher pour acheter",
  },
];

const champStyle = {
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

export function PanneauChampsProduit({
  produitId,
  champs,
  declarer,
  retirer,
}: {
  produitId: string;
  champs: ChampDeclare[];
  declarer: (
    precedent: EtatPromo | null,
    donnees: FormData,
  ) => Promise<EtatPromo>;
  retirer: (
    precedent: EtatPromo | null,
    donnees: FormData,
  ) => Promise<EtatPromo>;
}) {
  const [type, setType] = useState("TEXT");
  const [suiteAjout, agirDeclarer, enCours] = useActionState(declarer, null);
  const [suiteRetrait, agirRetirer] = useActionState(retirer, null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
        {
          "Ce que tu demandes à l'acheteur au moment de payer. Les réponses sont figées sur la commande, avec le libellé d'alors — renommer un champ plus tard ne réécrit pas le passé."
        }
      </p>

      {champs.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {champs.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "11px 13px",
                border: CADRE,
                borderRadius: 13,
                background: BLANC,
              }}
            >
              <span style={{ flex: "1 1 auto", fontSize: 13.5, minWidth: 0 }}>
                <strong>{c.nom}</strong>
                {c.obligatoire ? " · obligatoire" : " · facultatif"}
                {c.type === "CHOICE" ? ` · ${c.options.join(", ")}` : ""}
              </span>

              <form action={agirRetirer}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="produitId" value={produitId} />
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
            </div>
          ))}
          {suiteRetrait ? (
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                fontWeight: 700,
                color: suiteRetrait.ok ? ENCRE : ORANGE,
              }}
            >
              {suiteRetrait.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <form action={agirDeclarer}>
        <input type="hidden" name="produitId" value={produitId} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
            gap: 14,
          }}
        >
          <div>
            <label htmlFor="nom-champ" style={etiquette}>
              La question
            </label>
            <input
              id="nom-champ"
              name="nom"
              required
              minLength={2}
              placeholder="Dédicace"
              style={champStyle}
            />
          </div>

          <div>
            <label htmlFor="type-champ" style={etiquette}>
              Sorte de réponse
            </label>
            <select
              id="type-champ"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={champStyle}
            >
              {TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.libelle}
                </option>
              ))}
              {/*
                Déclaré au schéma, non servi. Le cacher ferait chercher
                pourquoi il n'apparaît pas — il est écrit dans
                `prisma/schema.prisma`.
              */}
              <option value="FILE" disabled>
                Fichier — bientôt
              </option>
            </select>
          </div>

          {type === "CHOICE" ? (
            <div>
              <label htmlFor="options-champ" style={etiquette}>
                Les choix, séparés par des virgules
              </label>
              <input
                id="options-champ"
                name="options"
                required
                placeholder="S, M, L"
                style={champStyle}
              />
            </div>
          ) : null}

          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <label
              htmlFor="obligatoire-champ"
              style={{ fontSize: 13.5, display: "flex", gap: 8, alignItems: "center" }}
            >
              <input
                id="obligatoire-champ"
                name="obligatoire"
                type="checkbox"
                style={{ width: 18, height: 18 }}
              />
              Obligatoire
            </label>
          </div>
        </div>

        <p style={{ fontSize: 12.5, opacity: 0.75, margin: "12px 0 0" }}>
          {TYPES.find((t) => t.code === type)?.aide}
        </p>

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
            {enCours ? "Un instant…" : "Ajouter la question"}
          </button>

          {suiteAjout ? (
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: suiteAjout.ok ? ENCRE : ORANGE,
              }}
            >
              {suiteAjout.message}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
