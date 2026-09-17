"use client";

import { useActionState, useState, useTransition } from "react";

import type { EtatContenu } from "@/lib/cms/cycle";
import { LIBELLE_GESTE, gestesDepuis } from "@/lib/cms/cycle";
import {
  trancherArticle,
  trancherArticleAvecMotif,
  type EtatGeste,
} from "@/lib/blog/actions";
import { BLANC, CADRE, ENCRE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Ce qu'on peut faire d'un article.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TOUS LES GESTES DE LA MACHINE, SANS EXCEPTION
 *
 * Contrairement aux événements, il n'y a pas de portée à croiser : le blog est
 * fermé à l'administration (§18.1), et qui entre ici peut tout.
 *
 * `soumettre` figure donc dans la liste, et c'est le point délicat. §4.3
 * voulait une relecture obligatoire par un second administrateur ; §18.1 dit
 * que l'auteur porte déjà le droit de publier. Les deux se rejoignent en
 * offrant le chemin sans l'imposer — d'où deux boutons côte à côte sur un
 * brouillon, « Envoyer en relecture » et « Publier ».
 *
 * `refuser` a son propre bloc : il porte un motif, donc un formulaire.
 */
export function GestesArticle({
  articleId,
  etat,
}: {
  articleId: string;
  etat: EtatContenu;
}) {
  const [enCours, demarrer] = useTransition();
  const [retour, setRetour] = useState<EtatGeste | null>(null);
  const [refusOuvert, setRefusOuvert] = useState(false);

  const [etatRefus, refuserAction] = useActionState<EtatGeste | null, FormData>(
    trancherArticleAvecMotif.bind(null, articleId, "refuser"),
    null,
  );

  const gestes = gestesDepuis(etat).filter((g) => g !== "refuser");
  const peutRefuser = gestesDepuis(etat).includes("refuser");

  const message = retour?.message ?? etatRefus?.message ?? null;

  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 20,
        background: BLANC,
        boxShadow: `4px 4px 0 ${ENCRE}`,
        padding: 18,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".12em",
          opacity: 0.6,
          marginBottom: 12,
        }}
      >
        Ce qu&apos;on peut faire
      </div>

      {message ? (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "10px 13px",
            border: CADRE,
            borderRadius: 12,
            background: ORANGE,
            color: BLANC,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {gestes.map((g) => (
          <button
            key={g}
            type="button"
            disabled={enCours}
            className="sticker-press"
            onClick={() =>
              demarrer(async () => {
                setRetour(await trancherArticle(articleId, g));
              })
            }
            style={bouton(g === "publier" ? VERT : BLANC)}
          >
            {LIBELLE_GESTE[g]}
          </button>
        ))}

        {peutRefuser ? (
          <button
            type="button"
            disabled={enCours}
            onClick={() => setRefusOuvert((o) => !o)}
            style={bouton(BLANC)}
          >
            {refusOuvert ? "Ne pas refuser" : "Refuser…"}
          </button>
        ) : null}
      </div>

      {refusOuvert && peutRefuser ? (
        <form action={refuserAction} style={{ marginTop: 14 }}>
          <label
            htmlFor={`motif-${articleId}`}
            style={{
              display: "block",
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              opacity: 0.6,
              marginBottom: 6,
            }}
          >
            Pourquoi tu refuses
          </label>
          <textarea
            id={`motif-${articleId}`}
            name="motif"
            required
            minLength={8}
            rows={3}
            placeholder="Ce que l'auteur lira sur sa fiche."
            style={{
              width: "100%",
              padding: "12px 14px",
              border: CADRE,
              borderRadius: 14,
              background: "#F4EEFC",
              fontFamily: "inherit",
              fontSize: 13.5,
              fontWeight: 500,
              outline: "none",
              resize: "vertical",
            }}
          />
          <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8, opacity: 0.75 }}>
            Dis ce qu&apos;il faut corriger, pas seulement ce qui ne va pas.
          </div>
          <button
            type="submit"
            className="sticker-press"
            style={{ ...bouton(ORANGE), color: BLANC, marginTop: 10 }}
          >
            Refuser cet article
          </button>
        </form>
      ) : null}
    </div>
  );
}

function bouton(fond: string) {
  return {
    padding: "11px 18px",
    border: CADRE,
    borderRadius: 13,
    background: fond,
    boxShadow: `3px 3px 0 ${ENCRE}`,
    fontSize: 13.5,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    color: ENCRE,
  } as const;
}
