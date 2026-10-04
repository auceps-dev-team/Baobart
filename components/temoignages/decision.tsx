"use client";

import { useActionState, useState } from "react";

import { trancherTemoignage, type EtatDecision } from "@/lib/temoignages/actions";
import { MOTIF_MIN, type StatutTemoignage } from "@/lib/temoignages/regles";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE } from "@/lib/systeme/charte";

/**
 * Les gestes de relecture sous un témoignage.
 *
 * Publier part d'un clic. Refuser et retirer demandent un motif, que l'auteur
 * lira sur son écran : sans lui, il ne saurait pas quoi corriger.
 */
export function DecisionTemoignage({ id, statut, sien }: { id: string; statut: StatutTemoignage; sien: boolean }) {
  const [publier, envoyerPublier, publication] = useActionState<EtatDecision | null, FormData>(
    trancherTemoignage.bind(null, id, "PUBLIER"),
    null,
  );
  const [refus, envoyerRefus, enRefus] = useActionState<EtatDecision | null, FormData>(
    trancherTemoignage.bind(null, id, statut === "APPROVED" ? "RETIRER" : "REFUSER"),
    null,
  );
  const [motifOuvert, setMotifOuvert] = useState(false);

  if (sien) {
    return (
      <p style={{ margin: "12px 0 0", fontSize: 12.5, fontWeight: 700, opacity: 0.7 }}>
        C&apos;est le tien : un autre membre de l&apos;équipe doit le relire.
      </p>
    );
  }
  if (statut === "REJECTED") return null;

  const erreur = (publier && !publier.ok ? publier.message : null) ?? (refus && !refus.ok ? refus.message : null);

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {statut === "PENDING" ? (
          <form action={envoyerPublier}>
            <button type="submit" disabled={publication} style={{ ...bouton, background: JAUNE }}>
              Publier sur l&apos;accueil
            </button>
          </form>
        ) : null}
        <button type="button" onClick={() => setMotifOuvert((o) => !o)} style={{ ...bouton, background: BLANC }}>
          {statut === "APPROVED" ? "Retirer de l'accueil" : "Refuser"}
        </button>
      </div>

      {motifOuvert ? (
        <form action={envoyerRefus} style={{ display: "grid", gap: 8, maxWidth: 560 }}>
          <textarea
            name="motif"
            required
            minLength={MOTIF_MIN}
            rows={2}
            placeholder="Ce que l'auteur doit corriger — il le lira sur son écran."
            style={{ padding: "10px 12px", border: CADRE, borderRadius: 12, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", resize: "vertical" }}
          />
          <button type="submit" disabled={enRefus} style={{ ...bouton, background: ORANGE, color: BLANC, justifySelf: "start" }}>
            {statut === "APPROVED" ? "Retirer, avec ce motif" : "Refuser, avec ce motif"}
          </button>
        </form>
      ) : null}

      {erreur ? (
        <span role="status" style={{ fontSize: 12.5, fontWeight: 700, color: ORANGE }}>
          {erreur}
        </span>
      ) : null}
    </div>
  );
}

const bouton: React.CSSProperties = {
  padding: "8px 14px",
  border: CADRE,
  borderRadius: 11,
  fontSize: 12.5,
  fontWeight: 800,
  fontFamily: "inherit",
  color: ENCRE,
  cursor: "pointer",
};
