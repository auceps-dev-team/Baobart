"use client";

import { useActionState } from "react";

import {
  enregistrerCompteDeVersement,
  type EtatCompte,
} from "@/lib/payments/actions";
import { RAILS_PROPOSES } from "@/lib/payments/comptes";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE_SOMBRE = "#B34A1F";
const CADRE = `2.5px solid ${ENCRE}`;

/**
 * Où envoyer l'argent.
 *
 * Le formulaire le plus lourd de conséquences du tableau de bord. Il annonce
 * ce qu'il fait avant de le faire — changer de compte n'est pas un réglage
 * anodin, c'est décider où part une paie.
 */
export function CompteDeVersement({
  actuel,
}: {
  actuel: { label: string; apercu: string; provider: string } | null;
}) {
  const [etat, envoyer, enCours] = useActionState<EtatCompte | null, FormData>(
    enregistrerCompteDeVersement,
    null,
  );

  const refus = etat && !etat.ok ? etat : null;
  const saisie = refus?.saisie;

  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 24,
        background: BLANC,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 22,
        maxWidth: 640,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800 }}>Compte de versement</div>

      <p style={{ fontSize: 13.5, fontWeight: 500, opacity: 0.7, margin: "8px 0 0" }}>
        {actuel
          ? `Tes versements partent vers ${actuel.label} ${actuel.apercu}. Enregistrer un nouveau compte remplace celui-ci — les versements déjà partis gardent l'ancien.`
          : "Sans compte enregistré, aucun versement ne peut partir. Ton solde reste acquis en attendant."}
      </p>

      <form
        action={envoyer}
        style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <label style={{ display: "block" }}>
          <span style={ETIQUETTE}>Moyen de versement</span>
          <select
            name="provider"
            defaultValue={saisie?.provider ?? actuel?.provider ?? "wave"}
            style={CHAMP}
          >
            {RAILS_PROPOSES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "block" }}>
          <span style={ETIQUETTE}>Numéro ou identifiant bancaire</span>
          <input
            name="reference"
            // `key` sur la saisie : sans elle, React garde l'ancienne valeur du
            // champ non contrôlé et le refus semblerait n'avoir rien renvoyé.
            key={saisie?.reference ?? "vide"}
            defaultValue={saisie?.reference ?? ""}
            placeholder="+221 77 000 00 01"
            autoComplete="off"
            style={CHAMP}
          />
        </label>

        <label style={{ display: "block" }}>
          <span style={ETIQUETTE}>
            Nom du titulaire{" "}
            <span style={{ opacity: 0.6, fontWeight: 500 }}>
              — requis pour un virement bancaire
            </span>
          </span>
          <input
            name="titulaire"
            key={saisie?.titulaire ?? "vide-t"}
            defaultValue={saisie?.titulaire ?? ""}
            placeholder="Awa Diallo"
            autoComplete="off"
            style={CHAMP}
          />
        </label>

        {refus ? (
          <p
            role="alert"
            style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ORANGE_SOMBRE }}
          >
            {refus.message}
          </p>
        ) : null}

        {etat?.ok ? (
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
            Compte enregistré. Il servira au prochain versement.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={enCours}
          className="sticker-press"
          style={{
            alignSelf: "flex-start",
            padding: "12px 20px",
            border: CADRE,
            borderRadius: 13,
            background: JAUNE,
            boxShadow: `4px 4px 0 ${ENCRE}`,
            fontSize: 13.5,
            fontWeight: 800,
            cursor: enCours ? "wait" : "pointer",
          }}
        >
          {enCours ? "Enregistrement…" : actuel ? "Remplacer le compte" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}

const ETIQUETTE = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 700,
  marginBottom: 6,
} as const;

const CHAMP = {
  width: "100%",
  fontFamily: "Poppins, sans-serif",
  fontSize: 13.5,
  fontWeight: 500,
  padding: "11px 14px",
  border: CADRE,
  borderRadius: 13,
  background: BLANC,
  outline: "none",
} as const;
