"use client";

import { useState, useTransition } from "react";

import {
  quitterUneCommunaute,
  rejoindreUneCommunaute,
} from "@/lib/forum/actions";
import { BLANC, CADRE, ENCRE, GRIS, ORANGE } from "@/lib/systeme/charte";

/**
 * Entrer dans une communauté, ou en sortir.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX ÉTATS, DEPUIS QUE TOUTES LES COMMUNAUTÉS SONT OUVERTES
 *
 * Membre → « Quitter ». Sinon → « Rejoindre ». Il y en avait un troisième —
 * « on entre ici sur invitation », sans bouton — qui a disparu avec le réglage
 * de visibilité : il ne menait nulle part, faute de table de demandes
 * d'adhésion.
 *
 * Un état de moins, et c'est un écran de plus qui dit la vérité. Un bouton qui
 * ne mène nulle part est un aveu d'inachèvement affiché à l'utilisateur.
 */
export function Adhesion({
  slug,
  estMembre,
  estCreateur,
  connecte,
}: {
  slug: string;
  estMembre: boolean;
  estCreateur: boolean;
  connecte: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  // Le créateur ne quitte pas son propre espace : il resterait administrateur
  // par `creatorId` tout en étant absent de ses membres. Le fermer est le
  // geste qui correspond, et il se fait ailleurs.
  if (estCreateur) return <Mention>Tu as ouvert cet espace.</Mention>;

  if (!connecte) {
    return <Mention>Connecte-toi pour rejoindre cette communauté.</Mention>;
  }

  const agir = () => {
    setErreur(null);
    demarrer(async () => {
      const suite = estMembre
        ? await quitterUneCommunaute(slug)
        : await rejoindreUneCommunaute(slug);
      if (!suite.ok) setErreur(suite.message);
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={agir}
        disabled={enCours}
        className="sticker-press"
        style={{
          padding: "12px 22px",
          border: CADRE,
          borderRadius: 14,
          background: enCours ? GRIS : estMembre ? BLANC : ENCRE,
          color: estMembre ? ENCRE : BLANC,
          fontSize: 14,
          fontWeight: 800,
          cursor: enCours ? "progress" : "pointer",
        }}
      >
        {enCours ? "…" : estMembre ? "Quitter" : "Rejoindre"}
      </button>

      {erreur ? (
        <p style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: ORANGE }}>
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

function Mention({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, opacity: 0.72 }}>
      {children}
    </p>
  );
}
