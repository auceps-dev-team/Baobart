"use client";

import { useActionState } from "react";

import {
  envoyerCandidature,
  type EtatPostuler,
} from "@/lib/jobs/actions-postuler";
import { CV_TAILLE_MAX, MESSAGE_MAX } from "@/lib/jobs/candidature";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Le formulaire de candidature.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL NE VALIDE PAS
 *
 * `accept="application/pdf"` et `maxLength` sont des indications au navigateur.
 * Le vrai contrôle vit dans `lib/jobs/candidature.ts`, pur et éprouvé — et
 * surtout dans `postuler`, qui lit les magic bytes du fichier reçu.
 *
 * Un formulaire se contourne ; ce qui compte est côté serveur.
 */
export function FormulaireCandidature({ offreId }: { offreId: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatPostuler | null, FormData>(
    envoyerCandidature.bind(null, offreId),
    null,
  );

  if (etat?.ok) {
    return (
      <div
        style={{
          border: CADRE,
          borderRadius: 24,
          background: VERT,
          boxShadow: `6px 6px 0 ${ENCRE}`,
          padding: 28,
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, textTransform: "uppercase" }}>
          Ta candidature est envoyée
        </div>
        <p style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.55, marginTop: 10 }}>
          L&apos;annonceur la reçoit directement — nous ne gardons pas de fil de
          discussion. Ton CV sera effacé de nos serveurs à la clôture de la
          mission, sans que tu aies à y penser.
        </p>
      </div>
    );
  }

  const refus = etat && !etat.ok ? etat : null;

  return (
    <form
      action={envoyer}
      encType="multipart/form-data"
      style={{
        border: CADRE,
        borderRadius: 24,
        background: BLANC,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {refus ? (
        <div
          role="alert"
          style={{
            padding: "12px 15px",
            border: CADRE,
            borderRadius: 14,
            background: ORANGE,
            color: BLANC,
            fontSize: 13.5,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {refus.message}
        </div>
      ) : null}

      <div>
        <label htmlFor="cv" style={etiquette}>
          Ton CV
        </label>
        <input
          id="cv"
          name="cv"
          type="file"
          required
          accept="application/pdf,.pdf"
          style={{
            display: "block",
            width: "100%",
            padding: "13px 15px",
            border: CADRE,
            borderRadius: 14,
            background: "#F4EEFC",
            fontFamily: "inherit",
            fontSize: 13.5,
            fontWeight: 500,
          }}
        />
        <div style={aide}>
          PDF uniquement, {(CV_TAILLE_MAX / 1_048_576).toFixed(0)} Mo maximum.
          Un portfolio se met en lien plutôt qu&apos;en pièce jointe.
        </div>
      </div>

      <div>
        <label htmlFor="message" style={etiquette}>
          Mot d&apos;accompagnement <span style={{ opacity: 0.5, fontWeight: 400 }}>· facultatif</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={7}
          maxLength={MESSAGE_MAX}
          placeholder="Deux ou trois phrases sur ce qui te motive dans cette mission."
          style={{
            width: "100%",
            padding: "13px 15px",
            border: CADRE,
            borderRadius: 14,
            background: "#F4EEFC",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 500,
            resize: "vertical",
            color: ENCRE,
          }}
        />
      </div>

      <button
        type="submit"
        disabled={enCours}
        className="sticker-press"
        style={{
          padding: "15px 26px",
          border: CADRE,
          borderRadius: 15,
          background: JAUNE,
          boxShadow: `5px 5px 0 ${ENCRE}`,
          fontSize: 15,
          fontWeight: 800,
          cursor: enCours ? "wait" : "pointer",
          fontFamily: "inherit",
          color: ENCRE,
        }}
      >
        {enCours ? "Envoi…" : "Envoyer ma candidature"}
      </button>
    </form>
  );
}

const etiquette = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  textTransform: "uppercase" as const,
  letterSpacing: ".12em",
  opacity: 0.6,
  marginBottom: 6,
};

const aide = {
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.45,
  marginTop: 6,
  opacity: 0.7,
  textWrap: "pretty" as const,
};
