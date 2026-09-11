"use client";

import { useState, useTransition } from "react";

import {
  sInscrire,
  seDesinscrire,
  type EtatInscription,
} from "@/lib/evenements/actions-inscription";
import { BLANC, CADRE, ENCRE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * S'inscrire, ou se retirer.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX BOUTONS DIFFÉRENTS, PAS UNE BASCULE
 *
 * « Se désinscrire » n'a pas la même portée que « S'inscrire » : l'un rend une
 * place, l'autre en prend une. Un interrupteur unique qui change de libellé
 * fait cliquer par réflexe — et sur un événement complet, la place rendue par
 * mégarde est reprise dans la minute.
 *
 * Le bouton de retrait est donc discret, et il annonce ce qu'il fait avant de
 * le faire.
 */
export function BoutonInscription({
  evenementId,
  inscrit,
  complet,
}: {
  evenementId: string;
  inscrit: boolean;
  complet: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [retour, setRetour] = useState<EtatInscription | null>(null);

  if (inscrit) {
    return (
      <div>
        <div
          role="status"
          style={{
            padding: 14,
            border: CADRE,
            borderRadius: 15,
            background: VERT,
            textAlign: "center",
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          Tu es inscrit·e
        </div>

        {retour?.message ? <Message texte={retour.message} /> : null}

        <button
          type="button"
          disabled={enCours}
          onClick={() =>
            demarrer(async () => {
              setRetour(await seDesinscrire(evenementId));
            })
          }
          style={{
            width: "100%",
            marginTop: 10,
            padding: "11px 16px",
            border: CADRE,
            borderRadius: 13,
            background: BLANC,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: enCours ? "wait" : "pointer",
            fontFamily: "inherit",
            color: ENCRE,
          }}
        >
          {enCours ? "…" : "Me désinscrire"}
        </button>

        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            textAlign: "center",
            marginTop: 8,
            opacity: 0.65,
          }}
        >
          Ta place repartira aux autres.
        </div>
      </div>
    );
  }

  if (complet) {
    return (
      <div
        style={{
          padding: 14,
          border: CADRE,
          borderRadius: 15,
          background: BLANC,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Toutes les places sont prises.
      </div>
    );
  }

  return (
    <div>
      {retour?.message ? <Message texte={retour.message} /> : null}

      <button
        type="button"
        disabled={enCours}
        className="sticker-press"
        onClick={() =>
          demarrer(async () => {
            setRetour(await sInscrire(evenementId));
          })
        }
        style={{
          width: "100%",
          padding: "15px 20px",
          border: CADRE,
          borderRadius: 15,
          background: ENCRE,
          color: BLANC,
          fontSize: 14.5,
          fontWeight: 800,
          cursor: enCours ? "wait" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {enCours ? "Inscription…" : "M'inscrire"}
      </button>
    </div>
  );
}

function Message({ texte }: { texte: string }) {
  return (
    <div
      role="alert"
      style={{
        marginBottom: 10,
        padding: "10px 13px",
        border: CADRE,
        borderRadius: 12,
        background: ORANGE,
        color: BLANC,
        fontSize: 12.5,
        fontWeight: 700,
        lineHeight: 1.45,
      }}
    >
      {texte}
    </div>
  );
}
