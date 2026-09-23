"use client";

import { useActionState, useState, useTransition } from "react";

import type {
  EtatDeuxFacteursAction,
} from "@/lib/auth/actions-2fa";
import type { EtatDeuxFacteurs } from "@/lib/auth/deux-facteurs";

/**
 * Le panneau de double authentification du profil.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES CODES DE SECOURS NE S'AFFICHENT QU'UNE FOIS, ET L'ÉCRAN LE DIT
 *
 * Ils sont stockés hachés : personne — pas même un administrateur — ne peut
 * les relire. Un écran qui les montrerait discrètement, sans prévenir, ferait
 * fermer l'onglet à quelqu'un qui croit pouvoir y revenir.
 *
 * D'où l'encadré orange, le mot « une seule fois », et le bouton de copie.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON N'AFFICHE PAS DE QR
 *
 * Il en faudrait un, et il n'y en a pas : le fabriquer demande un générateur
 * de code (Reed-Solomon, masquage) ou une dépendance de plus dans un projet
 * qui en compte onze.
 *
 * En attendant, deux chemins qui marchent vraiment : la clé en groupes de
 * quatre, recopiable ; et le lien `otpauth://`, qui sur un téléphone ouvre
 * l'application d'authentification et la configure d'un geste — plus rapide
 * qu'un QR quand on est déjà sur l'appareil.
 */

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const CADRE = `2.5px solid ${ENCRE}`;

const champ = {
  padding: "11px 13px",
  border: CADRE,
  borderRadius: 12,
  background: BLANC,
  fontFamily: "var(--font-mono)",
  fontSize: 15,
  letterSpacing: ".12em",
  width: 190,
};

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

function Codes({ codes }: { codes: string[] }) {
  const [copie, setCopie] = useState(false);

  return (
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
          "Ils sont stockés sous forme d'empreinte : personne, chez Baobart non plus, ne peut les relire. Chacun ouvre le compte une seule fois."
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
        {codes.map((c) => (
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

      <button
        type="button"
        onClick={() => {
          // `clipboard` peut manquer ou être refusé — hors HTTPS, dans un
          // navigateur durci. On ne casse pas l'écran pour ça : les codes
          // restent lisibles et recopiables à la main juste au-dessus.
          navigator.clipboard
            ?.writeText(codes.join("\n"))
            .then(() => setCopie(true))
            .catch(() => setCopie(false));
        }}
        style={{ ...bouton(BLANC), marginTop: 12 }}
      >
        {copie ? "Copiés ✓" : "Copier les huit"}
      </button>
    </div>
  );
}

function Message({ etat }: { etat: EtatDeuxFacteursAction | null }) {
  if (!etat) return null;

  return (
    <p
      style={{
        margin: "10px 0 0",
        fontSize: 13.5,
        fontWeight: 700,
        color: etat.ok ? ENCRE : ORANGE,
      }}
    >
      {etat.message}
    </p>
  );
}

export function PanneauDeuxFacteurs({
  etat,
  demarrer,
  confirmer,
  couper,
  renouveler,
}: {
  etat: EtatDeuxFacteurs;
  demarrer: () => Promise<EtatDeuxFacteursAction>;
  confirmer: (
    precedent: EtatDeuxFacteursAction | null,
    donnees: FormData,
  ) => Promise<EtatDeuxFacteursAction>;
  couper: (
    precedent: EtatDeuxFacteursAction | null,
    donnees: FormData,
  ) => Promise<EtatDeuxFacteursAction>;
  renouveler: (
    precedent: EtatDeuxFacteursAction | null,
    donnees: FormData,
  ) => Promise<EtatDeuxFacteursAction>;
}) {
  const [debut, setDebut] = useState<EtatDeuxFacteursAction | null>(null);
  const [enDemarrage, demarrerTransition] = useTransition();

  const [suiteConfirmation, agirConfirmer, confirmeEnCours] = useActionState(
    confirmer,
    null,
  );
  const [suiteCoupure, agirCouper, coupeEnCours] = useActionState(couper, null);
  const [suiteCodes, agirRenouveler, codesEnCours] = useActionState(
    renouveler,
    null,
  );

  if (!etat.disponible) {
    return (
      <p style={{ fontSize: 13.5, margin: 0, opacity: 0.8 }}>
        {
          "La double authentification n'est pas configurée sur cette plateforme : la clé de chiffrement des secrets manque. Tant qu'elle manque, l'activation est refusée plutôt que de stocker un secret en clair."
        }
      </p>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // CE BLOC PASSE AVANT « ACTIVE », ET C'EST TOUT L'ENJEU
  //
  // Il était placé après. `confirmerDeuxFacteurs` appelle `revalidatePath`,
  // le composant serveur se réexécute, `etat.active` devient vrai — et le
  // bloc « active » répondait le premier. Les huit codes de secours
  // n'atteignaient jamais l'écran.
  //
  // Rien n'échouait : l'activation réussissait, le panneau affichait « Active,
  // il reste 8 codes de secours sur huit », et la seule chose qui sépare un
  // téléphone perdu d'un compte définitivement fermé n'avait jamais été
  // montrée. On ne peut pas la réafficher — elle est hachée en base.
  //
  // Trouvé au navigateur, pas en test : les tests d'intégration vérifient que
  // `confirmerActivation` REND les codes, ce qui était vrai.
  if (suiteConfirmation?.ok && suiteConfirmation.codes) {
    return (
      <div>
        <Message etat={suiteConfirmation} />
        <Codes codes={suiteConfirmation.codes} />
      </div>
    );
  }

  // ── Active ───────────────────────────────────────────────────────────
  if (etat.active) {
    return (
      <div>
        <p style={{ margin: 0, fontSize: 13.5 }}>
          <strong>Active.</strong>{" "}
          {`Il reste ${etat.codesSecoursRestants} code${
            etat.codesSecoursRestants > 1 ? "s" : ""
          } de secours sur huit.`}
        </p>

        {etat.codesSecoursRestants <= 2 ? (
          <p style={{ fontSize: 13, color: ORANGE, fontWeight: 700 }}>
            {
              "Il t'en reste peu. Renouvelle-les avant d'être bloqué dehors avec un téléphone perdu."
            }
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            marginTop: 16,
          }}
        >
          <form action={agirRenouveler}>
            <label
              htmlFor="code-renouveler"
              style={{ display: "block", fontSize: 12.5, marginBottom: 6 }}
            >
              Nouveaux codes de secours
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                id="code-renouveler"
                name="code"
                required
                placeholder="123 456"
                autoComplete="one-time-code"
                style={champ}
              />
              <button type="submit" disabled={codesEnCours} style={bouton(JAUNE)}>
                {codesEnCours ? "…" : "Renouveler"}
              </button>
            </div>
            <Message etat={suiteCodes} />
          </form>

          <form action={agirCouper}>
            <label
              htmlFor="code-couper"
              style={{ display: "block", fontSize: 12.5, marginBottom: 6 }}
            >
              Couper la double authentification
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                id="code-couper"
                name="code"
                required
                placeholder="123 456"
                autoComplete="one-time-code"
                style={champ}
              />
              <button
                type="submit"
                disabled={coupeEnCours}
                style={{ ...bouton(BLANC), color: ORANGE }}
              >
                {coupeEnCours ? "…" : "Couper"}
              </button>
            </div>
            <Message etat={suiteCoupure} />
          </form>
        </div>

        {suiteCodes?.ok && suiteCodes.codes ? (
          <Codes codes={suiteCodes.codes} />
        ) : null}
      </div>
    );
  }

  // ── En cours d'activation ────────────────────────────────────────────
  const cle = debut?.ok ? debut : null;

  return (
    <div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
        {
          "Un mot de passe volé suffit à ouvrir un compte. Un code qui change toutes les trente secondes, non — même intercepté, il ne vaut plus rien la minute d'après."
        }
      </p>

      {etat.enAttente && !cle ? (
        <p style={{ fontSize: 13, opacity: 0.75, marginTop: 8 }}>
          {
            "Une activation a été commencée sans être finie. Recommence : la clé précédente sera remplacée."
          }
        </p>
      ) : null}

      {cle ? (
        <div
          style={{
            marginTop: 14,
            padding: 16,
            border: CADRE,
            borderRadius: 16,
            background: "#F4EEFC",
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>
            1. Enregistre cette clé dans ton application
          </div>
          <code
            style={{
              display: "block",
              padding: "10px 12px",
              border: CADRE,
              borderRadius: 10,
              background: BLANC,
              fontSize: 15,
              letterSpacing: ".1em",
              wordBreak: "break-all",
            }}
          >
            {cle.secret}
          </code>

          <p style={{ fontSize: 12.5, opacity: 0.8, margin: "10px 0 0" }}>
            {"Depuis un téléphone, "}
            <a href={cle.uri} style={{ fontWeight: 800 }}>
              ouvre directement l&apos;application
            </a>
            {" — elle se configure seule."}
          </p>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        {cle ? (
          <form action={agirConfirmer}>
            <label
              htmlFor="code-confirmer"
              style={{ display: "block", fontSize: 12.5, marginBottom: 6 }}
            >
              2. Saisis le code affiché par ton application
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                id="code-confirmer"
                name="code"
                required
                autoFocus
                placeholder="123 456"
                inputMode="numeric"
                autoComplete="one-time-code"
                style={champ}
              />
              <button
                type="submit"
                disabled={confirmeEnCours}
                style={bouton(JAUNE)}
              >
                {confirmeEnCours ? "…" : "Activer"}
              </button>
            </div>
            <Message etat={suiteConfirmation} />
          </form>
        ) : (
          <>
            <button
              type="button"
              disabled={enDemarrage}
              onClick={() =>
                demarrerTransition(async () => setDebut(await demarrer()))
              }
              style={bouton(JAUNE)}
            >
              {enDemarrage ? "Un instant…" : "Activer la double authentification"}
            </button>
            <Message etat={debut?.ok === false ? debut : null} />
          </>
        )}
      </div>
    </div>
  );
}
