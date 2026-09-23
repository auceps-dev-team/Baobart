"use client";

import { useActionState, useState } from "react";

import type { EtatAction } from "@/lib/rgpd/actions";
import type { EtatEffacement } from "@/lib/rgpd/effacement";

/**
 * Le panneau « effacer mon compte ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL DIT CE QUI RESTE, ET C'EST LA PARTIE QUI COMPTE
 *
 * Promettre un effacement total serait faux : les écritures comptables
 * restent, parce que la loi les fait conserver et parce qu'un grand livre dont
 * les lignes perdent leur contrepartie n'est plus un grand livre.
 *
 * Le dire d'avance, en toutes lettres, vaut mieux que de le découvrir après —
 * et c'est aussi ce que demande l'article 13 du RGPD : la personne doit savoir
 * ce qu'il advient de ses données.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE FORMULAIRE EST REPLIÉ PAR DÉFAUT
 *
 * Pas pour le cacher — il est annoncé —, mais pour qu'on n'y tombe pas en
 * faisant défiler la page de profil. Ce qui suit est irréversible au bout de
 * trente jours.
 */

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const ORANGE = "#E2622C";
const CADRE = `2.5px solid ${ENCRE}`;

const champ = {
  width: "100%",
  padding: "11px 13px",
  border: CADRE,
  borderRadius: 12,
  background: BLANC,
  fontFamily: "inherit",
  fontSize: 13.5,
};

const etiquette = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: ".1em",
  opacity: 0.55,
  marginBottom: 6,
};

function Message({ etat }: { etat: EtatAction | null }) {
  if (!etat) return null;

  return (
    <p
      style={{
        margin: "10px 0 0",
        fontSize: 13.5,
        fontWeight: 700,
        color: etat.ok ? ENCRE : ORANGE,
      }}
    >
      {etat.message}
    </p>
  );
}

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function PanneauEffacement({
  etat,
  courriel,
  demander,
  annuler,
}: {
  etat: EtatEffacement;
  courriel: string;
  demander: (
    precedent: EtatAction | null,
    donnees: FormData,
  ) => Promise<EtatAction>;
  annuler: (
    precedent: EtatAction | null,
    donnees: FormData,
  ) => Promise<EtatAction>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [suiteDemande, agirDemander, demandeEnCours] = useActionState(
    demander,
    null,
  );
  const [suiteAnnule, agirAnnuler, annuleEnCours] = useActionState(
    annuler,
    null,
  );

  if (etat.demande && etat.executeLe) {
    return (
      <div>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: ORANGE }}>
          {`Effacement programmé le ${DATE.format(etat.executeLe)}.`}
        </p>
        <p style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
          {
            "Ton compte fonctionne normalement d'ici là. Passé cette date, l'identité est caviardée et les messages partent — il n'y a pas de retour en arrière."
          }
        </p>

        <form action={agirAnnuler} style={{ marginTop: 14 }}>
          <button
            type="submit"
            disabled={annuleEnCours}
            style={{
              padding: "11px 17px",
              border: CADRE,
              borderRadius: 13,
              background: BLANC,
              fontFamily: "inherit",
              fontSize: 13.5,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {annuleEnCours ? "…" : "Annuler la demande"}
          </button>
          <Message etat={suiteAnnule} />
        </form>
      </div>
    );
  }

  return (
    <div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
        {
          "Tu peux demander l'effacement de ton compte. Il prend effet trente jours plus tard, et reste annulable jusque-là."
        }
      </p>

      <div
        style={{
          marginTop: 12,
          padding: 14,
          border: CADRE,
          borderRadius: 14,
          background: "#F4EEFC",
          fontSize: 12.5,
          lineHeight: 1.6,
        }}
      >
        <strong>Ce qui part :</strong> profil, photo, biographie, messages de
        forum et de communauté, commentaires, collections, abonnements,
        notifications, moyens de paiement, sessions et mots de passe.
        <br />
        <strong>Ce qui reste :</strong> les commandes, factures et écritures
        comptables, sans ton nom ni ton adresse. La loi les fait conserver, et
        les vendeurs à qui tu as acheté en ont besoin. Tes ressources publiées
        sont retirées de la vente mais restent téléchargeables par ceux qui les
        ont achetées.
      </div>

      {!ouvert ? (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          style={{
            marginTop: 14,
            padding: "11px 17px",
            border: CADRE,
            borderRadius: 13,
            background: BLANC,
            fontFamily: "inherit",
            fontSize: 13.5,
            fontWeight: 800,
            color: ORANGE,
            cursor: "pointer",
          }}
        >
          Demander l&apos;effacement
        </button>
      ) : (
        <form action={agirDemander} style={{ marginTop: 16, maxWidth: 460 }}>
          <label htmlFor="confirmation" style={etiquette}>
            Recopie ton adresse pour confirmer
          </label>
          <input
            id="confirmation"
            name="confirmation"
            required
            autoComplete="off"
            placeholder={courriel}
            style={champ}
          />

          <label htmlFor="motif" style={{ ...etiquette, marginTop: 12 }}>
            Pourquoi ? (facultatif)
          </label>
          <input
            id="motif"
            name="motif"
            autoComplete="off"
            placeholder="Ce qui t'a décidé — ça nous aide"
            style={champ}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              type="submit"
              disabled={demandeEnCours}
              style={{
                padding: "11px 17px",
                border: CADRE,
                borderRadius: 13,
                background: ORANGE,
                color: BLANC,
                fontFamily: "inherit",
                fontSize: 13.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {demandeEnCours ? "…" : "Confirmer la demande"}
            </button>

            <button
              type="button"
              onClick={() => setOuvert(false)}
              style={{
                padding: "11px 17px",
                border: CADRE,
                borderRadius: 13,
                background: BLANC,
                fontFamily: "inherit",
                fontSize: 13.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Laisser tomber
            </button>
          </div>

          <Message etat={suiteDemande} />
        </form>
      )}
    </div>
  );
}
