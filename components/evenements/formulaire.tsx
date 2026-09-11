"use client";

import { useActionState, useState } from "react";

import {
  creerEvenement,
  modifierEvenement,
  type EtatFormulaire,
} from "@/lib/evenements/actions";
import { GENRES, LIBELLE_GENRE } from "@/lib/evenements/enums";
import type { Saisie } from "@/lib/evenements/validation";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Le formulaire d'un événement — création et correction.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL NE VALIDE RIEN
 *
 * `lib/evenements/validation.ts` est autorité. `required`, `min`, `max` ici ne
 * sont qu'un confort — un formulaire se contourne, la seule barrière est côté
 * serveur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE LIEU DÉPEND DE « EN LIGNE », DONC IL EST CONTRÔLÉ
 *
 * C'est le seul champ dont la présence dépend d'un autre. Le laisser visible
 * sur un événement en ligne ferait saisir une adresse que la validation
 * efface — un travail demandé puis jeté sans le dire.
 */
export function FormulaireEvenement({
  evenementId,
  depart,
}: {
  /** Absent en création. Présent, il bascule le formulaire en correction. */
  evenementId?: string;
  /** Valeurs de départ, en édition. */
  depart?: Saisie;
}) {
  const action = evenementId
    ? modifierEvenement.bind(null, evenementId)
    : creerEvenement;

  const [etat, envoyer, enCours] = useActionState<EtatFormulaire | null, FormData>(
    action,
    null,
  );

  // Après un refus, on repart de ce que la personne avait écrit. Sinon des
  // valeurs de départ, s'il y en a.
  const v = etat && !etat.ok ? etat.saisie : depart;

  const [enLigne, setEnLigne] = useState(
    v?.enLigne === "on" || v?.enLigne === "true",
  );

  const refus = etat && !etat.ok ? etat : null;

  return (
    <form
      action={envoyer}
      style={{
        border: CADRE,
        borderRadius: 24,
        background: BLANC,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {refus ? (
        <div
          role="alert"
          style={{
            padding: "12px 15px",
            border: CADRE,
            borderRadius: 14,
            background: ORANGE,
            color: BLANC,
            fontSize: 13.5,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {refus.message}
        </div>
      ) : null}

      {etat?.ok ? (
        <div
          role="status"
          style={{
            padding: "12px 15px",
            border: CADRE,
            borderRadius: 14,
            background: VERT,
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          Modifications enregistrées.
        </div>
      ) : null}

      <Champ label="Titre" pour="titre">
        <input
          id="titre"
          name="titre"
          required
          minLength={6}
          maxLength={120}
          defaultValue={v?.titre ?? ""}
          placeholder="Atelier sérigraphie sur wax"
          style={entree}
        />
      </Champ>

      <Champ
        label="Description"
        pour="description"
        aide="Ce qui s'y passe, pour qui, ce qu'il faut prévoir. Une description trop courte est refusée : personne ne s'inscrit à une ligne."
      >
        <textarea
          id="description"
          name="description"
          required
          minLength={60}
          maxLength={8000}
          rows={8}
          defaultValue={v?.description ?? ""}
          style={{ ...entree, resize: "vertical" }}
        />
      </Champ>

      <Champ label="Type" pour="genre">
        <select id="genre" name="genre" defaultValue={v?.genre ?? "WORKSHOP"} style={entree}>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {LIBELLE_GENRE[g]}
            </option>
          ))}
        </select>
      </Champ>

      <div style={grille}>
        <Champ label="Début" pour="debut" aide="Heure d'Abidjan (GMT).">
          <input
            id="debut"
            name="debut"
            type="datetime-local"
            required
            defaultValue={v?.debut ?? ""}
            style={entree}
          />
        </Champ>

        <Champ label="Fin" pour="fin">
          <input
            id="fin"
            name="fin"
            type="datetime-local"
            required
            defaultValue={v?.fin ?? ""}
            style={entree}
          />
        </Champ>
      </div>

      <div>
        <label style={choix}>
          <input
            type="checkbox"
            name="enLigne"
            checked={enLigne}
            onChange={(e) => setEnLigne(e.target.checked)}
          />
          <span>
            Événement en ligne
            <span style={{ display: "block", fontWeight: 500, opacity: 0.7, fontSize: 12.5 }}>
              Le lien de connexion se communique aux inscrits — il n&apos;est pas
              public.
            </span>
          </span>
        </label>
      </div>

      {enLigne ? null : (
        <Champ label="Lieu" pour="lieu" aide="L'adresse à laquelle on se présente.">
          <input
            id="lieu"
            name="lieu"
            maxLength={160}
            defaultValue={v?.lieu ?? ""}
            placeholder="Abidjan, Cocody — Institut français"
            style={entree}
          />
        </Champ>
      )}

      <div style={grille}>
        <Champ
          label="Places"
          pour="capacite"
          aide="Laisse vide pour ne pas plafonner."
        >
          <input
            id="capacite"
            name="capacite"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={v?.capacite ?? ""}
            placeholder="12"
            style={entree}
          />
        </Champ>

        <Champ
          label="Prix du billet (F CFA)"
          pour="prixBillet"
          aide="Vide ou 0 = gratuit."
        >
          <input
            id="prixBillet"
            name="prixBillet"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={v?.prixBillet ?? ""}
            placeholder="0"
            style={entree}
          />
        </Champ>

        <Champ
          label="Dotation (F CFA)"
          pour="dotation"
          aide="Pour un concours. Vide sinon."
        >
          <input
            id="dotation"
            name="dotation"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={v?.dotation ?? ""}
            placeholder="250000"
            style={entree}
          />
        </Champ>
      </div>

      <button
        type="submit"
        disabled={enCours}
        className="sticker-press"
        style={{
          padding: "15px 26px",
          border: CADRE,
          borderRadius: 15,
          background: JAUNE,
          boxShadow: `5px 5px 0 ${ENCRE}`,
          fontSize: 15,
          fontWeight: 800,
          cursor: enCours ? "wait" : "pointer",
          fontFamily: "inherit",
          color: ENCRE,
        }}
      >
        {enCours
          ? "Enregistrement…"
          : evenementId
            ? "Enregistrer les modifications"
            : "Créer le brouillon"}
      </button>
    </form>
  );
}

const entree = {
  width: "100%",
  padding: "13px 15px",
  border: CADRE,
  borderRadius: 14,
  background: "#F4EEFC",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 500,
  outline: "none",
  color: ENCRE,
} as const;

const grille = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 14,
} as const;

const choix = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  fontSize: 13.5,
  fontWeight: 700,
  lineHeight: 1.5,
  cursor: "pointer",
} as const;

function Champ({
  label,
  pour,
  aide,
  children,
}: {
  label: string;
  pour: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={pour}
        style={{
          display: "block",
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".12em",
          opacity: 0.6,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
      {aide ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.45,
            marginTop: 6,
            opacity: 0.7,
            textWrap: "pretty",
          }}
        >
          {aide}
        </div>
      ) : null}
    </div>
  );
}
