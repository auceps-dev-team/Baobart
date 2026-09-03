"use client";

import { useActionState, useState } from "react";

import { deposerOffre, type EtatDepot } from "@/lib/jobs/actions";
import { LIBELLE_MODE, LIBELLE_TYPE, MODES, TYPES } from "@/lib/jobs/enums";
import { PAYS } from "@/lib/payments/rails";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Le formulaire de dépôt d'une offre.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL NE VALIDE RIEN
 *
 * Les contraintes réelles vivent dans `lib/jobs/validation.ts`, qui est pur et
 * éprouvé. Ce qu'on met ici — `required`, `minLength` — n'est qu'un confort :
 * un formulaire se contourne, et la seule barrière est côté serveur.
 *
 * Le mettre quand même évite un aller-retour pour une faute évidente. Mais rien
 * de ce qui compte n'en dépend.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA SAISIE REVIENT AVEC LE REFUS
 *
 * React vide les champs non contrôlés à la fin d'une action serveur. Refaire
 * écrire une description de deux mille signes pour une date mal tapée fait
 * partir l'annonceur — l'action renvoie donc ce qu'elle a reçu, et chaque champ
 * repart de là.
 */
export function FormulaireOffre() {
  const [etat, envoyer, enCours] = useActionState<EtatDepot | null, FormData>(
    deposerOffre,
    null,
  );

  const saisie = etat && !etat.ok ? etat.saisie : null;

  // Le mode de candidature décide de l'affichage du champ d'adresse. Contrôlé
  // parce que c'est le seul champ dont la présence dépend d'un autre.
  const [externe, setExterne] = useState(
    saisie?.commentPostuler === "EXTERNE",
  );

  if (etat?.ok) {
    return (
      <div
        style={{
          border: CADRE,
          borderRadius: 24,
          background: VERT,
          boxShadow: `6px 6px 0 ${ENCRE}`,
          padding: 28,
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, textTransform: "uppercase" }}>
          Ton offre est partie en relecture
        </div>
        <p style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.55, marginTop: 10 }}>
          Elle paraîtra dès qu&apos;elle aura été lue — compte un jour ou deux.
          Inutile de la redéposer : elle est déjà dans la file.
        </p>
      </div>
    );
  }

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

      <Champ label="Intitulé du poste" pour="titre">
        <input
          id="titre"
          name="titre"
          required
          minLength={6}
          maxLength={120}
          defaultValue={saisie?.titre ?? ""}
          placeholder="Illustrateur·rice pour une collection jeunesse"
          style={entree}
        />
      </Champ>

      <Champ
        label="La mission"
        pour="description"
        aide="Missions, profil recherché, conditions. Une offre trop courte est refusée : elle est inexploitable pour un candidat."
      >
        <textarea
          id="description"
          name="description"
          required
          minLength={60}
          maxLength={8000}
          rows={9}
          defaultValue={saisie?.description ?? ""}
          style={{ ...entree, resize: "vertical" }}
        />
      </Champ>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
        <Champ label="Type de contrat" pour="type">
          <select id="type" name="type" defaultValue={saisie?.type ?? "FREELANCE"} style={entree}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {LIBELLE_TYPE[t]}
              </option>
            ))}
          </select>
        </Champ>

        <Champ label="Mode de travail" pour="mode">
          <select id="mode" name="mode" defaultValue={saisie?.mode ?? "REMOTE"} style={entree}>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {LIBELLE_MODE[m]}
              </option>
            ))}
          </select>
        </Champ>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
        <Champ label="Pays" pour="pays">
          <select id="pays" name="pays" defaultValue={saisie?.pays ?? ""} style={entree}>
            <option value="">Non précisé</option>
            {PAYS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </Champ>

        <Champ label="Ville" pour="ville">
          <input
            id="ville"
            name="ville"
            maxLength={80}
            defaultValue={saisie?.ville ?? ""}
            placeholder="Abidjan"
            style={entree}
          />
        </Champ>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
        <Champ label="Budget minimum" pour="salaireMin" aide="En francs CFA. Facultatif.">
          <input
            id="salaireMin"
            name="salaireMin"
            inputMode="numeric"
            defaultValue={saisie?.salaireMin ?? ""}
            placeholder="300000"
            style={entree}
          />
        </Champ>

        <Champ label="Budget maximum" pour="salaireMax">
          <input
            id="salaireMax"
            name="salaireMax"
            inputMode="numeric"
            defaultValue={saisie?.salaireMax ?? ""}
            placeholder="500000"
            style={entree}
          />
        </Champ>
      </div>

      <Champ
        label="Clôture des candidatures"
        pour="echeance"
        aide="Le jour choisi compte encore. Passé cette date, l'offre disparaît d'elle-même."
      >
        <input
          id="echeance"
          name="echeance"
          type="date"
          defaultValue={saisie?.echeance ?? ""}
          style={entree}
        />
      </Champ>

      {/* ── Où postuler ────────────────────────────────────────────────── */}
      <fieldset style={{ border: CADRE, borderRadius: 18, padding: 16, margin: 0 }}>
        <legend
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: ".12em",
            opacity: 0.6,
            padding: "0 6px",
          }}
        >
          Où les candidats postulent
        </legend>

        <label style={choix}>
          <input
            type="radio"
            name="commentPostuler"
            value="BAOBART"
            defaultChecked={!externe}
            onChange={() => setExterne(false)}
          />
          <span>
            <strong>Sur Baobart.</strong> Les candidatures te parviennent ici.
          </span>
        </label>

        <label style={choix}>
          <input
            type="radio"
            name="commentPostuler"
            value="EXTERNE"
            defaultChecked={externe}
            onChange={() => setExterne(true)}
          />
          <span>
            <strong>Sur mon site.</strong> On y renvoie les candidats.
          </span>
        </label>

        {externe ? (
          <div style={{ marginTop: 14 }}>
            <Champ
              label="Adresse de candidature"
              pour="urlExterne"
              aide="En https, et pas une adresse Baobart. Un candidat y enverra ses informations."
            >
              <input
                id="urlExterne"
                name="urlExterne"
                type="url"
                defaultValue={saisie?.urlExterne ?? ""}
                placeholder="https://ton-site.africa/emplois/42"
                style={entree}
              />
            </Champ>
          </div>
        ) : (
          <input type="hidden" name="urlExterne" value="" />
        )}
      </fieldset>

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
        {enCours ? "Envoi…" : "Envoyer en relecture"}
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

const choix = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  fontSize: 13.5,
  fontWeight: 600,
  lineHeight: 1.5,
  marginTop: 8,
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
