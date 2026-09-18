"use client";

import { useState, useTransition } from "react";

import {
  epinglerUnSujet,
  retirerUnMessage,
  signalerUnMessage,
  verrouillerUnSujet,
} from "@/lib/forum/actions";
import { BLANC, CADRE, ENCRE, ORANGE } from "@/lib/systeme/charte";

/**
 * Les petits gestes : épingler, verrouiller, retirer, signaler.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CES BOUTONS NE PROTÈGENT RIEN
 *
 * Ils s'affichent selon les droits reçus, pour ne pas proposer ce qui sera
 * refusé. Mais la garde est dans `redaction.ts`, et elle y est **seule** :
 * chaque export d'un module « use server » est une URL que le navigateur peut
 * appeler directement, avec les arguments qu'il veut.
 *
 * Autrement dit : cacher ce fichier entier ne fermerait rien du tout.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * « RETIRER » NE DEMANDE PAS CONFIRMATION, « SIGNALER » NON PLUS
 *
 * Retirer son propre message est réversible par le fait de le réécrire.
 * Signaler ne supprime rien — le message reste dans le fil, marqué. Aucun des
 * deux ne mérite une boîte de dialogue ; en mettre une là où rien n'est perdu
 * apprend à cliquer « oui » sans lire.
 *
 * Retirer le message d'un **autre**, en revanche, est définitif et consigné.
 * C'est le seul geste de ce fichier qui demande une confirmation.
 */

const PETIT: React.CSSProperties = {
  padding: "6px 12px",
  border: CADRE,
  borderRadius: 999,
  background: BLANC,
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  cursor: "pointer",
};

export function GestesDeSujet({
  slug,
  sujetId,
  epingle,
  verrouille,
}: {
  slug: string;
  sujetId: string;
  epingle: boolean;
  verrouille: boolean;
}) {
  const [enCours, demarrer] = useTransition();

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        disabled={enCours}
        onClick={() => demarrer(() => void epinglerUnSujet(slug, sujetId))}
        style={{ ...PETIT, background: epingle ? ENCRE : BLANC, color: epingle ? BLANC : ENCRE }}
      >
        {epingle ? "Désépingler" : "Épingler"}
      </button>

      <button
        type="button"
        disabled={enCours}
        onClick={() => demarrer(() => void verrouillerUnSujet(slug, sujetId))}
        style={{ ...PETIT, background: verrouille ? ENCRE : BLANC, color: verrouille ? BLANC : ENCRE }}
      >
        {verrouille ? "Déverrouiller" : "Verrouiller"}
      </button>
    </div>
  );
}

export function GestesDeMessage({
  slug,
  sujetId,
  messageId,
  sien,
  peutRetirer,
  signale,
  connecte,
}: {
  slug: string;
  sujetId: string;
  messageId: string;
  /** Le message est de la personne connectée. */
  sien: boolean;
  peutRetirer: boolean;
  signale: boolean;
  connecte: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [fait, setFait] = useState(signale);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {peutRetirer ? (
        <button
          type="button"
          disabled={enCours}
          onClick={() => {
            // Seul le message d'un autre est définitif et consigné.
            if (!sien && !window.confirm("Retirer ce message ? C'est définitif, et c'est consigné.")) {
              return;
            }
            demarrer(() => void retirerUnMessage(slug, messageId, sujetId));
          }}
          style={PETIT}
        >
          Retirer
        </button>
      ) : null}

      {connecte && !sien ? (
        <button
          type="button"
          disabled={enCours || fait}
          onClick={() => {
            setFait(true);
            demarrer(() => void signalerUnMessage(slug, messageId, sujetId));
          }}
          style={{ ...PETIT, opacity: fait ? 0.55 : 1, cursor: fait ? "default" : "pointer" }}
        >
          {fait ? "Signalé" : "Signaler"}
        </button>
      ) : null}

      {signale ? (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            color: ORANGE,
            fontWeight: 700,
          }}
        >
          Signalé
        </span>
      ) : null}
    </div>
  );
}
