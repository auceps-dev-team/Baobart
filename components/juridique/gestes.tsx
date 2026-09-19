"use client";

import { useState, useTransition } from "react";

import {
  retirerLeContenu,
  trancherLeDossier,
  type EtatGeste,
} from "@/lib/juridique/actions";
import { BLANC, CADRE, ENCRE, GRIS, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Trancher un dossier juridique.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS ISSUES, ET AUCUNE NE S'APPELLE « SUPPRIMER »
 *
 * « Retrait définitif » veut dire que le contenu ne revient pas. « Remise en
 * ligne » qu'il revient. « Classement sans suite » que la notification
 * n'appelait pas de décision — abandonnée, hors sujet, ou visant un contenu
 * qui n'existe plus.
 *
 * Le mot « supprimer » est absent exprès : Baobart ne juge pas qui a raison,
 * elle décide si le contenu reste en ligne. Le litige relève du tribunal, et
 * l'article 52 lui donne le pouvoir de prescrire toute mesure.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MOTIF SE SAISIT AVANT LE CLIC
 *
 * Même règle que la fermeture d'une communauté, prise de `a_membres_risque` :
 * « Chaque geste exige un motif écrit avant validation. » Un motif demandé
 * après coup se remplit de « ok ». Demandé avant, il oblige à formuler la
 * décision — et c'est cette formulation qu'on relira.
 *
 * Le serveur le réexige de toute façon : `trancher` refuse en dessous de huit
 * caractères.
 */

const BOUTON: React.CSSProperties = {
  padding: "10px 18px",
  border: CADRE,
  borderRadius: 13,
  fontSize: 13.5,
  fontWeight: 800,
  cursor: "pointer",
};

export function RetirerProvisoirement({ reference }: { reference: string }) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={enCours}
        onClick={() => {
          setErreur(null);
          demarrer(async () => {
            const suite = await retirerLeContenu(reference);
            if (!suite.ok) setErreur(suite.message);
          });
        }}
        className="sticker-press"
        style={{ ...BOUTON, background: enCours ? GRIS : ENCRE, color: BLANC }}
      >
        {enCours ? "…" : "Retirer à titre provisoire"}
      </button>

      {erreur ? <Erreur>{erreur}</Erreur> : null}
    </div>
  );
}

export function Trancher({ reference }: { reference: string }) {
  const [enCours, demarrer] = useTransition();
  const [ouvert, setOuvert] = useState<null | "RETIREE" | "RESTAUREE" | "CLASSEE">(null);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const agir = () => {
    if (!ouvert) return;
    setErreur(null);
    demarrer(async () => {
      const suite: EtatGeste = await trancherLeDossier(reference, ouvert, motif);
      if (suite.ok) {
        setOuvert(null);
        setMotif("");
      } else {
        setErreur(suite.message);
      }
    });
  };

  if (!ouvert) {
    return (
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setOuvert("RETIREE")}
          className="sticker-press"
          style={{ ...BOUTON, background: ORANGE }}
        >
          Retrait définitif
        </button>
        <button
          type="button"
          onClick={() => setOuvert("RESTAUREE")}
          className="sticker-press"
          style={{ ...BOUTON, background: VERT }}
        >
          Remettre en ligne
        </button>
        <button
          type="button"
          onClick={() => setOuvert("CLASSEE")}
          className="sticker-press"
          style={{ ...BOUTON, background: BLANC }}
        >
          Classer sans suite
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 300 }}>
      <label style={{ display: "grid", gap: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>
          Pourquoi {LIBELLE[ouvert]} — dossier {reference} ?
        </span>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Ce motif reste au dossier et au journal."
          style={{
            width: "100%",
            padding: "10px 12px",
            border: CADRE,
            borderRadius: 11,
            background: BLANC,
            fontSize: 14,
            fontFamily: "inherit",
          }}
        />
      </label>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={enCours}
          onClick={agir}
          className="sticker-press"
          style={{ ...BOUTON, background: enCours ? GRIS : ENCRE, color: BLANC }}
        >
          {enCours ? "…" : "Confirmer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOuvert(null);
            setErreur(null);
          }}
          style={{ ...BOUTON, background: BLANC }}
        >
          Annuler
        </button>
      </div>

      {erreur ? <Erreur>{erreur}</Erreur> : null}
    </div>
  );
}

const LIBELLE: Record<"RETIREE" | "RESTAUREE" | "CLASSEE", string> = {
  RETIREE: "retirer définitivement",
  RESTAUREE: "remettre en ligne",
  CLASSEE: "classer sans suite",
};

function Erreur({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: ORANGE }}>
      {children}
    </p>
  );
}
