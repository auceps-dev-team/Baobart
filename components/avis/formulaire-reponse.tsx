"use client";

import { useActionState } from "react";

import { enregistrerReponse, type ReponseAvis } from "@/lib/avis/actions";
import { REPONSE_MAX } from "@/lib/avis/regles";
import { BLANC, ENCRE, JAUNE } from "@/lib/systeme/charte";

/** Répondre à un avis reçu, ou modifier sa réponse. Une seule réponse par avis. */
export function FormulaireReponse({ avisId, reponse }: { avisId: string; reponse: string | null }) {
  const [etat, envoyer, enCours] = useActionState<ReponseAvis | null, FormData>(enregistrerReponse.bind(null, avisId), null);
  return (
    <form action={envoyer} style={{ marginTop: 10 }}>
      <label style={{ display: "block" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{reponse ? "Modifier ta réponse" : "Ta réponse"}</span>
        <textarea
          name="reponse"
          defaultValue={reponse ?? ""}
          maxLength={REPONSE_MAX}
          required
          rows={3}
          style={{ display: "block", width: "100%", marginTop: 6, padding: 10, border: `2px solid ${ENCRE}`, borderRadius: 12, fontSize: 16, fontFamily: "inherit", resize: "vertical", background: BLANC }}
        />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button
          type="submit"
          disabled={enCours}
          className="sticker-press"
          style={{ padding: "10px 16px", border: `2.5px solid ${ENCRE}`, borderRadius: 12, background: JAUNE, boxShadow: `3px 3px 0 ${ENCRE}`, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
        >
          {enCours ? "Envoi…" : reponse ? "Mettre à jour ma réponse" : "Publier ma réponse"}
        </button>
        {etat ? (
          <span role="status" style={{ fontSize: 12.5, fontWeight: 700 }}>
            {etat.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
