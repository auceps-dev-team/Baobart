"use client";

import { useState, useTransition } from "react";

import { basculerEpingle, supprimerCollection } from "@/lib/collections/actions";
import { BLANC, CADRE, ENCRE, ORANGE } from "@/lib/systeme/charte";

/** Retirer une ressource de la collection — la ressource, elle, ne bouge pas. */
export function RetirerDeLaCollection({ collectionId, produitId }: { collectionId: string; produitId: string }) {
  const [enCours, demarrer] = useTransition();
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => demarrer(async () => void (await basculerEpingle(collectionId, produitId, false)))}
      style={bouton(BLANC)}
    >
      {enCours ? "…" : "Retirer"}
    </button>
  );
}

/**
 * Supprimer la collection, en deux temps : ce qu'elle range part avec elle, et
 * rien ne le recrée. Les ressources restent sur Baobart.
 */
export function SupprimerLaCollection({ collectionId }: { collectionId: string }) {
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, demarrer] = useTransition();
  if (!confirmer) {
    return (
      <button type="button" onClick={() => setConfirmer(true)} style={bouton(BLANC)}>
        Supprimer la collection
      </button>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <button type="button" disabled={enCours} onClick={() => demarrer(async () => supprimerCollection(collectionId))} style={{ ...bouton(ORANGE), color: BLANC }}>
        Supprimer, avec son contenu
      </button>
      <button type="button" onClick={() => setConfirmer(false)} style={bouton(BLANC)}>
        Garder
      </button>
      <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>Les ressources rangées restent sur Baobart ; seul leur rangement disparaît.</span>
    </div>
  );
}

function bouton(fond: string): React.CSSProperties {
  return { padding: "7px 13px", border: CADRE, borderRadius: 11, background: fond, fontSize: 12.5, fontWeight: 800, fontFamily: "inherit", color: ENCRE, cursor: "pointer" };
}
