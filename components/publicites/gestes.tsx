"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";

import { basculerPause, supprimerPublicite } from "@/lib/publicites/actions";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE } from "@/lib/systeme/charte";

/**
 * Modifier, suspendre, supprimer — sous chaque publicité.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA SUPPRESSION DEMANDE UN SECOND CLIC
 *
 * Elle efface les affichages et les clics de la campagne, et rien ne les
 * recrée. Le second bouton dit ce qui sera perdu et propose la pause, qui
 * garde tout : c'est presque toujours ce qu'on voulait.
 */
export function GestesPublicite({
  id,
  enPause,
  terminee,
}: {
  id: string;
  enPause: boolean;
  terminee: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const agir = (geste: () => Promise<{ ok: boolean; message?: string }>) => {
    setErreur(null);
    demarrer(async () => {
      const suite = await geste();
      if (!suite.ok) setErreur(suite.message ?? "Le geste n'a pas abouti.");
      setConfirmer(false);
    });
  };

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Link href={`/dashboard/publicites/${id}` as Route} style={bouton(BLANC)}>
          Modifier
        </Link>

        {/* Une campagne terminée ne reprendra pas : la pause n'y change rien. */}
        {terminee ? null : (
          <button
            type="button"
            disabled={enCours}
            onClick={() => agir(() => basculerPause(id, !enPause))}
            style={bouton(enPause ? JAUNE : BLANC)}
          >
            {enPause ? "Reprendre la diffusion" : "Mettre en pause"}
          </button>
        )}

        {confirmer ? (
          <>
            <button
              type="button"
              disabled={enCours}
              onClick={() => agir(() => supprimerPublicite(id))}
              style={{ ...bouton(ORANGE), color: BLANC }}
            >
              Supprimer, chiffres compris
            </button>
            <button type="button" disabled={enCours} onClick={() => setConfirmer(false)} style={bouton(BLANC)}>
              Garder
            </button>
          </>
        ) : (
          <button type="button" disabled={enCours} onClick={() => setConfirmer(true)} style={bouton(BLANC)}>
            Supprimer
          </button>
        )}
      </div>

      {confirmer ? (
        <span style={{ fontSize: 12, fontWeight: 700 }}>
          Les affichages et les clics de cette campagne seront effacés. Les ventes restent, sans
          bannière attachée. Pour arrêter sans rien perdre, mets-la plutôt en pause.
        </span>
      ) : null}

      {erreur ? (
        <span role="status" style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>
          {erreur}
        </span>
      ) : null}
    </div>
  );
}

function bouton(fond: string): React.CSSProperties {
  return {
    padding: "7px 13px",
    border: CADRE,
    borderRadius: 11,
    background: fond,
    fontSize: 12.5,
    fontWeight: 800,
    fontFamily: "inherit",
    color: ENCRE,
    cursor: "pointer",
  };
}
