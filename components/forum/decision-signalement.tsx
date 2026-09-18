"use client";

import { useState, useTransition } from "react";

import {
  leverUnSignalement,
  retirerUnMessageSignale,
} from "@/lib/forum/actions";
import { BLANC, CADRE, ENCRE, GRIS, ORANGE } from "@/lib/systeme/charte";

/**
 * Trancher un signalement : laisser, ou retirer.
 *
 * Les deux boutons ne se ressemblent pas, et c'est voulu : « Retirer » efface
 * définitivement le message d'un tiers. Il demande confirmation ; « Laisser »
 * ne détruit rien et n'en demande pas.
 */
export function DecisionSignalement({ messageId }: { messageId: string }) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const agir = (quoi: "laisser" | "retirer") => {
    if (
      quoi === "retirer" &&
      !window.confirm("Retirer ce message ? C'est définitif, et c'est consigné.")
    ) {
      return;
    }

    setErreur(null);
    demarrer(async () => {
      const suite =
        quoi === "laisser"
          ? await leverUnSignalement(messageId)
          : await retirerUnMessageSignale(messageId);
      if (!suite.ok) setErreur(suite.message);
    });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={enCours}
          onClick={() => agir("laisser")}
          className="sticker-press"
          style={{
            padding: "10px 20px",
            border: CADRE,
            borderRadius: 13,
            background: enCours ? GRIS : BLANC,
            fontSize: 13.5,
            fontWeight: 800,
            cursor: enCours ? "progress" : "pointer",
          }}
        >
          Laisser
        </button>

        <button
          type="button"
          disabled={enCours}
          onClick={() => agir("retirer")}
          className="sticker-press"
          style={{
            padding: "10px 20px",
            border: CADRE,
            borderRadius: 13,
            background: enCours ? GRIS : ENCRE,
            color: BLANC,
            fontSize: 13.5,
            fontWeight: 800,
            cursor: enCours ? "progress" : "pointer",
          }}
        >
          Retirer le message
        </button>
      </div>

      {erreur ? (
        <p style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: ORANGE }}>
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
