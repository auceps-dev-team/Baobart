"use client";

import { useActionState } from "react";

import { enregistrerNumeroAction, envoyerNumeroAction, essaiNumeroAction, type EtatNumero } from "@/lib/infolettre/actions-equipe";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const CADRE = `2.5px solid ${ENCRE}`;

const bouton: React.CSSProperties = { padding: "10px 16px", border: CADRE, borderRadius: 12, fontSize: 13, fontWeight: 800, fontFamily: "inherit", color: ENCRE, cursor: "pointer" };
const saisie: React.CSSProperties = { width: "100%", padding: "10px 12px", border: CADRE, borderRadius: 12, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", background: BLANC, color: ENCRE };

function Retour({ etat }: { etat: EtatNumero | null }) {
  if (!etat) return null;
  return (
    <p role={etat.ok ? "status" : "alert"} style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: etat.ok ? ENCRE : ORANGE }}>
      {etat.message}
    </p>
  );
}

/** Écrire ou corriger un brouillon. */
export function FormulaireNumero({ id, sujet = "", corps = "" }: { id: string | null; sujet?: string; corps?: string }) {
  const [etat, enregistrer, enCours] = useActionState<EtatNumero | null, FormData>(enregistrerNumeroAction.bind(null, id), null);
  return (
    <form action={enregistrer} data-numero-form={id ?? "nouveau"} style={{ display: "grid", gap: 10 }}>
      <input name="sujet" defaultValue={sujet} required placeholder="Objet du courriel" aria-label="Objet" style={saisie} />
      <textarea name="corps" defaultValue={corps} required rows={id ? 6 : 8} placeholder="Le texte de la lettre — en texte brut, sans mise en forme." aria-label="Texte" style={{ ...saisie, resize: "vertical", lineHeight: 1.5 }} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" disabled={enCours} style={{ ...bouton, background: JAUNE }}>
          {enCours ? "Un instant…" : id ? "Enregistrer le brouillon" : "Créer le brouillon"}
        </button>
        <Retour etat={etat} />
      </div>
    </form>
  );
}

/** S'envoyer un essai, puis envoyer à tous — la case est la seconde moitié du geste. */
export function EnvoiNumero({ id, destinataires }: { id: string; destinataires: number }) {
  const [essai, essayer, enEssai] = useActionState<EtatNumero | null, FormData>(async () => essaiNumeroAction(id), null);
  const [envoi, envoyer, enEnvoi] = useActionState<EtatNumero | null, FormData>(envoyerNumeroAction.bind(null, id), null);
  return (
    <div data-envoi={id} style={{ display: "grid", gap: 10, marginTop: 12 }}>
      <form action={essayer} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" disabled={enEssai} style={{ ...bouton, background: BLANC }}>
          {enEssai ? "Un instant…" : "M'envoyer un essai"}
        </button>
        <Retour etat={essai} />
      </form>
      <form action={envoyer} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 700 }}>
          <input type="checkbox" name="confirme" style={{ width: 18, height: 18 }} />
          J&apos;envoie à {destinataires} adresse{destinataires > 1 ? "s" : ""} confirmée{destinataires > 1 ? "s" : ""}
        </label>
        <button type="submit" disabled={enEnvoi} style={{ ...bouton, background: ENCRE, color: BLANC }}>
          {enEnvoi ? "Un instant…" : "Envoyer"}
        </button>
        <Retour etat={envoi} />
      </form>
    </div>
  );
}
