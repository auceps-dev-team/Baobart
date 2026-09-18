"use client";

import { useState, useTransition } from "react";

import {
  basculerUneCommunaute,
  leverUnSignalement,
  retirerUnMessageSignale,
} from "@/lib/forum/actions";
import type { Origine } from "@/lib/forum/signalements";
import { BLANC, CADRE, ENCRE, GRIS, ORANGE } from "@/lib/systeme/charte";

/**
 * Trancher un signalement, et fermer une communauté.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MOTIF SE SAISIT AVANT, PAS APRÈS
 *
 * `Baobart Dashboard.dc.html`, écran `a_membres_risque` : « Chaque geste exige
 * un motif écrit avant validation, et laisse une ligne que personne ne peut
 * effacer. »
 *
 * Un motif demandé après coup se remplit de « ok » et de « rien ». Demandé
 * avant, il oblige à formuler la décision — et c'est cette formulation, pas la
 * case remplie, qui servira dans six mois.
 *
 * Le serveur le réexige de toute façon : `basculerLaCommunaute` refuse en
 * dessous de huit caractères. Ce composant ne fait que le demander poliment.
 */

const BOUTON: React.CSSProperties = {
  padding: "10px 20px",
  border: CADRE,
  borderRadius: 13,
  fontSize: 13.5,
  fontWeight: 800,
  cursor: "pointer",
};

// ══════════════════════════════════════════════════════════ un message signalé ══

export function DecisionSignalement({
  messageId,
  origine,
}: {
  messageId: string;
  origine: Origine;
}) {
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
          ? await leverUnSignalement(messageId, origine)
          : await retirerUnMessageSignale(messageId, origine);
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
            ...BOUTON,
            background: enCours ? GRIS : BLANC,
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
            ...BOUTON,
            background: enCours ? GRIS : ENCRE,
            color: BLANC,
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

// ══════════════════════════════════════════════════════ une communauté entière ══

/**
 * Fermer une communauté, ou la rouvrir.
 *
 * Fermer n'efface rien : les messages restent en base, et seul le pouvoir
 * d'exploitation voit encore l'intérieur. C'est ce qui permet de rouvrir quand
 * l'enquête ne donne rien — et c'est pour ça que le geste s'affiche comme une
 * bascule, pas comme une suppression.
 */
export function FermerLaCommunaute({
  communauteId,
  nom,
  fermee,
}: {
  communauteId: string;
  nom: string;
  fermee: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="sticker-press"
        style={{ ...BOUTON, background: fermee ? BLANC : ENCRE, color: fermee ? ENCRE : BLANC }}
      >
        {fermee ? "Rouvrir" : "Fermer"}
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 280 }}>
      <label style={{ display: "grid", gap: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>
          Pourquoi {fermee ? "rouvrir" : "fermer"} « {nom} » ?
        </span>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={2}
          autoFocus
          placeholder="Ce motif restera au journal."
          style={{
            width: "100%",
            padding: "10px 12px",
            border: CADRE,
            borderRadius: 11,
            background: BLANC,
            fontSize: 14,
            fontFamily: "inherit",
          }}
        />
      </label>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={enCours}
          onClick={() => {
            setErreur(null);
            demarrer(async () => {
              const suite = await basculerUneCommunaute(communauteId, motif);
              if (suite.ok) {
                setOuvert(false);
                setMotif("");
              } else {
                setErreur(suite.message);
              }
            });
          }}
          className="sticker-press"
          style={{ ...BOUTON, background: enCours ? GRIS : ENCRE, color: BLANC }}
        >
          {enCours ? "…" : fermee ? "Rouvrir" : "Fermer"}
        </button>

        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            setErreur(null);
          }}
          style={{ ...BOUTON, background: BLANC }}
        >
          Annuler
        </button>
      </div>

      {erreur ? (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ORANGE }}>
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
