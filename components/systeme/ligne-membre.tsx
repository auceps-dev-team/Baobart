"use client";

import { useActionState, useState } from "react";

import { PastilleEtat } from "@/components/systeme/bandeau";
import { deciderDuCompte, type EtatDecision } from "@/lib/domain/actions-risque";
import type { RiskEvent } from "@/lib/domain/trust";
import { CADRE, ENCRE, BLANC, JAUNE } from "@/lib/systeme/charte";
import type { Gravite } from "@/lib/systeme/diagnostic";

const ORANGE_SOMBRE = "#B34A1F";

export interface MembreAffiche {
  id: string;
  nom: string;
  email: string;
  etatRisque: string;
  gravite: Gravite;
  fond: string;
  detail: string;
  derniereDecision: string | null;
  decisions: Array<{ event: RiskEvent; libelle: string; leveSuspension: boolean }>;
}

function Decision({
  userId,
  event,
  libelle,
  leveSuspension,
}: {
  userId: string;
  event: RiskEvent;
  libelle: string;
  leveSuspension: boolean;
}) {
  const action = deciderDuCompte.bind(null, userId, event, leveSuspension);
  const [etat, envoyer, enCours] = useActionState<EtatDecision | null, FormData>(
    action,
    null,
  );
  const [ouvert, setOuvert] = useState(false);

  if (!ouvert) {
    return (
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
          color: event.startsWith("SUSPEND") ? ORANGE_SOMBRE : ENCRE,
          cursor: "pointer",
        }}
      >
        {libelle}…
      </button>
    );
  }

  return (
    <form
      action={envoyer}
      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
    >
      <label style={{ fontSize: 11.5, fontWeight: 700 }}>
        <span style={{ opacity: 0.7 }}>Raison </span>
        <input
          name="motif"
          style={{
            width: 250,
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
      {etat ? (
        <span
          role={etat.ok ? "status" : "alert"}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: etat.ok ? ENCRE : ORANGE_SOMBRE,
          }}
        >
          {etat.message}
        </span>
      ) : null}
    </form>
  );
}

export function LigneMembre({
  membre,
  peutAgir,
}: {
  membre: MembreAffiche;
  peutAgir: boolean;
}) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 16,
        background: membre.fond,
        padding: 15,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <PastilleEtat gravite={membre.gravite} texte={membre.etatRisque} />
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800 }}>{membre.nom}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.72, marginTop: 2 }}>
            {membre.detail}
          </div>
        </div>
      </div>

      {membre.derniereDecision ? (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            opacity: 0.65,
          }}
        >
          {membre.derniereDecision}
        </div>
      ) : null}

      {peutAgir ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {membre.decisions.map((d) => (
            <Decision
              key={d.event}
              userId={membre.id}
              event={d.event}
              libelle={d.libelle}
              leveSuspension={d.leveSuspension}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
