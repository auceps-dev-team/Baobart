"use client";

import { useState, useTransition } from "react";

import { ajouterLienExterne } from "@/lib/upload/actions";
import { NOM_MAX, LIEN_MAX, verifierLienExterne } from "@/lib/products/lien-externe";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE_SOMBRE = "#B34A1F";
const CADRE = `2.5px solid ${ENCRE}`;

export interface LienAjoute {
  id: string;
  nom: string;
  taille: null;
  externe: string;
}

/**
 * Attacher un fichier hébergé ailleurs — Drive, Dropbox, un site.
 *
 * Aucune maquette ne prévoit cet écran (cherché le 15/10/2026 dans
 * `Baobart Design/` : « lien externe », « externe », « Drive », « Dropbox »,
 * « URL du fichier », « héberg », « lien de téléchargement »). Il reprend donc
 * les pièces de la zone de dépôt juste au-dessus : cadre, encre, jaune.
 *
 * Replié par défaut : la plupart des créateurs déposent leur fichier, et ce
 * choix-là a une conséquence qu'il faut lire avant de le faire.
 */
export function LienExterne({
  produitId,
  onAjoute,
}: {
  produitId: string;
  onAjoute: (fichier: LienAjoute) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [url, setUrl] = useState("");
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, demarrer] = useTransition();

  function ajouter() {
    setErreur(null);
    // Premier filtre ici, pour répondre tout de suite. Le serveur refait le
    // même contrôle : il ne croit pas le navigateur.
    const verdict = verifierLienExterne(url);
    if (!verdict.ok) {
      setErreur(verdict.message);
      return;
    }

    demarrer(async () => {
      const reponse = await ajouterLienExterne(produitId, { url, nom });
      if (!reponse.ok) {
        setErreur(reponse.message);
        return;
      }
      onAjoute(reponse.fichier);
      setUrl("");
      setNom("");
      setOuvert(false);
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        style={{
          marginTop: 12,
          padding: 0,
          border: "none",
          background: "none",
          fontSize: 13,
          fontWeight: 700,
          textDecoration: "underline",
          cursor: "pointer",
          color: ENCRE,
        }}
      >
        Ton fichier est déjà en ligne ? Ajoute un lien externe
      </button>
    );
  }

  const champ = {
    width: "100%",
    padding: "11px 12px",
    border: CADRE,
    borderRadius: 12,
    background: BLANC,
    fontSize: 13.5,
    boxSizing: "border-box" as const,
  };

  return (
    <div
      data-lien-externe
      style={{
        marginTop: 14,
        border: CADRE,
        borderRadius: 16,
        background: BLANC,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>Lien externe</div>

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}>
        L&apos;acheteur reçoit ce lien après paiement, à la place d&apos;un fichier
        hébergé chez nous. <strong>Il ne s&apos;éteint pas</strong> : qui l&apos;a reçu peut le
        transmettre. Ta fiche indiquera où le fichier est hébergé, et c&apos;est à toi
        de le garder en ligne : un acheteur dont le lien ne mène plus nulle part
        peut demander à être remboursé.
      </p>

      <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 700 }}>
        Adresse du fichier
        <input
          type="url"
          inputMode="url"
          placeholder="https://drive.google.com/…"
          value={url}
          maxLength={LIEN_MAX}
          onChange={(e) => setUrl(e.target.value)}
          style={champ}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 700 }}>
        Nom affiché à l&apos;acheteur <span style={{ fontWeight: 500, opacity: 0.65 }}>(facultatif)</span>
        <input
          type="text"
          placeholder="Pack complet.zip"
          value={nom}
          maxLength={NOM_MAX}
          onChange={(e) => setNom(e.target.value)}
          style={champ}
        />
      </label>

      {erreur ? (
        <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ORANGE_SOMBRE }}>
          {erreur}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={ajouter}
          disabled={envoi}
          className="sticker-press"
          style={{
            padding: "10px 18px",
            border: CADRE,
            borderRadius: 12,
            background: JAUNE,
            boxShadow: `3px 3px 0 ${ENCRE}`,
            fontSize: 13,
            fontWeight: 800,
            cursor: envoi ? "wait" : "pointer",
          }}
        >
          {envoi ? "Ajout…" : "Ajouter le lien"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            setErreur(null);
          }}
          style={{
            padding: "10px 18px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 12,
            background: BLANC,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
