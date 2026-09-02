"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  BLANC,
  ENCRE,
  JAUNE,
  LAVANDE_CLAIR,
  ORANGE,
} from "@/components/shell/nav-data";
import type { EtatFormulaire } from "@/lib/auth/actions";
import type { FournisseurPublic } from "@/lib/auth/providers";
import {
  LONGUEUR_MOT_DE_PASSE_MIN,
  forceMotDePasse,
  libelleForce,
  manqueAuMotDePasse,
} from "@/lib/auth/strength";

/**
 * Formulaire d'authentification, traduit de « Baobart Auth.dc.html ».
 *
 * Les onglets sont de vrais liens vers `/connexion` et `/inscription` plutôt
 * qu'un état local : une page d'authentification doit être partageable, et le
 * bouton retour du navigateur doit fonctionner.
 */

const CADRE = `2.5px solid ${ENCRE}`;

/** Les deux intentions de la maquette. Aucune n'accorde de droit. */
const TYPES_DE_COMPTE = [
  {
    cle: "acheteur" as const,
    label: "Acheteur",
    glyphe: "▣",
    indice: "Télécharger, collectionner, travailler en équipe.",
  },
  {
    cle: "createur" as const,
    label: "Créateur",
    glyphe: "✦",
    indice: "Publier tes ressources et vendre tes services.",
  },
];

export interface ChampAuth {
  nom: string;
  label: string;
  placeholder: string;
  type: "text" | "email" | "password";
  pleineLargeur: boolean;
  jauge?: boolean;
}

export function AuthForm({
  mode,
  titre,
  sousTitre,
  cta,
  libelleCase,
  champs,
  action,
  texteBas,
  lienBas,
  libelleLienBas,
  avecMotDePasseOublie = false,
  fournisseurs = [],
  annonce,
}: {
  mode: "connexion" | "inscription" | "oubli";
  titre: string;
  sousTitre: string;
  cta: string;
  libelleCase: string;
  champs: ChampAuth[];
  action: (etat: EtatFormulaire, donnees: FormData) => Promise<EtatFormulaire>;
  texteBas: string;
  lienBas: string;
  libelleLienBas: string;
  avecMotDePasseOublie?: boolean;
  /** Message porté par l'URL — l'arrivée depuis un autre écran. */
  annonce?: string;
  /** Moyens secondaires. Ceux qui ne sont pas configurés restent affichés. */
  fournisseurs?: FournisseurPublic[];
}) {
  const [etat, envoyer, enCours] = useActionState(action, {});
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");

  const [bientot, setBientot] = useState<string | null>(null);

  // ──────────────────────────────────────────────────────────────────────
  // CE CHOIX N'ACCORDE AUCUN DROIT
  //
  // `lib/auth/roles.ts` pose qu'il n'existe **aucune colonne de rôle** : on ne
  // devient pas créateur parce qu'on l'a déclaré, mais parce qu'on a publié
  // quelque chose. Ce choix ne change donc pas ce qu'on a le droit de faire —
  // il dit seulement où l'on veut atterrir, et l'inscription y mène.
  //
  // Un compte « acheteur » qui publie devient créateur sans rien redemander,
  // et l'inverse est vrai aussi.
  const [compte, setCompte] = useState<"acheteur" | "createur">("acheteur");

  const force = forceMotDePasse(motDePasse);
  // La maquette dessine la jauge en orange / jaune / blanc, mais elle la montre
  // FIGÉE. En mouvement, un troisième segment blanc ne se distingue pas d'un
  // segment vide — la jauge plafonnerait visuellement à deux niveaux sur trois.
  // Le niveau fort passe donc à l'encre.
  const couleursJauge = [ORANGE, JAUNE, ENCRE];

  const onglet = (href: string, label: string, actif: boolean) => (
    <a
      href={href}
      style={{
        flex: "1 1 0",
        textAlign: "center",
        padding: "11px 8px",
        borderRadius: 11,
        fontSize: 13.5,
        fontWeight: 800,
        background: actif ? ENCRE : "transparent",
        color: actif ? BLANC : ENCRE,
      }}
    >
      {label}
    </a>
  );

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: 5,
          border: CADRE,
          borderRadius: 16,
          background: LAVANDE_CLAIR,
        }}
      >
        {onglet("/connexion", "Se connecter", mode === "connexion")}
        {onglet("/inscription", "Créer un compte", mode === "inscription")}
      </div>

      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(26px,3vw,36px)",
          lineHeight: 1,
          letterSpacing: "-1.4px",
          margin: "22px 0 0",
          textTransform: "uppercase",
        }}
      >
        {titre}
      </h2>
      <p
        style={{
          fontSize: 14.5,
          fontWeight: 500,
          lineHeight: 1.45,
          margin: "8px 0 0",
          opacity: 0.75,
        }}
      >
        {sousTitre}
      </p>

      <form action={envoyer}>
        {mode === "inscription" ? (
          <>
            <input type="hidden" name="compte" value={compte} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                gap: 12,
                marginTop: 20,
              }}
            >
              {TYPES_DE_COMPTE.map((t) => {
                const actif = t.cle === compte;
                return (
                  <button
                    key={t.cle}
                    type="button"
                    onClick={() => setCompte(t.cle)}
                    aria-pressed={actif}
                    style={{
                      textAlign: "left",
                      border: CADRE,
                      borderRadius: 18,
                      padding: 14,
                      cursor: "pointer",
                      background: actif ? JAUNE : LAVANDE_CLAIR,
                      boxShadow: actif ? `4px 4px 0 ${ENCRE}` : undefined,
                      fontFamily: "inherit",
                      color: ENCRE,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          border: `2px solid ${ENCRE}`,
                          borderRadius: 9,
                          background: BLANC,
                          display: "grid",
                          placeItems: "center",
                          fontSize: 13,
                        }}
                      >
                        {t.glyphe}
                      </div>
                      <div style={{ fontSize: 14.5, fontWeight: 800 }}>{t.label}</div>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        lineHeight: 1.4,
                        marginTop: 8,
                        opacity: 0.75,
                      }}
                    >
                      {t.indice}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2,minmax(0,1fr))",
            gap: 12,
            marginTop: 20,
          }}
        >
          {champs.map((f) => {
            const estMotDePasse = f.type === "password";
            const enErreur = etat.champ === f.nom;

            return (
              <div
                key={f.nom}
                style={{
                  gridColumn: f.pleineLargeur ? "1 / span 2" : "auto",
                  minWidth: 0,
                }}
              >
                <label
                  htmlFor={f.nom}
                  style={{
                    display: "block",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    textTransform: "uppercase",
                    letterSpacing: ".12em",
                    opacity: 0.6,
                    marginBottom: 6,
                  }}
                >
                  {f.label}
                </label>
                <div
                  style={{ position: "relative", display: "flex", alignItems: "center" }}
                >
                  <input
                    id={f.nom}
                    name={f.nom}
                    type={
                      estMotDePasse && motDePasseVisible ? "text" : f.type
                    }
                    placeholder={f.placeholder}
                    autoComplete={
                      f.type === "email"
                        ? "email"
                        : estMotDePasse
                          ? mode === "inscription"
                            ? "new-password"
                            : "current-password"
                          : "on"
                    }
                    onChange={
                      f.jauge ? (e) => setMotDePasse(e.target.value) : undefined
                    }
                    aria-invalid={enErreur || undefined}
                    style={{
                      width: "100%",
                      minWidth: 0,
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      fontWeight: 500,
                      padding: "13px 15px",
                      border: enErreur
                        ? `2.5px solid ${ORANGE}`
                        : CADRE,
                      borderRadius: 14,
                      background: LAVANDE_CLAIR,
                      outline: "none",
                    }}
                  />
                  {estMotDePasse ? (
                    <button
                      type="button"
                      onClick={() => setMotDePasseVisible((v) => !v)}
                      style={{
                        position: "absolute",
                        right: 10,
                        padding: "5px 9px",
                        border: `2px solid ${ENCRE}`,
                        borderRadius: 9,
                        background: BLANC,
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {motDePasseVisible ? "MASQUER" : "VOIR"}
                    </button>
                  ) : null}
                </div>

                {f.jauge ? (
                  <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        style={{
                          flex: "1 1 0",
                          height: 8,
                          border: `2px solid ${ENCRE}`,
                          borderRadius: 99,
                          background: i < force ? couleursJauge[i] : BLANC,
                        }}
                      />
                    ))}
                    <span
                      style={{
                        flex: "0 0 auto",
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        opacity: 0.6,
                        marginLeft: 4,
                      }}
                    >
                      {motDePasse.length > 0
                        ? libelleForce(motDePasse).toUpperCase()
                        : `${LONGUEUR_MOT_DE_PASSE_MIN} CAR. MIN.`}
                    </span>
                  </div>
                ) : null}
                {f.jauge && manqueAuMotDePasse(motDePasse) ? (
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#B34A1F",
                    }}
                  >
                    {manqueAuMotDePasse(motDePasse)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 18,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
              maxWidth: 340,
            }}
          >
            <input
              type="checkbox"
              name="conditions"
              style={{
                width: 24,
                height: 24,
                flex: "0 0 auto",
                accentColor: JAUNE,
                border: CADRE,
                borderRadius: 8,
              }}
            />
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                lineHeight: 1.35,
                opacity: 0.85,
              }}
            >
              {libelleCase}
            </span>
          </label>
          {avecMotDePasseOublie ? (
            <Link
              href="/mot-de-passe-oublie"
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: ORANGE,
                textDecoration: "underline",
              }}
            >
              Mot de passe oublié ?
            </Link>
          ) : null}
        </div>

        {etat.succes ?? annonce ? (
          <div
            role="status"
            style={{
              marginTop: 14,
              padding: "13px 15px",
              border: CADRE,
              borderRadius: 14,
              background: JAUNE,
              fontSize: 13,
              fontWeight: 700,
              animation: "popin .16s ease-out",
            }}
          >
            {etat.succes ?? annonce}
          </div>
        ) : null}

        {etat.erreur ? (
          <div
            role="alert"
            style={{
              marginTop: 14,
              padding: "13px 15px",
              border: CADRE,
              borderRadius: 14,
              background: ORANGE,
              color: BLANC,
              fontSize: 13,
              fontWeight: 700,
              animation: "popin .16s ease-out",
            }}
          >
            {etat.erreur}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={enCours}
          className="sticker-press"
          style={{
            width: "100%",
            marginTop: 20,
            padding: 16,
            border: CADRE,
            borderRadius: 16,
            background: JAUNE,
            boxShadow: `5px 5px 0 ${ENCRE}`,
            textAlign: "center",
            fontSize: 15.5,
            fontWeight: 800,
            cursor: enCours ? "wait" : "pointer",
          }}
        >
          {enCours ? "Un instant…" : cta}
        </button>
      </form>

      {fournisseurs.length > 0 ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "22px 0 16px",
            }}
          >
            <span style={{ flex: "1 1 auto", height: 2.5, background: ENCRE }} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: ".12em",
                opacity: 0.6,
              }}
            >
              ou continuer avec
            </span>
            <span style={{ flex: "1 1 auto", height: 2.5, background: ENCRE }} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,minmax(0,1fr))",
              gap: 10,
            }}
          >
            {fournisseurs.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  f.actif
                    ? (window.location.href = `/api/auth/${f.id}`)
                    : setBientot(f.label)
                }
                aria-disabled={!f.actif}
                title={f.actif ? undefined : "Bientôt disponible"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 8px",
                  border: CADRE,
                  borderRadius: 14,
                  background: f.actif ? BLANC : LAVANDE_CLAIR,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  // Un moyen non branché reste lisible : il est estompé, pas
                  // effacé. La personne doit pouvoir le voir et comprendre
                  // pourquoi il ne répond pas.
                  opacity: f.actif ? 1 : 0.62,
                }}
              >
                <span
                  style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}
                >
                  {f.glyph}
                </span>
                {f.label}
              </button>
            ))}
          </div>

          {bientot ? (
            <div
              role="status"
              style={{
                marginTop: 14,
                padding: "13px 15px",
                border: CADRE,
                borderRadius: 14,
                background: ENCRE,
                color: BLANC,
                fontSize: 13,
                fontWeight: 700,
                animation: "popin .16s ease-out",
              }}
            >
              {bientot} — bientôt disponible. En attendant, l&apos;e-mail et le
              mot de passe fonctionnent.
            </div>
          ) : null}
        </>
      ) : null}

      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          textAlign: "center",
          marginTop: 20,
          opacity: 0.8,
        }}
      >
        {texteBas}{" "}
        <a
          href={lienBas}
          style={{
            fontWeight: 800,
            color: ORANGE,
            textDecoration: "underline",
          }}
        >
          {libelleLienBas}
        </a>
      </div>
    </>
  );
}
