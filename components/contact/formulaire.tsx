"use client";

import { useActionState } from "react";

import { ChampsAntiBot } from "@/components/auth/champs-antibot";
import { envoyerMessage, type EtatEnvoi } from "@/lib/contact/actions";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

const LAVANDE_CLAIR = "#F4EEFC";

/**
 * Le formulaire de Contact et de Sponsoriser : celui de la maquette (Nom,
 * Email, Sujet — ou Budget indicatif), avec enfin un message et un envoi.
 *
 * Les sujets arrivent en propriété : la liste vit dans `lib/contact/regles.ts`,
 * qui importe un module serveur.
 */
export function FormulaireContact({
  genre,
  sujets,
  depart,
}: {
  genre: "CONTACT" | "SPONSOR";
  sujets: readonly string[];
  depart: { nom: string; email: string };
}) {
  const [etat, envoyer, enCours] = useActionState<EtatEnvoi | null, FormData>(envoyerMessage.bind(null, genre), null);
  const v = etat && !etat.ok ? etat.saisie : { ...depart, sujet: "", corps: "", budget: "" };
  const faute = etat && !etat.ok ? etat.champ : undefined;

  if (etat?.ok) {
    return (
      <div role="status" data-contact-envoye style={{ ...bandeau, background: VERT }}>
        Message reçu. L&apos;équipe te répond à l&apos;adresse que tu as donnée.
      </div>
    );
  }

  return (
    <form action={envoyer} data-contact={genre} style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12, position: "relative" }}>
      <ChampsAntiBot />
      {etat && !etat.ok ? (
        <div role="alert" style={{ ...bandeau, gridColumn: "1 / -1", background: ORANGE, color: BLANC }}>
          {etat.message}
        </div>
      ) : null}

      <input name="nom" defaultValue={v.nom} required aria-label={genre === "SPONSOR" ? "Nom / société" : "Nom"} placeholder={genre === "SPONSOR" ? "Nom / société" : "Nom"} style={saisie(faute === "nom")} />
      <input name="email" type="email" defaultValue={v.email} required aria-label="Email" placeholder="Email" style={saisie(faute === "email")} />

      {genre === "SPONSOR" ? (
        <input name="budget" defaultValue={v.budget} aria-label="Budget indicatif" placeholder="Budget indicatif (facultatif)" style={{ ...saisie(faute === "budget"), gridColumn: "1 / -1" }} />
      ) : (
        <select name="sujet" defaultValue={v.sujet} required aria-label="Sujet" style={{ ...saisie(faute === "sujet"), gridColumn: "1 / -1" }}>
          <option value="" disabled>
            Sujet
          </option>
          {sujets.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}

      <textarea
        name="corps"
        defaultValue={v.corps}
        required
        rows={5}
        aria-label="Message"
        placeholder={genre === "SPONSOR" ? "Ce que tu veux mettre en avant, et quand." : "Ton message — avec le numéro de commande s'il s'agit d'un achat."}
        style={{ ...saisie(faute === "corps"), gridColumn: "1 / -1", resize: "vertical", lineHeight: 1.5 }}
      />

      <button type="submit" disabled={enCours} className="sticker-press" style={{ gridColumn: "1 / -1", padding: 14, border: CADRE, borderRadius: 14, background: JAUNE, color: ENCRE, fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>
        {enCours ? "Un instant…" : genre === "SPONSOR" ? "Envoyer la demande" : "Envoyer le message"}
      </button>
    </form>
  );
}

const bandeau: React.CSSProperties = {
  padding: "12px 15px",
  border: CADRE,
  borderRadius: 14,
  color: ENCRE,
  fontSize: 13.5,
  fontWeight: 700,
};

function saisie(faute: boolean): React.CSSProperties {
  return {
    minWidth: 0,
    width: "100%",
    fontFamily: "inherit",
    fontSize: 13.5,
    fontWeight: 500,
    padding: "12px 14px",
    border: faute ? `2.5px solid ${ORANGE}` : CADRE,
    borderRadius: 13,
    background: LAVANDE_CLAIR,
    color: ENCRE,
    outline: "none",
  };
}
