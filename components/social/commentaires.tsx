"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import {
  publierCommentaire,
  retirerCommentaire,
  type ReponseCommentaire,
} from "@/lib/social/actions";
import { COMMENTAIRE_MAX, COMMENTAIRE_RETIRE, ilYA } from "@/lib/social/regles";
import type { CommentaireRendu } from "@/lib/social/queries";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const LAVANDE_CLAIR = "#F4EEFC";
const ORANGE_SOMBRE = "#B34A1F";
const CADRE = `2.5px solid ${ENCRE}`;

/**
 * Le fil de commentaires, traduit du bloc « DÉTAIL RESSOURCE » de la maquette :
 * pastille ronde, bulle à coin supérieur gauche carré, champ et bouton
 * « Publier ».
 */
export function Commentaires({
  produitId,
  commentaires,
  total,
  connecte,
}: {
  produitId: string;
  commentaires: CommentaireRendu[];
  total: number;
  connecte: boolean;
}) {
  const [repondreA, setRepondreA] = useState<string | null>(null);

  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 20,
        background: BLANC,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800 }}>Commentaires ({total})</div>

      {commentaires.length === 0 ? (
        <p
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            opacity: 0.7,
            margin: "12px 0 0",
          }}
        >
          Personne n&apos;a encore réagi. Ouvre la discussion.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 14,
          }}
        >
          {commentaires.map((c) => (
            <Fil
              key={c.id}
              commentaire={c}
              produitId={produitId}
              connecte={connecte}
              repondreA={repondreA}
              setRepondreA={setRepondreA}
            />
          ))}
        </div>
      )}

      {repondreA === null ? (
        <Formulaire produitId={produitId} connecte={connecte} />
      ) : null}
    </div>
  );
}

function Fil({
  commentaire,
  produitId,
  connecte,
  repondreA,
  setRepondreA,
}: {
  commentaire: CommentaireRendu;
  produitId: string;
  connecte: boolean;
  repondreA: string | null;
  setRepondreA: (id: string | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Bulle
        commentaire={commentaire}
        connecte={connecte}
        onRepondre={() => setRepondreA(commentaire.id)}
      />

      {commentaire.reponses.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginLeft: 44,
          }}
        >
          {commentaire.reponses.map((r) => (
            <Bulle key={r.id} commentaire={r} connecte={connecte} />
          ))}
        </div>
      ) : null}

      {repondreA === commentaire.id ? (
        <div style={{ marginLeft: 44 }}>
          <Formulaire
            produitId={produitId}
            connecte={connecte}
            parentId={commentaire.id}
            onAnnuler={() => setRepondreA(null)}
          />
        </div>
      ) : null}
    </div>
  );
}

function Bulle({
  commentaire,
  connecte,
  onRepondre,
}: {
  commentaire: CommentaireRendu;
  connecte: boolean;
  onRepondre?: () => void;
}) {
  const [retrait, demarrerRetrait] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const routeur = useRouter();

  function retirer() {
    setErreur(null);
    demarrerRetrait(async () => {
      const r = await retirerCommentaire(commentaire.id);
      if (!r.ok) setErreur(r.message ?? "Retrait impossible.");
      else routeur.refresh();
    });
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span
        style={{
          width: 32,
          height: 32,
          flex: "0 0 auto",
          border: CADRE,
          borderRadius: 99,
          background: pastilleDe(commentaire.auteurId),
        }}
      />

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            border: CADRE,
            borderRadius: 14,
            borderTopLeftRadius: 4,
            background: LAVANDE_CLAIR,
            padding: "9px 13px",
            opacity: commentaire.retire ? 0.55 : 1,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800 }}>
            {commentaire.auteur}{" "}
            <span style={{ fontWeight: 600, opacity: 0.55 }}>
              {ilYA(commentaire.publieLe)}
            </span>
            {/* Visible du seul créateur : dire publiquement « signalé »
                accuserait son auteur sur la foi d'une liste de mots. */}
            {commentaire.signale ? (
              <span
                title="Repéré par la détection automatique. À toi de juger."
                style={{
                  marginLeft: 8,
                  padding: "1px 7px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 999,
                  background: JAUNE,
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 9.5,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                signalé
              </span>
            ) : null}
          </div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: commentaire.retire ? 400 : 500,
              fontStyle: commentaire.retire ? "italic" : undefined,
              lineHeight: 1.4,
              marginTop: 2,
              whiteSpace: "pre-wrap",
            }}
          >
            {commentaire.retire ? COMMENTAIRE_RETIRE : commentaire.corps}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
          {onRepondre && connecte && !commentaire.retire ? (
            <button
              type="button"
              onClick={onRepondre}
              style={LIEN}
            >
              Répondre
            </button>
          ) : null}

          {commentaire.retirable ? (
            <button
              type="button"
              onClick={retirer}
              disabled={retrait}
              style={{ ...LIEN, color: ORANGE_SOMBRE }}
            >
              Retirer
            </button>
          ) : null}
        </div>

        {erreur ? (
          <p
            role="alert"
            style={{
              margin: "4px 0 0",
              fontSize: 11.5,
              fontWeight: 700,
              color: ORANGE_SOMBRE,
            }}
          >
            {erreur}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const LIEN = {
  border: "none",
  background: "none",
  padding: 0,
  fontFamily: "'Space Mono', monospace",
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.7,
  cursor: "pointer",
} as const;

function Formulaire({
  produitId,
  connecte,
  parentId,
  onAnnuler,
}: {
  produitId: string;
  connecte: boolean;
  parentId?: string;
  onAnnuler?: () => void;
}) {
  const action = publierCommentaire.bind(null, produitId);
  const [etat, envoyer, enCours] = useActionState<ReponseCommentaire | null, FormData>(
    action,
    null,
  );
  const routeur = useRouter();

  const refus = etat && !etat.ok ? etat : null;
  const publie = etat?.ok === true;

  // Le fil est rendu par le serveur : c'est lui qui doit livrer la nouvelle
  // bulle, avec son identifiant et son horodatage. Dans un effet, pas pendant
  // le rendu — un rafraîchissement est un effet de bord. Déclaré avant tout
  // retour anticipé : un hook conditionnel casserait l'ordre des appels.
  useEffect(() => {
    if (publie) {
      routeur.refresh();
      onAnnuler?.();
    }
  }, [publie, routeur, onAnnuler]);

  if (!connecte) {
    return (
      <p style={{ fontSize: 13, fontWeight: 700, marginTop: 14 }}>
        <a href="/connexion" style={{ textDecoration: "underline" }}>
          Connecte-toi
        </a>{" "}
        pour commenter.
      </p>
    );
  }

  return (
    <form action={envoyer} style={{ marginTop: 14 }}>
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}

      <div style={{ display: "flex", gap: 10 }}>
        <input
          name="corps"
          maxLength={COMMENTAIRE_MAX}
          placeholder={parentId ? "Répondre…" : "Ajouter un commentaire…"}
          // `key` sur la saisie : sans elle, React garde l'ancienne valeur du
          // champ non contrôlé et le refus semblerait n'avoir rien renvoyé.
          key={refus?.saisie ?? "vide"}
          defaultValue={refus?.saisie ?? ""}
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            fontFamily: "Poppins, sans-serif",
            fontSize: 13.5,
            fontWeight: 500,
            padding: "11px 14px",
            border: CADRE,
            borderRadius: 13,
            outline: "none",
          }}
        />

        <button
          type="submit"
          disabled={enCours}
          className="sticker-press"
          style={{
            padding: "11px 18px",
            border: CADRE,
            borderRadius: 13,
            background: JAUNE,
            fontSize: 13,
            fontWeight: 800,
            cursor: enCours ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {enCours ? "…" : "Publier"}
        </button>

        {onAnnuler ? (
          <button type="button" onClick={onAnnuler} style={{ ...LIEN, opacity: 0.6 }}>
            Annuler
          </button>
        ) : null}
      </div>

      {refus ? (
        <p
          role="alert"
          style={{
            margin: "8px 0 0",
            fontSize: 12.5,
            fontWeight: 700,
            color: ORANGE_SOMBRE,
          }}
        >
          {refus.message}
        </p>
      ) : null}
    </form>
  );
}

/** Pastille déterministe : le même auteur garde la même couleur. */
function pastilleDe(cle: string): string {
  const teintes = ["#C9A8F5", "#E2622C", "#FFD84A", "#EADFF9"];
  let somme = 0;
  for (let i = 0; i < cle.length; i += 1) somme = (somme + cle.charCodeAt(i)) % 997;
  const accent = teintes[somme % teintes.length];
  return `repeating-linear-gradient(135deg, ${accent} 0 5px, ${BLANC} 5px 11px)`;
}
