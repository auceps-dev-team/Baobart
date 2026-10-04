"use client";

import { useActionState } from "react";

import type { EtatLien } from "@/lib/infolettre/actions";

const ENCRE = "#121212";

/**
 * Le bouton des pages de confirmation et de désinscription.
 *
 * Le lien du courriel ouvre la page ; c'est ce bouton qui agit. Les
 * antivirus de messagerie suivent les liens pour les inspecter : agir au
 * chargement confirmerait des inscriptions que personne n'a voulues.
 */
export function BoutonLien({
  action,
  libelle,
  fond,
}: {
  action: () => Promise<EtatLien>;
  libelle: string;
  fond: string;
}) {
  const [etat, agir, enCours] = useActionState<EtatLien, FormData>(async () => action(), { fait: false });

  if (etat.fait) {
    return (
      <p role="status" data-lien-resultat={etat.ok ? "ok" : "refus"} style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>
        {etat.message}
      </p>
    );
  }

  return (
    <form action={agir}>
      <button
        type="submit"
        disabled={enCours}
        className="sticker-press"
        style={{ padding: "14px 24px", border: `2.5px solid ${ENCRE}`, borderRadius: 14, background: fond, color: ENCRE, fontSize: 14.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", boxShadow: `4px 4px 0 ${ENCRE}` }}
      >
        {enCours ? "Un instant…" : libelle}
      </button>
    </form>
  );
}
