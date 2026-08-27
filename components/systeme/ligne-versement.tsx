"use client";

import { useActionState, useState } from "react";

import { PastilleEtat } from "@/components/systeme/bandeau";
import {
  fairePasserVersement,
  type EtatTransition,
} from "@/lib/payments/actions-admin";
import type { EtatVersement } from "@/lib/payments/supervision";
import { CADRE, ENCRE, BLANC, JAUNE, ORANGE } from "@/lib/systeme/charte";
import type { Gravite } from "@/lib/systeme/diagnostic";

const ORANGE_SOMBRE = "#B34A1F";

export interface VersementAffiche {
  id: string;
  beneficiaire: string;
  moyen: string;
  compte: string;
  montant: string;
  etat: EtatVersement;
  etatLibelle: string;
  gravite: Gravite;
  fond: string;
  reference: string | null;
  motifEchec: string | null;
  creeLe: string;
  suites: Array<{ vers: EtatVersement; libelle: string }>;
}

/** Ce que chaque transition demande de renseigner avant d'être permise. */
const EXIGENCE: Partial<Record<EtatVersement, { champ: string; etiquette: string }>> =
  {
    PROCESSING: {
      champ: "reference",
      etiquette: "Référence de l'ordre chez l'opérateur",
    },
    FAILED: { champ: "raison", etiquette: "Pourquoi l'ordre n'est pas passé" },
    RETURNED: { champ: "raison", etiquette: "Pourquoi l'argent est revenu" },
    CANCELLED: { champ: "raison", etiquette: "Pourquoi tu annules" },
  };

function Transition({
  payoutId,
  vers,
  libelle,
}: {
  payoutId: string;
  vers: EtatVersement;
  libelle: string;
}) {
  const action = fairePasserVersement.bind(null, payoutId, vers);
  const [etat, envoyer, enCours] = useActionState<EtatTransition | null, FormData>(
    action,
    null,
  );
  const [ouvert, setOuvert] = useState(false);

  const exigence = EXIGENCE[vers];

  // Sans champ à remplir, un seul bouton suffit. Avec, on déplie : demander une
  // référence dans une invite du navigateur perdrait la saisie au moindre clic
  // à côté.
  if (!exigence) {
    return (
      <form action={envoyer} style={{ display: "inline" }}>
        <button
          type="submit"
          className="sticker-press"
          disabled={enCours}
          style={{
            padding: "8px 14px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 10,
            background: BLANC,
            fontSize: 12,
            fontWeight: 800,
            cursor: enCours ? "wait" : "pointer",
          }}
        >
          {enCours ? "…" : libelle}
        </button>
        {etat && !etat.ok ? (
          <span
            role="alert"
            style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: ORANGE_SOMBRE }}
          >
            {etat.message}
          </span>
        ) : null}
      </form>
    );
  }

  return (
    <div style={{ display: "inline-block" }}>
      {ouvert ? (
        <form
          action={envoyer}
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          <label style={{ fontSize: 11.5, fontWeight: 700 }}>
            <span style={{ opacity: 0.7 }}>{exigence.etiquette} </span>
            <input
              name={exigence.champ}
              style={{
                width: 210,
                padding: "7px 9px",
                border: `2px solid ${ENCRE}`,
                borderRadius: 10,
                background: BLANC,
                fontSize: 12.5,
              }}
            />
          </label>
          <button
            type="submit"
            className="sticker-press"
            disabled={enCours}
            style={{
              padding: "8px 14px",
              border: `2px solid ${ENCRE}`,
              borderRadius: 10,
              background: JAUNE,
              fontSize: 12,
              fontWeight: 800,
              cursor: enCours ? "wait" : "pointer",
            }}
          >
            {enCours ? "…" : libelle}
          </button>
          <button
            type="button"
            onClick={() => setOuvert(false)}
            style={{
              padding: "8px 12px",
              border: `2px solid ${ENCRE}`,
              borderRadius: 10,
              background: BLANC,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Annuler
          </button>
          {etat && !etat.ok ? (
            <span
              role="alert"
              style={{ fontSize: 12, fontWeight: 700, color: ORANGE_SOMBRE }}
            >
              {etat.message}
            </span>
          ) : null}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          style={{
            padding: "8px 14px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 10,
            background: BLANC,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {libelle}…
        </button>
      )}
    </div>
  );
}

export function LigneVersement({
  versement,
  peutAgir,
}: {
  versement: VersementAffiche;
  peutAgir: boolean;
}) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 16,
        background: versement.fond,
        padding: 15,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}
      >
        <PastilleEtat gravite={versement.gravite} texte={versement.etatLibelle} />

        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800 }}>
            {versement.beneficiaire}
          </div>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              opacity: 0.72,
              marginTop: 2,
            }}
          >
            {versement.moyen} · {versement.compte} · {versement.creeLe}
          </div>
        </div>

        <strong style={{ fontSize: 14 }}>{versement.montant}</strong>
      </div>

      {versement.reference ? (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            opacity: 0.65,
          }}
        >
          référence opérateur : {versement.reference}
        </div>
      ) : null}

      {versement.motifEchec ? (
        <div
          style={{
            padding: "9px 12px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 11,
            background: ORANGE,
            color: BLANC,
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          {versement.motifEchec}
        </div>
      ) : null}

      {peutAgir && versement.suites.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {versement.suites.map((s) => (
            <Transition
              key={s.vers}
              payoutId={versement.id}
              vers={s.vers}
              libelle={s.libelle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
