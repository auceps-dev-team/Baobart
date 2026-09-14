"use client";

import { useActionState, useState, useTransition } from "react";

import type { EtatContenu } from "@/lib/cms/cycle";
import { LIBELLE_GESTE, gestesDepuis } from "@/lib/cms/cycle";
import { gestePermis, type Portee } from "@/lib/evenements/acces";
import {
  annulerEvenement,
  retablirEvenement,
  trancherEvenement,
  trancherEvenementAvecMotif,
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
 * Deux filtres, et pas un : ce que la **machine** permet depuis cet état, puis
 * ce que la **portée** permet à cette personne. Une agence ne voit donc jamais
 * « Publier », même sur un brouillon où la transition existe.
 *
 * Cacher le bouton ne ferme rien — l'action serveur repose la question et rend
 * `GESTE_RESERVE`. Ce filtre-ci sert à ne pas mentir, pas à protéger.
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
  portee,
}: {
  evenementId: string;
  etat: EtatContenu;
  annule: boolean;
  /**
   * Sert **uniquement** à choisir les boutons. Elle ne contient rien de secret
   * — le rôle et l'identifiant de qui regarde — et la décision qui compte est
   * reprise côté serveur à chaque clic.
   */
  portee: Portee;
}) {
  const [enCours, demarrer] = useTransition();
  const [retour, setRetour] = useState<EtatGeste | null>(null);
  const [motifOuvert, setMotifOuvert] = useState(false);
  const [refusOuvert, setRefusOuvert] = useState(false);

  const [etatRefus, refuserAction] = useActionState<EtatGeste | null, FormData>(
    trancherEvenementAvecMotif.bind(null, evenementId, "refuser"),
    null,
  );

  const [etatAnnulation, annulerAction] = useActionState<EtatGeste | null, FormData>(
    annulerEvenement.bind(null, evenementId),
    null,
  );

  // Ce que la machine permet depuis cet état, puis ce que la portée permet à
  // cette personne.
  //
  // ══════════════════════════════════════════════════════════════════════════
  // `refuser` SORT DE CETTE LISTE, MAIS IL EXISTE
  //
  // Il porte un motif, donc un formulaire — pas un clic. Il a son propre bloc
  // plus bas, comme l'annulation, pour la même raison : `useActionState` et
  // `useTransition` ne se branchent pas de la même façon.
  const gestes = gestesDepuis(etat).filter(
    (g) => g !== "refuser" && gestePermis(portee, g),
  );

  // Refuser n'a de sens que sur ce qui attend une décision, et seulement pour
  // qui peut trancher. On ne se refuse pas à soi-même.
  const peutRefuser = etat === "SOUMIS" && gestePermis(portee, "refuser");

  const message =
    retour?.message ?? etatRefus?.message ?? etatAnnulation?.message ?? null;

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

      {portee.etendue === "LES_MIENS" ? (
        <p style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, marginBottom: 12, opacity: 0.75 }}>
          La mise en ligne revient à l&apos;équipe Baobart. Envoie ta fiche en
          relecture : tant qu&apos;elle est en brouillon, personne ne la voit.
        </p>
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
            style={bouton(g === "publier" || g === "soumettre" ? VERT : BLANC)}
          >
            {LIBELLE_GESTE[g]}
          </button>
        ))}

        {peutRefuser ? (
          <button
            type="button"
            disabled={enCours}
            onClick={() => setRefusOuvert((o) => !o)}
            style={bouton(BLANC)}
          >
            {refusOuvert ? "Ne pas refuser" : "Refuser…"}
          </button>
        ) : null}

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

      {refusOuvert && peutRefuser ? (
        <form action={refuserAction} style={{ marginTop: 14 }}>
          <label htmlFor={`motif-${evenementId}`} style={etiquette}>
            Pourquoi tu refuses cette fiche
          </label>
          <textarea
            id={`motif-${evenementId}`}
            name="motif"
            required
            minLength={8}
            rows={3}
            placeholder="Ce que l'organisateur lira sur sa fiche."
            style={champ}
          />
          <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8, opacity: 0.75 }}>
            C&apos;est la <strong>seule chose</strong> que l&apos;organisateur
            verra : il n&apos;y a pas de messagerie. Dis ce qu&apos;il faut
            corriger, pas seulement ce qui ne va pas.
          </div>
          <button
            type="submit"
            className="sticker-press"
            style={{ ...bouton(ORANGE), color: BLANC, marginTop: 10 }}
          >
            Refuser cette fiche
          </button>
        </form>
      ) : null}

      {motifOuvert && !annule ? (
        <form action={annulerAction} style={{ marginTop: 14 }}>
          <label htmlFor={`raison-${evenementId}`} style={etiquette}>
            Pourquoi cette annulation
          </label>
          <textarea
            id={`raison-${evenementId}`}
            name="raison"
            required
            minLength={8}
            rows={3}
            placeholder="Ce que liront les inscrits sur la fiche."
            style={champ}
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

/**
 * Les deux textes de cet écran partagent leur habillage.
 *
 * Ils ne partagent surtout pas leur sens : la raison d'annulation s'adresse
 * aux INSCRITS d'un événement qui n'aura pas lieu, le motif de refus à
 * l'ORGANISATEUR d'une fiche qui ne paraîtra pas. Deux champs, deux publics,
 * une seule mise en forme.
 */
const etiquette = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: ".1em",
  opacity: 0.6,
  marginBottom: 6,
} as const;

const champ = {
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
} as const;
