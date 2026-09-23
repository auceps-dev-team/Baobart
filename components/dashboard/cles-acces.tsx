"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useActionState, useState, useTransition } from "react";

import { enregistrerUneCle, type EtatCles } from "@/lib/auth/actions-webauthn";
import type { CleAffichee } from "@/lib/auth/webauthn";

/**
 * Le panneau des clés d'accès.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * `startRegistration` DOIT ÊTRE APPELÉ DEPUIS UN GESTE DE LA PERSONNE
 *
 * Les navigateurs refusent d'ouvrir la fenêtre d'authentificateur en dehors
 * d'un clic — c'est ce qui empêche une page d'ouvrir la demande toute seule.
 *
 * D'où l'enchaînement : le clic demande les options au serveur, puis appelle
 * `startRegistration` dans le même geste. Faire l'inverse — préparer les
 * options au chargement — paraîtrait plus rapide et ferait échouer l'appel
 * avec une erreur que personne ne comprend.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ANNULATION N'EST PAS UNE ERREUR
 *
 * Fermer la fenêtre du système lève une exception, exactement comme une vraie
 * panne. Les traiter pareil afficherait « quelque chose a échoué » à quelqu'un
 * qui a simplement changé d'avis.
 */

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const CADRE = `2.5px solid ${ENCRE}`;

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const bouton = (fond: string) => ({
  padding: "11px 17px",
  border: CADRE,
  borderRadius: 13,
  background: fond,
  fontFamily: "inherit",
  fontSize: 13.5,
  fontWeight: 800,
  cursor: "pointer",
});

export function PanneauClesAcces({
  cles,
  demarrer,
  retirer,
}: {
  cles: CleAffichee[];
  demarrer: () => Promise<unknown>;
  retirer: (
    precedent: EtatCles | null,
    donnees: FormData,
  ) => Promise<EtatCles>;
}) {
  const [etat, setEtat] = useState<EtatCles | null>(null);
  const [enCours, transition] = useTransition();
  const [libelle, setLibelle] = useState("");
  const [suiteRetrait, agirRetirer] = useActionState(retirer, null);

  return (
    <div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
        {
          "Une clé d'accès remplace le code à six chiffres : l'empreinte, le visage ou le code de l'appareil suffisent. Elle s'ajoute au mot de passe, elle ne le remplace pas."
        }
      </p>

      {cles.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "14px 0 0",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {cles.map((c) => (
            <li
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                border: CADRE,
                borderRadius: 13,
                background: BLANC,
              }}
            >
              <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>
                  {c.libelle}
                </span>
                <span style={{ display: "block", fontSize: 12, opacity: 0.65 }}>
                  {`ajoutée le ${DATE.format(c.ajouteeLe)}`}
                  {c.utiliseeLe
                    ? ` · dernier usage le ${DATE.format(c.utiliseeLe)}`
                    : " · jamais employée"}
                </span>
              </span>

              <form action={agirRetirer}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  style={{ ...bouton(BLANC), color: ORANGE, padding: "8px 13px" }}
                >
                  Retirer
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <label
            htmlFor="libelle-cle"
            style={{
              display: "block",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              opacity: 0.55,
              marginBottom: 6,
            }}
          >
            Nom de la clé
          </label>
          <input
            id="libelle-cle"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Mon téléphone"
            style={{
              padding: "11px 13px",
              border: CADRE,
              borderRadius: 12,
              background: BLANC,
              fontFamily: "inherit",
              fontSize: 13.5,
              width: 210,
            }}
          />
        </div>

        <button
          type="button"
          disabled={enCours}
          onClick={() =>
            transition(async () => {
              try {
                const options = await demarrer();
                if (!options) {
                  setEtat({ ok: false, message: "Reconnecte-toi." });
                  return;
                }

                const reponse = await startRegistration({
                  optionsJSON: options as Parameters<
                    typeof startRegistration
                  >[0]["optionsJSON"],
                });

                setEtat(await enregistrerUneCle(reponse, libelle || null));
                setLibelle("");
              } catch (cause) {
                // Fermer la fenêtre du système lève, comme une vraie panne.
                // Les confondre afficherait une erreur à qui a changé d'avis.
                const nom = cause instanceof Error ? cause.name : "";
                if (nom === "NotAllowedError" || nom === "AbortError") {
                  setEtat(null);
                  return;
                }

                setEtat({
                  ok: false,
                  message:
                    "Ce navigateur n'a pas pu créer la clé. Essaie depuis un téléphone ou un gestionnaire de mots de passe.",
                });
              }
            })
          }
          style={bouton(JAUNE)}
        >
          {enCours ? "Un instant…" : "Ajouter une clé"}
        </button>
      </div>

      {etat ? (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 13.5,
            fontWeight: 700,
            color: etat.ok ? ENCRE : ORANGE,
          }}
        >
          {etat.message}
        </p>
      ) : null}

      {suiteRetrait ? (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 13.5,
            fontWeight: 700,
            color: suiteRetrait.ok ? ENCRE : ORANGE,
          }}
        >
          {suiteRetrait.message}
        </p>
      ) : null}

      {etat?.ok && etat.codesSecours ? (
        <div
          style={{
            marginTop: 14,
            padding: 16,
            border: CADRE,
            borderRadius: 16,
            background: "#FFF3EE",
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 800, color: ORANGE }}>
            {"Note ces codes maintenant — ils ne seront plus jamais affichés."}
          </div>
          <p style={{ fontSize: 12.5, opacity: 0.8, margin: "6px 0 12px" }}>
            {
              "Ils sont ton seul recours si tu perds cet appareil. Chacun ouvre le compte une seule fois."
            }
          </p>
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))",
              gap: 8,
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {etat.codesSecours.map((c) => (
              <li
                key={c}
                style={{
                  padding: "9px 10px",
                  border: CADRE,
                  borderRadius: 10,
                  background: BLANC,
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
