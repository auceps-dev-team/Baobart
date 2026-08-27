"use client";

import { useActionState } from "react";

import {
  basculerAccesVente,
  rembourserVente,
  type EtatVente,
} from "@/lib/ventes/actions";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const ORANGE_SOMBRE = "#B34A1F";
const CADRE = `2.5px solid ${ENCRE}`;

export interface VenteAffichee {
  id: string;
  ressource: string;
  acheteur: string;
  date: string;
  /** Déjà formaté : la ligne n'a pas à recalculer un montant. */
  montant: string;
  restant: number;
  restantLisible: string;
  etat: string;
  /** Teinte de la ligne : la couleur porte l'état, pas le texte seul. */
  fond: string;
  remboursable: boolean;
  accesRetire: boolean;
  litige: boolean;
}

/**
 * Une vente, et ce que le vendeur peut en faire.
 *
 * Les deux gestes sont séparés à dessein : rembourser rend l'argent sans
 * reprendre le fichier, retirer l'accès reprend le fichier sans rendre
 * l'argent. Les réunir sous un seul bouton obligerait à choisir entre punir et
 * rembourser.
 */
export function LigneVente({ vente }: { vente: VenteAffichee }) {
  const rembourser = rembourserVente.bind(null, vente.id);
  const [etat, envoyer, enCours] = useActionState<EtatVente | null, FormData>(
    rembourser,
    null,
  );

  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 16,
        background: vente.fond,
        padding: 15,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline" }}
      >
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800 }}>{vente.ressource}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.72, marginTop: 2 }}>
            {vente.acheteur} · {vente.date}
          </div>
        </div>

        <span
          style={{
            padding: "5px 11px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 999,
            background: BLANC,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {vente.etat}
        </span>

        <strong style={{ fontSize: 14 }}>{vente.montant}</strong>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {vente.remboursable ? (
          <form
            action={envoyer}
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              <span style={{ opacity: 0.7 }}>Rembourser </span>
              <input
                name="montant"
                inputMode="numeric"
                defaultValue={String(vente.restant)}
                aria-label={`Montant à rembourser, au plus ${vente.restantLisible}`}
                style={{
                  width: 92,
                  padding: "7px 9px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 10,
                  background: BLANC,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12.5,
                }}
              />
            </label>
            <button
              type="submit"
              className="sticker-press"
              disabled={enCours}
              style={{
                padding: "8px 14px",
                border: `2px solid ${ENCRE}`,
                borderRadius: 10,
                background: JAUNE,
                fontSize: 12,
                fontWeight: 800,
                cursor: enCours ? "wait" : "pointer",
                opacity: enCours ? 0.6 : 1,
              }}
            >
              {enCours ? "En cours…" : "Rembourser"}
            </button>
          </form>
        ) : null}

        {/*
          Le retrait d'accès reste possible sur une vente déjà remboursée : on
          peut avoir remboursé par geste commercial et vouloir quand même
          reprendre le fichier.
        */}
        {vente.litige ? null : (
          <form action={basculerAccesVente.bind(null, vente.id, !vente.accesRetire)}>
            <button
              type="submit"
              style={{
                padding: "8px 14px",
                border: `2px solid ${ENCRE}`,
                borderRadius: 10,
                background: BLANC,
                fontSize: 12,
                fontWeight: 800,
                color: vente.accesRetire ? ENCRE : ORANGE_SOMBRE,
                cursor: "pointer",
              }}
            >
              {vente.accesRetire ? "Rendre l'accès" : "Retirer l'accès"}
            </button>
          </form>
        )}
      </div>

      {etat ? (
        <p
          role={etat.ok ? "status" : "alert"}
          style={{
            margin: 0,
            fontSize: 12.5,
            fontWeight: 700,
            color: etat.ok ? ENCRE : ORANGE_SOMBRE,
          }}
        >
          {etat.message}
        </p>
      ) : null}

      {vente.litige ? (
        <p
          style={{
            margin: 0,
            padding: "9px 12px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 11,
            background: ORANGE,
            color: BLANC,
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          Paiement contesté auprès de la banque. L&apos;argent a été repris et
          tes versements sont suspendus le temps que la contestation soit
          tranchée.
        </p>
      ) : null}
    </div>
  );
}
