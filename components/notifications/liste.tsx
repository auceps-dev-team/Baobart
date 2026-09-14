"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";

import type { LigneNotification } from "@/lib/notifications/queries";
import {
  marquerNotificationLue,
  toutMarquerLuAction,
} from "@/lib/notifications/actions";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE } from "@/lib/systeme/charte";

/**
 * La liste, et ses deux gestes.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE NON LUE SE DISTINGUE D'UN COUP D'ŒIL, ET PAS PAR LA COULEUR SEULE
 *
 * Le fond jaune saute aux yeux, mais quelqu'un qui distingue mal les couleurs
 * ne le verrait pas. Une pastille « NOUVEAU » l'accompagne donc — l'information
 * passe par deux canaux, ce qui est la règle du projet pour tout ce qui
 * change un état.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * OUVRIR MARQUE LU, ET C'EST TOUT
 *
 * Pas de bouton « marquer lue » par ligne : personne ne l'utiliserait, et il
 * occuperait la place du lien qui mène quelque part. Cliquer la notification
 * fait les deux — on marque, puis on navigue.
 *
 * Le marquage est optimiste : la ligne pâlit tout de suite, sans attendre le
 * serveur. Si l'écriture échoue, la page se rafraîchira et la ligne
 * redeviendra jaune — c'est un défaut sans conséquence, et l'attente s'en
 * remarquerait davantage.
 */
export function ListeNotifications({
  lignes,
  nonLues,
}: {
  lignes: LigneNotification[];
  nonLues: number;
}) {
  const [enCours, demarrer] = useTransition();
  const [luesLocalement, setLuesLocalement] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const estLue = (l: LigneNotification) => l.lue || luesLocalement.has(l.id);

  const ouvrir = (l: LigneNotification) => {
    if (estLue(l)) return;
    setLuesLocalement((s) => new Set(s).add(l.id));
    demarrer(async () => {
      await marquerNotificationLue(l.id);
    });
  };

  return (
    <div style={{ maxWidth: 760 }}>
      {nonLues > 0 ? (
        <button
          type="button"
          disabled={enCours}
          className="sticker-press"
          onClick={() =>
            demarrer(async () => {
              const suite = await toutMarquerLuAction();
              setLuesLocalement(new Set(lignes.map((l) => l.id)));
              setMessage(suite.message ?? null);
            })
          }
          style={{
            padding: "10px 16px",
            border: CADRE,
            borderRadius: 13,
            background: BLANC,
            boxShadow: `3px 3px 0 ${ENCRE}`,
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
            color: ENCRE,
            marginBottom: 16,
          }}
        >
          Tout marquer comme lu
        </button>
      ) : null}

      {message ? (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: "10px 13px",
            border: CADRE,
            borderRadius: 12,
            background: LAVANDE,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lignes.map((l) => {
          const lue = estLue(l);
          const contenu = (
            <>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "baseline",
                }}
              >
                {/*
                  Pas la couleur seule : la pastille dit la même chose en
                  toutes lettres.
                */}
                {lue ? null : (
                  <span
                    style={{
                      padding: "3px 9px",
                      border: `2px solid ${ENCRE}`,
                      borderRadius: 999,
                      background: BLANC,
                      fontFamily: "var(--font-mono)",
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: ".08em",
                    }}
                  >
                    NOUVEAU
                  </span>
                )}
                <div style={{ fontSize: 15, fontWeight: 800, flex: "1 1 240px" }}>
                  {l.titre}
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    opacity: 0.6,
                  }}
                >
                  {l.quand.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>

              <p
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  lineHeight: 1.55,
                  margin: "8px 0 0",
                  opacity: 0.85,
                  textWrap: "pretty",
                }}
              >
                {l.corps}
              </p>
            </>
          );

          const habillage = {
            display: "block",
            border: CADRE,
            borderRadius: 18,
            background: lue ? BLANC : JAUNE,
            boxShadow: `4px 4px 0 ${ENCRE}`,
            padding: 16,
            color: ENCRE,
            textAlign: "left" as const,
            width: "100%",
            font: "inherit",
            cursor: "pointer",
          };

          // Avec un lien, c'est un lien : on doit pouvoir l'ouvrir dans un
          // onglet, le copier, le voir dans la barre d'état. Un `<button>` qui
          // navigue perdrait les trois.
          return l.lien ? (
            <Link
              key={l.id}
              href={l.lien as Route}
              onClick={() => ouvrir(l)}
              className="sticker-press"
              style={habillage}
            >
              {contenu}
            </Link>
          ) : (
            <button
              key={l.id}
              type="button"
              onClick={() => ouvrir(l)}
              style={habillage}
            >
              {contenu}
            </button>
          );
        })}
      </div>
    </div>
  );
}
