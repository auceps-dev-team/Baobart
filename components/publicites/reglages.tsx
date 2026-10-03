"use client";

import { useActionState } from "react";

import { reglerPublicites, type EtatReglages } from "@/lib/publicites/actions";
import { ECART_MAX, ECART_MIN } from "@/lib/publicites/regles";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Les deux réglages qui valent pour toutes les bannières.
 *
 * L'interrupteur coupe tout d'un geste, sans toucher aux campagnes : c'est ce
 * qu'on cherche le jour où une bannière pose problème et qu'on ne sait pas
 * encore laquelle.
 */
export function ReglagesPublicites({
  actives,
  ecartMinimal,
}: {
  actives: boolean;
  ecartMinimal: number;
}) {
  const [etat, envoyer, enCours] = useActionState<EtatReglages | null, FormData>(reglerPublicites, null);

  return (
    <form
      action={envoyer}
      style={{
        display: "grid",
        gap: 14,
        border: CADRE,
        borderRadius: 20,
        background: BLANC,
        boxShadow: `4px 4px 0 ${ENCRE}`,
        padding: 18,
        maxWidth: 760,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800 }}>Diffusion</div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 700 }}>
        <input type="checkbox" name="actives" defaultChecked={actives} style={{ width: 18, height: 18 }} />
        Afficher les bannières dans la mosaïque
      </label>

      <label style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            opacity: 0.6,
          }}
        >
          Écart minimal entre deux bannières
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="number"
            name="ecartMinimal"
            min={ECART_MIN}
            max={ECART_MAX}
            defaultValue={ecartMinimal}
            required
            style={{
              width: 90,
              padding: "10px 12px",
              border: CADRE,
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700 }}>produits</span>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.65, lineHeight: 1.45 }}>
          Chaque bannière revient selon sa propre fréquence. Quand deux tombent trop près,
          la seconde attend : jamais deux bannières à moins de cet écart. Quand deux tombent
          au même rang, elles alternent.
        </span>
      </label>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={enCours}
          className="sticker-press"
          style={{
            padding: "10px 18px",
            border: CADRE,
            borderRadius: 13,
            background: JAUNE,
            boxShadow: `3px 3px 0 ${ENCRE}`,
            fontSize: 13,
            fontWeight: 800,
            fontFamily: "inherit",
            color: ENCRE,
            cursor: "pointer",
          }}
        >
          {enCours ? "Un instant…" : "Enregistrer"}
        </button>
        {etat ? (
          <span
            role="status"
            style={{
              padding: "6px 11px",
              border: CADRE,
              borderRadius: 11,
              background: etat.ok ? VERT : ORANGE,
              color: etat.ok ? ENCRE : BLANC,
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            {etat.ok ? "Enregistré." : etat.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
