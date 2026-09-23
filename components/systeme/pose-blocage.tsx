"use client";

import { useActionState } from "react";

import type { EtatBlocage } from "@/lib/securite/actions-blocklist";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE } from "@/lib/systeme/charte";

/**
 * Le formulaire qui pose un blocage.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI IL EST À PART DU PANNEAU D'OPÉRATIONS
 *
 * `PanneauOperations` agit **sur une ligne existante** : il faut un
 * identifiant pour cliquer. Poser un blocage part de rien — c'est le seul
 * geste de l'administration qui crée sa propre cible.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA DURÉE N'EST PAS UN CHAMP
 *
 * Elle découle du type, et c'est écrit sous le champ plutôt que choisi : six
 * mois pour une adresse, sans échéance pour le reste. Voir
 * `lib/securite/actions-blocklist.ts` pour le raisonnement.
 */

const TYPES: Array<{ code: string; libelle: string; aide: string }> = [
  {
    code: "EMAIL",
    libelle: "Courriel",
    aide: "sans échéance · empêche la connexion et la réinscription",
  },
  {
    code: "IP",
    libelle: "Adresse IP",
    aide: "six mois · une adresse change de mains, un blocage perpétuel finit par atteindre un inconnu",
  },
  {
    code: "PHONE",
    libelle: "Téléphone",
    aide: "sans échéance",
  },
  {
    code: "CARD",
    libelle: "Carte",
    aide: "sans échéance · empreinte de moyen de paiement",
  },
  {
    code: "OBJECT",
    libelle: "Autre",
    aide: "sans échéance · identifiant libre",
  },
];

const champ = {
  width: "100%",
  padding: "10px 12px",
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

export function PoseBlocage({
  peutAgir,
  poser,
}: {
  peutAgir: boolean;
  poser: (
    precedent: EtatBlocage | null,
    donnees: FormData,
  ) => Promise<EtatBlocage>;
}) {
  const [etat, agir, enCours] = useActionState(poser, null);

  if (!peutAgir) {
    return (
      <p style={{ fontSize: 13, opacity: 0.6, margin: 0 }}>
        Consultation seule : poser un blocage demande le pouvoir de conformité.
      </p>
    );
  }

  return (
    <form action={agir} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          gap: 14,
          alignItems: "start",
        }}
      >
        <div>
          <label htmlFor="type" style={etiquette}>
            Quoi
          </label>
          <select id="type" name="type" defaultValue="EMAIL" style={champ}>
            {TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.libelle}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="valeur" style={etiquette}>
            Valeur
          </label>
          <input
            id="valeur"
            name="valeur"
            required
            autoComplete="off"
            placeholder="fraude@example.com"
            style={champ}
          />
        </div>
      </div>

      <div>
        <label htmlFor="raison" style={etiquette}>
          Raison — écrite, et relue dans six mois
        </label>
        <input
          id="raison"
          name="raison"
          required
          minLength={4}
          placeholder="Cartes volées, trois commandes le 14/09"
          style={champ}
        />
      </div>

      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 12,
          opacity: 0.7,
          lineHeight: 1.6,
        }}
      >
        {TYPES.map((t) => (
          <li key={t.code}>
            <strong>{t.libelle}</strong> — {t.aide}
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          type="submit"
          disabled={enCours}
          style={{
            padding: "11px 18px",
            border: CADRE,
            borderRadius: 13,
            background: JAUNE,
            fontFamily: "inherit",
            fontSize: 13.5,
            fontWeight: 800,
            cursor: enCours ? "progress" : "pointer",
          }}
        >
          {enCours ? "Un instant…" : "Bloquer"}
        </button>

        {etat ? (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: etat.ok ? ENCRE : ORANGE,
            }}
          >
            {etat.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
