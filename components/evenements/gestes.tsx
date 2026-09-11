"use client";

import { useActionState, useState, useTransition } from "react";

import type { EtatContenu, Geste } from "@/lib/cms/cycle";
import { LIBELLE_GESTE, gestesDepuis } from "@/lib/cms/cycle";
import {
  annulerEvenement,
  retablirEvenement,
  trancherEvenement,
  type EtatGeste,
} from "@/lib/evenements/actions";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Les gestes sur un événement : publier, retirer, annuler.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON N'AFFICHE QUE DES BOUTONS VIVANTS
 *
 * `gestesDepuis` rend les transitions permises depuis l'état courant. Montrer
 * « Publier » sur un événement déjà publié promettrait une action qui répond
 * « transition interdite » — et ferait chercher la panne du mauvais côté.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ANNULER DEMANDE UNE RAISON, ET LE CHAMP S'OUVRE AVANT LE BOUTON
 *
 * Comme le refus de la file de modération. Un « annulé » sans motif fait
 * écrire tous les inscrits un par un — et c'est la seule phrase qu'on pourra
 * leur montrer.
 */
export function GestesEvenement({
  evenementId,
  etat,
  annule,
}: {
  evenementId: string;
  etat: EtatContenu;
  annule: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [retour, setRetour] = useState<EtatGeste | null>(null);
  const [motifOuvert, setMotifOuvert] = useState(false);

  const [etatAnnulation, annulerAction] = useActionState<EtatGeste | null, FormData>(
    annulerEvenement.bind(null, evenementId),
    null,
  );

  // Seuls les gestes que la machine autorise. `soumettre` et `refuser`
  // n'arrivent jamais ici : les événements n'ont pas de file (§18.1).
  const gestes = gestesDepuis(etat).filter(
    (g): g is Extract<Geste, "publier" | "retirer" | "reprendre"> =>
      g === "publier" || g === "retirer" || g === "reprendre",
  );

  const message = retour?.message ?? etatAnnulation?.message ?? null;

  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 20,
        background: BLANC,
        boxShadow: `4px 4px 0 ${ENCRE}`,
        padding: 18,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".12em",
          opacity: 0.6,
          marginBottom: 12,
        }}
      >
        Ce qu&apos;on peut faire
      </div>

      {message ? (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "10px 13px",
            border: CADRE,
            borderRadius: 12,
            background: ORANGE,
            color: BLANC,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {gestes.map((g) => (
          <button
            key={g}
            type="button"
            disabled={enCours}
            className="sticker-press"
            onClick={() =>
              demarrer(async () => {
                setRetour(await trancherEvenement(evenementId, g));
              })
            }
            style={bouton(g === "publier" ? VERT : BLANC)}
          >
            {LIBELLE_GESTE[g]}
          </button>
        ))}

        {annule ? (
          <button
            type="button"
            disabled={enCours}
            className="sticker-press"
            onClick={() =>
              demarrer(async () => {
                setRetour(await retablirEvenement(evenementId));
              })
            }
            style={bouton(JAUNE)}
            title="Lever l'annulation — la raison s'efface avec elle."
          >
            Lever l&apos;annulation
          </button>
        ) : (
          <button
            type="button"
            disabled={enCours}
            onClick={() => setMotifOuvert((o) => !o)}
            style={bouton(BLANC)}
          >
            {motifOuvert ? "Ne pas annuler" : "Annuler l'événement…"}
          </button>
        )}
      </div>

      {motifOuvert && !annule ? (
        <form action={annulerAction} style={{ marginTop: 14 }}>
          <label
            htmlFor={`raison-${evenementId}`}
            style={{
              display: "block",
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              opacity: 0.6,
              marginBottom: 6,
            }}
          >
            Pourquoi cette annulation
          </label>
          <textarea
            id={`raison-${evenementId}`}
            name="raison"
            required
            minLength={8}
            rows={3}
            placeholder="Ce que liront les inscrits sur la fiche."
            style={{
              width: "100%",
              padding: "12px 14px",
              border: CADRE,
              borderRadius: 14,
              background: "#F4EEFC",
              fontFamily: "inherit",
              fontSize: 13.5,
              fontWeight: 500,
              outline: "none",
              resize: "vertical",
            }}
          />
          <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8, opacity: 0.75 }}>
            L&apos;événement <strong>reste en ligne</strong>, marqué annulé. Les
            inscrits ont noté la date — les envoyer sur une page absente les
            ferait chercher.
          </div>
          <button
            type="submit"
            className="sticker-press"
            style={{ ...bouton(ORANGE), color: BLANC, marginTop: 10 }}
          >
            Annuler cet événement
          </button>
        </form>
      ) : null}
    </div>
  );
}

function bouton(fond: string) {
  return {
    padding: "11px 18px",
    border: CADRE,
    borderRadius: 13,
    background: fond,
    boxShadow: `3px 3px 0 ${ENCRE}`,
    fontSize: 13.5,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    color: ENCRE,
  } as const;
}
