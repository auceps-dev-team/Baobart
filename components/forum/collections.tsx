"use client";

import { useState, useTransition } from "react";

import {
  partagerUneCollection,
  retirerUneCollection,
} from "@/lib/forum/actions";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, ORANGE } from "@/lib/systeme/charte";

/**
 * Partager une collection, ou la retirer de l'espace.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE SÉLECTEUR NE MONTRE QUE CE QU'ON PEUT PARTAGER
 *
 * C'est-à-dire ses propres collections, et seulement celles qui ne sont
 * partagées nulle part. Montrer les autres grisées expliquerait mieux la règle,
 * et ferait aussi lire à tout le monde la liste des collections d'un membre —
 * y compris celles qu'il garde privées.
 *
 * La liste est donc calculée côté serveur par `mesCollectionsDetachees`, et
 * arrive ici déjà filtrée. Ce composant n'a accès à rien d'autre.
 */

export function PartagerUneCollection({
  slug,
  collections,
}: {
  slug: string;
  collections: { id: string; titre: string; ressources: number; privee: boolean }[];
}) {
  const [enCours, demarrer] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (collections.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 13, opacity: 0.65, lineHeight: 1.5 }}>
        Tu n&apos;as pas de collection libre à partager. Celles déjà partagées
        ailleurs doivent d&apos;abord en être retirées.
      </p>
    );
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="sticker-press"
        style={{
          padding: "11px 20px",
          border: CADRE,
          borderRadius: 13,
          background: JAUNE,
          fontSize: 13.5,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Partager une collection
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gap: 8 }}>
        {collections.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={enCours}
            onClick={() => {
              setErreur(null);
              demarrer(async () => {
                const suite = await partagerUneCollection(slug, c.id);
                if (suite.ok) setOuvert(false);
                else setErreur(suite.message);
              });
            }}
            className="sticker-press"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              textAlign: "left",
              padding: "12px 16px",
              border: CADRE,
              borderRadius: 13,
              background: enCours ? GRIS : BLANC,
              fontSize: 14,
              fontWeight: 700,
              cursor: enCours ? "progress" : "pointer",
            }}
          >
            <span>{c.titre}</span>
            <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.65 }}>
              {c.ressources} ressource{c.ressources > 1 ? "s" : ""}
              {/*
                Dit avant le clic, pas après : partager une collection privée
                la rend lisible par tous les membres, et c'est le genre de
                conséquence qu'on ne découvre pas une fois le geste fait.
              */}
              {c.privee ? " · privée jusqu'ici" : ""}
            </span>
          </button>
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={() => {
            setOuvert(false);
            setErreur(null);
          }}
          style={{
            padding: "9px 18px",
            border: CADRE,
            borderRadius: 12,
            background: BLANC,
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Annuler
        </button>
      </div>

      {erreur ? (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ORANGE }}>
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Retirer une collection de l'espace.
 *
 * Pas de confirmation : rien n'est détruit. `communityId` repasse à `null` et
 * la collection redevient personnelle — un clic la remet. Demander « es-tu
 * sûr ? » là où tout est réversible apprend à répondre oui sans lire.
 */
export function RetirerLaCollection({
  slug,
  boardId,
}: {
  slug: string;
  boardId: string;
}) {
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
            const suite = await retirerUneCollection(slug, boardId);
            if (!suite.ok) setErreur(suite.message);
          });
        }}
        style={{
          padding: "5px 11px",
          border: CADRE,
          borderRadius: 999,
          background: BLANC,
          color: ENCRE,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          cursor: enCours ? "progress" : "pointer",
        }}
      >
        Retirer
      </button>

      {erreur ? (
        <p style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: ORANGE }}>
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
