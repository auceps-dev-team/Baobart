"use client";

import { useState, useTransition } from "react";

import { retirerDuFilDe, signalerDansLeFilDe } from "@/lib/forum/actions";
import { BLANC, CADRE, ORANGE } from "@/lib/systeme/charte";

/**
 * Les deux gestes sur un message du fil : retirer, signaler.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CES BOUTONS NE PROTÈGENT RIEN
 *
 * Ils s'affichent selon les droits reçus, pour ne pas proposer ce qui sera
 * refusé. Mais la garde est dans `lib/forum/fil.ts`, et elle y est **seule** :
 * chaque export d'un module « use server » est une URL que le navigateur peut
 * appeler directement, avec les arguments qu'il veut.
 *
 * Autrement dit : cacher ce fichier entier ne fermerait rien du tout.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN SEUL DES DEUX GESTES DEMANDE CONFIRMATION
 *
 * Signaler ne supprime rien — le message reste dans le fil, marqué. Retirer
 * son propre message se rattrape en le réécrivant. Mettre une boîte de
 * dialogue là où rien n'est perdu apprend à cliquer « oui » sans lire.
 *
 * Retirer le message d'un **autre** est définitif et consigné. C'est le seul
 * qui la mérite.
 */

const PETIT: React.CSSProperties = {
  padding: "5px 11px",
  border: CADRE,
  borderRadius: 999,
  background: BLANC,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  cursor: "pointer",
};

export function GestesDeMessage({
  slug,
  messageId,
  sien,
  peutRetirer,
  signale,
  connecte,
}: {
  slug: string;
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
            if (
              !sien &&
              !window.confirm("Retirer ce message ? C'est définitif, et c'est consigné.")
            ) {
              return;
            }
            demarrer(() => void retirerDuFilDe(slug, messageId));
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
            demarrer(() => void signalerDansLeFilDe(slug, messageId));
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
            fontSize: 10,
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
