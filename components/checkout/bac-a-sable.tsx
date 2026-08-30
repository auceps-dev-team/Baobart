"use client";

import { useState, useTransition } from "react";

import { declencherRappel } from "@/lib/payments/encaissement/bac-a-sable";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE } from "@/lib/systeme/charte";

/**
 * Les deux boutons qui jouent l'opérateur.
 *
 * Ils ne sont affichés qu'en bac à sable, mais ce n'est pas ce qui protège :
 * la garde vit dans l'action serveur, qui vérifie le pilote actif et la
 * propriété de la commande. Cacher un bouton ne ferme rien.
 */
export function BacASable({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function jouer(issue: "REUSSI" | "ECHOUE") {
    demarrer(async () => {
      const suite = await declencherRappel(orderId, issue);
      setMessage(suite.ok ? `Rappel traité : ${suite.effet}.` : suite.message);
    });
  }

  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 20,
        background: BLANC,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 20,
        marginTop: 24,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 17,
          textTransform: "uppercase",
          letterSpacing: "-.3px",
        }}
      >
        Bac à sable
      </div>

      <p style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.55, margin: "10px 0 16px" }}>
        Aucun opérateur n&apos;est branché. Ces boutons envoient sur la vraie
        route de rappel un corps signé, exactement comme le ferait Orange Money
        — signature comprise.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={enCours}
          onClick={() => jouer("REUSSI")}
          className="sticker-press"
          style={{
            padding: "11px 16px",
            border: CADRE,
            borderRadius: 12,
            background: JAUNE,
            fontWeight: 800,
            fontSize: 13.5,
            cursor: enCours ? "wait" : "pointer",
          }}
        >
          Le paiement réussit
        </button>

        <button
          type="button"
          disabled={enCours}
          onClick={() => jouer("ECHOUE")}
          className="sticker-press"
          style={{
            padding: "11px 16px",
            border: CADRE,
            borderRadius: 12,
            background: BLANC,
            fontWeight: 800,
            fontSize: 13.5,
            cursor: enCours ? "wait" : "pointer",
          }}
        >
          Le paiement échoue
        </button>
      </div>

      {message ? (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: "10px 13px",
            border: CADRE,
            borderRadius: 12,
            background: ORANGE,
            color: BLANC,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
