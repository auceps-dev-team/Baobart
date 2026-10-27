"use client";

import { useActionState } from "react";

import type { EtatReglage } from "@/lib/contact/actions-createur";

/**
 * L'interrupteur du bouton « Contact » de la vitrine.
 *
 * C'est ici que mène le pied de chaque message reçu (« Tu peux aussi fermer
 * ton bouton depuis ton profil ») : celui qu'on importune doit pouvoir y
 * mettre fin en un geste, sans écrire à l'équipe.
 *
 * Il dit aussi ce que coûte une réponse — l'adresse du créateur part avec —,
 * parce que c'est la seule chose que le bouton ne montre pas au visiteur.
 */

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const ORANGE = "#E2622C";
const JAUNE = "#FFD84A";
const CADRE = `2.5px solid ${ENCRE}`;

export function PanneauMessagesVitrine({
  ouvert,
  regler,
}: {
  ouvert: boolean;
  regler: (precedent: EtatReglage | null, donnees: FormData) => Promise<EtatReglage>;
}) {
  const [etat, agir, enCours] = useActionState(regler, null);

  return (
    <div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
        {ouvert
          ? "Les visiteurs connectés peuvent t'écrire depuis ta vitrine. Le message t'arrive par courriel, et ton adresse reste privée."
          : "Ton bouton « Contact » est fermé : il n'apparaît plus sur ta vitrine, et personne ne peut t'y écrire."}
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55, opacity: 0.75 }}>
        Répondre à un message dévoile ton adresse à cette personne, et à elle seule.
      </p>

      <form action={agir} style={{ marginTop: 14 }}>
        <input type="hidden" name="ouvert" value={ouvert ? "non" : "oui"} />
        <button
          type="submit"
          disabled={enCours}
          data-messages-vitrine={ouvert ? "fermer" : "ouvrir"}
          style={{
            padding: "11px 17px",
            border: CADRE,
            borderRadius: 13,
            background: ouvert ? BLANC : JAUNE,
            fontFamily: "inherit",
            fontSize: 13.5,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {enCours ? "…" : ouvert ? "Fermer mon bouton « Contact »" : "Rouvrir mon bouton « Contact »"}
        </button>
        {etat ? (
          <p role="status" style={{ margin: "10px 0 0", fontSize: 13.5, fontWeight: 700, color: etat.ok ? ENCRE : ORANGE }}>
            {etat.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
