"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import {
  connexionParCle,
  demarrerConnexionParCle,
} from "@/lib/auth/actions-webauthn";

import { BLANC, ENCRE, JAUNE, ORANGE } from "@/components/shell/nav-data";
import type { EtatFormulaire } from "@/lib/auth/actions";

/**
 * Le formulaire du second facteur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN SEUL CHAMP POUR LES DEUX SORTES DE CODES
 *
 * Six chiffres depuis l'application, ou un code de secours en deux groupes de
 * quatre. Deux champs séparés obligeraient à choisir avant de savoir ce qu'on
 * a sous la main — et quelqu'un qui vient de perdre son téléphone n'a pas
 * envie de chercher le bon onglet.
 *
 * Le serveur essaie les deux, dans cet ordre. C'est lui qui sait ; l'écran n'a
 * pas à trancher.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * `inputMode="numeric"` MAIS PAS `type="number"`
 *
 * Le premier fait apparaître le pavé numérique sur un téléphone. Le second
 * ferait la même chose ET refuserait les lettres d'un code de secours, tout en
 * ajoutant des flèches d'incrément sur un nombre qu'on n'incrémente jamais.
 */

const CADRE = `2.5px solid ${ENCRE}`;

export function FormulaireVerification({
  action,
  avecCle,
}: {
  action: (etat: EtatFormulaire, donnees: FormData) => Promise<EtatFormulaire>;
  /** Vrai quand ce compte a au moins une clé d'accès enregistrée. */
  avecCle: boolean;
}) {
  const [etat, envoyer, enCours] = useActionState(action, {});
  const [erreurCle, setErreurCle] = useState<string | null>(null);
  const [cleEnCours, transitionCle] = useTransition();

  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 26,
        background: BLANC,
        boxShadow: `7px 7px 0 ${ENCRE}`,
        padding: "30px 28px",
        maxWidth: 440,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: ".14em",
          opacity: 0.55,
        }}
      >
        Deuxième étape
      </div>

      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 30,
          lineHeight: 1.05,
          margin: "10px 0 8px",
        }}
      >
        Ton code de vérification
      </h1>

      <p style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.8, margin: 0 }}>
        {
          "Ouvre ton application d'authentification et recopie les six chiffres. Un code de secours fait aussi l'affaire."
        }
      </p>

      <form action={envoyer} style={{ marginTop: 22 }}>
        <label
          htmlFor="code"
          style={{
            display: "block",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            opacity: 0.55,
            marginBottom: 7,
          }}
        >
          Code
        </label>

        <input
          id="code"
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="123 456"
          style={{
            width: "100%",
            padding: "13px 15px",
            border: CADRE,
            borderRadius: 14,
            background: BLANC,
            fontFamily: "var(--font-mono)",
            fontSize: 20,
            letterSpacing: ".18em",
          }}
        />

        {etat.erreur ? (
          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              fontSize: 13.5,
              fontWeight: 700,
              color: ORANGE,
            }}
          >
            {etat.erreur}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={enCours}
          style={{
            marginTop: 18,
            width: "100%",
            padding: "14px 18px",
            border: CADRE,
            borderRadius: 15,
            background: JAUNE,
            boxShadow: `5px 5px 0 ${ENCRE}`,
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 800,
            cursor: enCours ? "progress" : "pointer",
          }}
        >
          {enCours ? "Un instant…" : "Vérifier"}
        </button>
      </form>

      {avecCle ? (
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: ".12em",
              opacity: 0.5,
            }}
          >
            <span style={{ flex: 1, height: 2, background: ENCRE, opacity: 0.2 }} />
            ou
            <span style={{ flex: 1, height: 2, background: ENCRE, opacity: 0.2 }} />
          </div>

          <button
            type="button"
            disabled={cleEnCours}
            onClick={() =>
              transitionCle(async () => {
                setErreurCle(null);
                try {
                  const options = await demarrerConnexionParCle();
                  if (!options) {
                    setErreurCle("La vérification a expiré. Reprends la connexion.");
                    return;
                  }

                  const reponse = await startAuthentication({
                    optionsJSON: options as Parameters<
                      typeof startAuthentication
                    >[0]["optionsJSON"],
                  });

                  // En cas de succès, l'action redirige : rien ne revient ici.
                  const suite = await connexionParCle(reponse);
                  if (suite && !suite.ok) setErreurCle(suite.message);
                } catch (cause) {
                  // Fermer la fenêtre du système n'est pas une panne.
                  const nom = cause instanceof Error ? cause.name : "";
                  if (nom === "NotAllowedError" || nom === "AbortError") return;

                  setErreurCle("Cette clé n'a pas pu être employée ici.");
                }
              })
            }
            style={{
              marginTop: 12,
              width: "100%",
              padding: "13px 18px",
              border: CADRE,
              borderRadius: 15,
              background: BLANC,
              fontFamily: "inherit",
              fontSize: 14.5,
              fontWeight: 800,
              cursor: cleEnCours ? "progress" : "pointer",
            }}
          >
            {cleEnCours ? "Un instant…" : "Employer une clé d'accès"}
          </button>

          {erreurCle ? (
            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                fontSize: 13.5,
                fontWeight: 700,
                color: ORANGE,
              }}
            >
              {erreurCle}
            </p>
          ) : null}
        </div>
      ) : null}

      <p style={{ marginTop: 18, marginBottom: 0, fontSize: 13, opacity: 0.75 }}>
        {"Téléphone perdu ? Un code de secours ouvre le compte, puis "}
        <Link href="/connexion" style={{ fontWeight: 700 }}>
          recommence la connexion
        </Link>
        {" si la vérification a expiré."}
      </p>
    </div>
  );
}
