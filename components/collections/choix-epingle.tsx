"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { basculerEpingle, choixPourEpingler, creerEtEpingler } from "@/lib/collections/actions";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const CADRE = `2.5px solid ${ENCRE}`;

type Collection = { id: string; titre: string; partageeAvec: string | null; contient: boolean };

/**
 * Ranger une ressource dans ses collections — ce que le bouton « Épingler »
 * des cartes promettait sans le faire (relevé le 04/10).
 *
 * Les collections ne se chargent qu'à l'ouverture : la mosaïque porte
 * cinquante cartes, et personne n'épingle les cinquante.
 */
export function ChoixEpingle({
  produitId,
  titre,
  onFerme,
}: {
  produitId: string;
  titre: string;
  /** Rappelé à la fermeture : la ressource est-elle rangée quelque part ? */
  onFerme: (rangeeQuelquePart: boolean) => void;
}) {
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [nouvelle, setNouvelle] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    let vivant = true;
    void choixPourEpingler(produitId).then((r) => {
      if (!vivant) return;
      if (!r.ok) {
        window.location.href = "/connexion";
        return;
      }
      setCollections(r.collections);
    });
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    window.addEventListener("keydown", echap);
    return () => {
      vivant = false;
      window.removeEventListener("keydown", echap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produitId]);

  const fermer = () => onFerme((collections ?? []).some((c) => c.contient));

  const basculer = (c: Collection) =>
    demarrer(async () => {
      setErreur(null);
      const r = await basculerEpingle(c.id, produitId, !c.contient);
      if (!r.ok) return setErreur(r.message);
      setCollections((l) => l?.map((x) => (x.id === c.id ? { ...x, contient: r.epinglee } : x)) ?? null);
    });

  const creer = () =>
    demarrer(async () => {
      setErreur(null);
      const r = await creerEtEpingler(nouvelle, produitId);
      if (!r.ok || !r.boardId) return setErreur(r.ok ? "La collection n'a pas été créée." : r.message);
      setCollections((l) => [{ id: r.boardId!, titre: nouvelle.trim(), partageeAvec: null, contient: true }, ...(l ?? [])]);
      setNouvelle("");
    });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="choix-epingle-titre"
      onClick={fermer}
      style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(18,18,18,.45)", display: "grid", placeItems: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, border: CADRE, borderRadius: 22, background: BLANC, boxShadow: `6px 6px 0 ${ENCRE}`, padding: 20, color: ENCRE }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div id="choix-epingle-titre" style={{ fontSize: 16, fontWeight: 800 }}>
              Ranger dans une collection
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.65, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {titre}
            </div>
          </div>
          <button type="button" onClick={fermer} aria-label="Fermer" style={{ ...bouton, padding: "4px 10px" }}>
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gap: 8, marginTop: 16, maxHeight: 280, overflowY: "auto" }}>
          {collections === null ? (
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.6 }}>Chargement…</div>
          ) : collections.length === 0 ? (
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.7 }}>Tu n&apos;as pas encore de collection : crée la première ci-dessous.</div>
          ) : (
            collections.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={enCours}
                onClick={() => basculer(c)}
                aria-pressed={c.contient}
                data-collection={c.id}
                style={{ ...bouton, display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: c.contient ? JAUNE : BLANC }}
              >
                <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>{c.titre}</span>
                  {c.partageeAvec ? (
                    <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, opacity: 0.65 }}>partagée avec {c.partageeAvec}</span>
                  ) : null}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800 }}>{c.contient ? "Rangée ✓" : "Ranger"}</span>
              </button>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nouvelle.trim()) creer();
          }}
          style={{ display: "flex", gap: 8, marginTop: 14 }}
        >
          <input
            value={nouvelle}
            onChange={(e) => setNouvelle(e.target.value)}
            maxLength={60}
            placeholder="Nouvelle collection"
            aria-label="Nom de la nouvelle collection"
            style={{ flex: "1 1 auto", minWidth: 0, padding: "10px 12px", border: CADRE, borderRadius: 12, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit" }}
          />
          <button type="submit" disabled={enCours || !nouvelle.trim()} style={{ ...bouton, background: JAUNE }}>
            Créer et ranger
          </button>
        </form>

        {erreur ? (
          <div role="status" style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: ORANGE }}>
            {erreur}
          </div>
        ) : null}

        <Link href="/dashboard/collections" style={{ display: "inline-block", marginTop: 12, fontSize: 12.5, fontWeight: 800, color: ENCRE, textDecoration: "underline" }}>
          Voir mes collections
        </Link>
      </div>
    </div>
  );
}

const bouton: React.CSSProperties = {
  padding: "9px 13px",
  border: CADRE,
  borderRadius: 12,
  background: BLANC,
  fontSize: 12.5,
  fontWeight: 800,
  fontFamily: "inherit",
  color: ENCRE,
  cursor: "pointer",
};
