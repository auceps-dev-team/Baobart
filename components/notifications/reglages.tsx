"use client";

import { useState, useTransition } from "react";

import {
  CANAUX_LIVRES,
  CATALOGUE,
  estModifiable,
  type Audience,
  type Canal,
  type EvenementNotifiable,
} from "@/lib/notifications/catalogue";
import { reglerNotification } from "@/lib/notifications/actions";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Un interrupteur par couple (événement × canal).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PAS UN INTERRUPTEUR PAR LIGNE
 *
 * C'est la leçon prise chez Gumroad, qui porte pour chaque événement deux
 * réglages distincts — courriel et poussée. La raison tient en un exemple :
 * quelqu'un veut la sonnerie de sa vente sur son téléphone, et pas un courriel
 * de plus. Un interrupteur par ligne ne sait pas exprimer ça, et devient donc
 * un interrupteur « tout couper ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE GESTE PART TOUT DE SUITE, SANS BOUTON « ENREGISTRER »
 *
 * Un écran de réglages avec un bouton de validation produit deux états : ce
 * qu'on voit et ce qui est rangé. On finit par partir sans cliquer, et par
 * recevoir ce qu'on croyait avoir coupé.
 *
 * Chaque bascule écrit immédiatement. L'affichage est optimiste : si le
 * serveur refuse — un couple impératif posté à la main — on remet l'état
 * précédent et on affiche pourquoi.
 */

interface LigneReglage {
  evenement: EvenementNotifiable;
  ouverts: Canal[];
}

export function ReglagesNotifications({
  sections,
}: {
  sections: { audience: Audience; evenements: LigneReglage[] }[];
}) {
  // L'état local part de ce que le serveur a calculé, puis suit les bascules.
  const [ouverts, setOuverts] = useState<Record<string, boolean>>(() => {
    const depart: Record<string, boolean> = {};
    for (const s of sections) {
      for (const l of s.evenements) {
        for (const c of CANAUX_LIVRES) {
          depart[`${l.evenement}:${c}`] = l.ouverts.includes(c);
        }
      }
    }
    return depart;
  });

  const [enCours, demarrer] = useTransition();
  const [refus, setRefus] = useState<string | null>(null);

  const basculer = (evenement: EvenementNotifiable, canal: Canal) => {
    const cle = `${evenement}:${canal}`;
    const avant = ouverts[cle] ?? false;

    setOuverts((o) => ({ ...o, [cle]: !avant }));
    setRefus(null);

    demarrer(async () => {
      const suite = await reglerNotification(evenement, canal, !avant);
      if (!suite.ok) {
        // Le serveur a refusé : on remet ce qui était, et on dit pourquoi.
        setOuverts((o) => ({ ...o, [cle]: avant }));
        setRefus(suite.message ?? "Ce réglage n'a pas pu être changé.");
      }
    });
  };

  return (
    <div style={{ maxWidth: 860 }}>
      {refus ? (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: "10px 13px",
            border: CADRE,
            borderRadius: 12,
            background: ORANGE,
            color: BLANC,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {refus}
        </div>
      ) : null}

      {sections.map((s) => (
        <section key={s.audience} style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: ".12em",
              opacity: 0.6,
              margin: "0 0 12px",
            }}
          >
            {s.audience === "acheteur" ? "Quand tu achètes" : "Quand tu vends ou organises"}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {s.evenements.map(({ evenement }) => {
              const reglage = CATALOGUE[evenement];
              const modifiable = estModifiable(evenement);

              return (
                <article
                  key={evenement}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 14,
                    alignItems: "center",
                    border: CADRE,
                    borderRadius: 18,
                    background: modifiable ? BLANC : GRIS,
                    boxShadow: `4px 4px 0 ${ENCRE}`,
                    padding: 16,
                  }}
                >
                  <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800 }}>
                      {reglage.libelle}
                      {modifiable ? null : (
                        <span
                          style={{
                            marginLeft: 8,
                            padding: "2px 8px",
                            border: `2px solid ${ENCRE}`,
                            borderRadius: 999,
                            background: BLANC,
                            fontFamily: "var(--font-mono)",
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: ".08em",
                            verticalAlign: "middle",
                          }}
                        >
                          TOUJOURS
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        marginTop: 4,
                        opacity: 0.75,
                        textWrap: "pretty",
                      }}
                    >
                      {reglage.explication}
                    </div>
                    {reglage.modele === null ? (
                      // Dit franchement ce qui n'existe pas encore plutôt que
                      // d'offrir un interrupteur qui n'enverrait rien.
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          marginTop: 6,
                          opacity: 0.6,
                        }}
                      >
                        pas encore de courriel pour cet avis
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
                    {CANAUX_LIVRES.map((canal) => {
                      const actif = ouverts[`${evenement}:${canal}`] ?? false;
                      const utilisable =
                        modifiable &&
                        !enCours &&
                        (canal !== "COURRIEL" || reglage.modele !== null);

                      return (
                        <button
                          key={canal}
                          type="button"
                          disabled={!utilisable}
                          aria-pressed={actif}
                          onClick={() => basculer(evenement, canal)}
                          style={{
                            padding: "9px 14px",
                            border: CADRE,
                            borderRadius: 12,
                            background: actif ? VERT : BLANC,
                            boxShadow: utilisable ? `3px 3px 0 ${ENCRE}` : "none",
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: "inherit",
                            color: ENCRE,
                            cursor: utilisable ? "pointer" : "not-allowed",
                            opacity: utilisable ? 1 : 0.55,
                          }}
                          title={
                            modifiable
                              ? undefined
                              : "Cet avis ne se coupe pas : il engage de l'argent ou une décision."
                          }
                        >
                          {/* Le libellé porte l'état, pas seulement la couleur. */}
                          {canal === "COURRIEL" ? "Courriel" : "Dans l'app"}{" "}
                          {actif ? "✓" : "—"}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <div
        style={{
          border: CADRE,
          borderRadius: 18,
          background: JAUNE,
          padding: 16,
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.5,
          textWrap: "pretty",
        }}
      >
        Les notifications poussées sur ton navigateur existent déjà pour les
        rappels d&apos;abonnement, mais elles ne servent pas encore ces
        avis-là. Quand ce sera le cas, un troisième réglage apparaîtra sur
        chaque ligne — ton choix actuel ne sera pas perdu.
      </div>
    </div>
  );
}
