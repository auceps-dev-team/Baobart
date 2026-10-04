"use client";

import { useState, useTransition } from "react";

import { basculerSuivi } from "@/lib/social/actions";

const ENCRE = "#121212";
const LAVANDE = "#EADFF9";
const JAUNE = "#FFD84A";

/**
 * « Suivre », qui suit vraiment. Le bouton de la maquette était une
 * étiquette (relevé le 04/10). Sans session, il mène à la connexion.
 */
export function BoutonSuivre({ createurId, connecte }: { createurId: string; connecte: boolean }) {
  const [suivi, setSuivi] = useState(false);
  const [enCours, demarrer] = useTransition();
  return (
    <button
      type="button"
      disabled={enCours}
      aria-pressed={suivi}
      data-suivre={createurId}
      onClick={() => {
        if (!connecte) {
          window.location.href = "/connexion";
          return;
        }
        demarrer(async () => {
          const r = await basculerSuivi(createurId);
          if (r.ok) setSuivi(r.actif);
          else if (r.connexion) window.location.href = "/connexion";
        });
      }}
      style={{
        padding: "7px 13px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 10,
        background: suivi ? JAUNE : LAVANDE,
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "inherit",
        color: ENCRE,
        cursor: "pointer",
      }}
    >
      {suivi ? "Suivi ✓" : "Suivre"}
    </button>
  );
}

/**
 * « Inviter » : copie le lien de l'espace. Il n'existe pas d'invitation
 * nominative — une communauté publique se rejoint par sa page ; le lien est
 * donc l'invitation, et le dire vaut mieux qu'un bouton qui promet plus.
 */
export function BoutonInviter({ slug }: { slug: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const lien = `${window.location.origin}/communautes/${slug}`;
        try {
          await navigator.clipboard.writeText(lien);
          setCopie(true);
          setTimeout(() => setCopie(false), 2500);
        } catch {
          window.prompt("Copie ce lien pour inviter :", lien);
        }
      }}
      style={{
        padding: "9px 14px",
        border: `2.5px solid ${ENCRE}`,
        borderRadius: 12,
        background: copie ? JAUNE : LAVANDE,
        fontSize: 12.5,
        fontWeight: 800,
        fontFamily: "inherit",
        color: ENCRE,
        cursor: "pointer",
      }}
    >
      {copie ? "Lien copié ✓" : "Inviter"}
    </button>
  );
}

