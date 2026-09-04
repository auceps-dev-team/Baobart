"use client";

import { useActionState, useState } from "react";

import type { ElementAModerer } from "@/lib/cms/moderation";
import {
  basculerVerification,
  trancherOffre,
  type EtatModeration,
} from "@/lib/jobs/actions-moderation";
import { trancherService } from "@/lib/services/actions-moderation";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Un élément de la file, avec ses trois décisions.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ADRESSE EXTERNE EST MONTRÉE EN ENTIER
 *
 * C'est le seul détail de cet écran qui compte vraiment. Une URL tronquée dans
 * une file de modération est une URL qu'on approuve sans l'avoir lue — et c'est
 * exactement par là que passerait une arnaque déguisée en offre d'emploi.
 *
 * Elle est affichée en monospace, sur toute sa longueur, et **elle n'est pas
 * cliquable**. Un modérateur qui ouvre par réflexe des liens déposés par des
 * inconnus est la cible la plus facile de la plateforme. Pour l'ouvrir, il faut
 * la copier — ce demi-obstacle suffit à transformer un réflexe en décision.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MOTIF DE REFUS S'ÉCRIT AVANT DE REFUSER
 *
 * Le champ n'apparaît qu'au moment de refuser, et le bouton n'aboutit pas sans
 * lui. Trois mois plus tard, devant l'annonceur qui écrit pour comprendre, un
 * refus sans raison ne se justifie pas.
 */
export function CarteAModerer({ element }: { element: ElementAModerer }) {
  const [motifOuvert, setMotifOuvert] = useState(false);

  // L'action qui tranche dépend du type. On la choisit une fois, ici — les
  // trois formulaires en dessous partagent la même signature.
  const trancher =
    element.type === "service" ? trancherService : trancherOffre;

  const [etatPublier, publier] = useActionState<EtatModeration | null, FormData>(
    trancher.bind(null, element.id, "publier"),
    null,
  );
  const [etatRefuser, refuser] = useActionState<EtatModeration | null, FormData>(
    trancher.bind(null, element.id, "refuser"),
    null,
  );

  const erreur = etatPublier?.message ?? etatRefuser?.message ?? null;

  const estService = element.type === "service";

  return (
    <article
      style={{
        border: CADRE,
        borderRadius: 22,
        background: BLANC,
        boxShadow: `5px 5px 0 ${ENCRE}`,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline" }}>
        <span
          style={{
            padding: "5px 10px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 999,
            background: estService ? LAVANDE : JAUNE,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {estService ? "SERVICE" : "OFFRE D’EMPLOI"}
        </span>
        <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, flex: "1 1 240px" }}>
          {element.titre}
        </h2>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.6 }}>
          {element.auteur} · déposée le{" "}
          {element.soumisLe.toLocaleDateString("fr-FR")}
        </span>
      </div>

      {element.meta ? (
        <div
          style={{
            marginTop: 10,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            fontWeight: 700,
            opacity: 0.75,
          }}
        >
          {element.meta}
        </div>
      ) : null}

      <p
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          lineHeight: 1.55,
          margin: "12px 0 0",
          opacity: 0.85,
          textWrap: "pretty",
        }}
      >
        {element.extrait}
        {element.extrait.length >= 280 ? "…" : ""}
      </p>

      {element.urlExterne ? (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            border: CADRE,
            borderRadius: 16,
            background: ORANGE,
            color: BLANC,
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>
            Candidature externe — à lire avant d&apos;approuver
          </div>
          {/*
            Volontairement pas un lien. Ouvrir par réflexe une adresse déposée
            par un inconnu est la faute la plus facile à commettre ici.
          */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              marginTop: 8,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(0,0,0,.25)",
              wordBreak: "break-all",
              userSelect: "all",
            }}
          >
            {element.urlExterne}
          </div>
        </div>
      ) : null}

      {erreur ? (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: "10px 13px",
            border: CADRE,
            borderRadius: 12,
            background: ORANGE,
            color: BLANC,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {erreur}
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <form action={publier}>
          <button type="submit" className="sticker-press" style={bouton(VERT)}>
            Publier
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMotifOuvert((o) => !o)}
          style={bouton(BLANC)}
        >
          {motifOuvert ? "Annuler le refus" : "Refuser…"}
        </button>

        {/*
          Le badge « Offre vérifiée » n'existe que pour Jobs — c'est ce qui
          contrepèse le vecteur d'arnaque des URL externes. Un service ne
          porte pas d'URL, la commande passe par un `mailto:` sur l'adresse
          publique du créateur ; ajouter un badge de fiche diluerait
          « Créateur vérifié » qui vit déjà sur le profil.
        */}
        {estService ? null : (
          <button
            type="button"
            onClick={() => void basculerVerification(element.id, !element.verifie)}
            style={bouton(element.verifie ? JAUNE : BLANC)}
            title="Une offre vérifiée est une offre dont on a contrôlé l'entreprise et l'adresse de candidature."
          >
            {element.verifie ? "Vérifiée ✓" : "Marquer vérifiée"}
          </button>
        )}
      </div>

      {motifOuvert ? (
        <form action={refuser} style={{ marginTop: 14 }}>
          <label
            htmlFor={`motif-${element.id}`}
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
            Pourquoi ce refus
          </label>
          <textarea
            id={`motif-${element.id}`}
            name="motif"
            required
            minLength={8}
            rows={3}
            placeholder="Ce qu'on pourra montrer à l'annonceur."
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
          <button
            type="submit"
            className="sticker-press"
            style={{ ...bouton(ORANGE), color: BLANC, marginTop: 10 }}
          >
            {estService ? "Refuser ce service" : "Refuser cette offre"}
          </button>
        </form>
      ) : null}
    </article>
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
