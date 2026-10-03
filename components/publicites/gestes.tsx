"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";

import { archiverPublicite, basculerPause } from "@/lib/publicites/actions";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE } from "@/lib/systeme/charte";

/**
 * Modifier, suspendre, archiver — sous chaque publicité.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ARCHIVER, PAS SUPPRIMER
 *
 * La suppression effaçait les affichages et les clics de la campagne, et rien
 * ne les recréait. L'archive la retire de la mosaïque et de la liste active, et
 * garde tout. Comme elle se défait d'un clic, elle ne demande pas de
 * confirmation.
 */
export function GestesPublicite({
  id,
  enPause,
  terminee,
  archivee = false,
}: {
  id: string;
  enPause: boolean;
  terminee: boolean;
  archivee?: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const agir = (geste: () => Promise<{ ok: boolean; message?: string }>) => {
    setErreur(null);
    demarrer(async () => {
      const suite = await geste();
      if (!suite.ok) setErreur(suite.message ?? "Le geste n'a pas abouti.");
    });
  };

  if (archivee) {
    return (
      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button type="button" disabled={enCours} onClick={() => agir(() => archiverPublicite(id, false))} style={bouton(BLANC)}>
            Restaurer
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.65 }}>
            Elle reviendra en pause : relis-la avant de la remettre en diffusion.
          </span>
        </div>
        {erreur ? <Erreur>{erreur}</Erreur> : null}
      </div>
    );
  }

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

        <button type="button" disabled={enCours} onClick={() => agir(() => archiverPublicite(id, true))} style={bouton(BLANC)}>
          Archiver
        </button>
      </div>

      {erreur ? <Erreur>{erreur}</Erreur> : null}
    </div>
  );
}

function Erreur({ children }: { children: React.ReactNode }) {
  return (
    <span role="status" style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>
      {children}
    </span>
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
