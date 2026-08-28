"use client";

import { useActionState, useState } from "react";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const LILAS = "#F4EEFC";
const ORANGE_SOMBRE = "#B34A1F";
const CADRE = `2.5px solid ${ENCRE}`;

const MONO = "var(--font-mono)";

const ETIQUETTE = {
  fontFamily: MONO,
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: ".1em",
  opacity: 0.55,
};

export type ResultatOps = { ok: true; message: string } | { ok: false; message: string };

/** Une action possible sur une ligne, telle que l'état la permet. */
export interface ActionOps {
  cle: string;
  libelle: string;
  fond: string;
  /** Quand l'action exige une saisie avant d'être permise. */
  demande?: { champ: string; etiquette: string; valeur?: string };
}

export interface LigneOps {
  id: string;
  /** Cinq colonnes, dans l'ordre des en-têtes. */
  colonnes: string[];
  etat: string;
  etatFond: string;
  etatEncre: string;
  /** Ce que l'état veut dire, en une phrase. */
  sens: string;
  motif?: string | null;
  /** Qui a fait quoi, quand — en petites capitales sous la ligne. */
  trace?: string | null;
  actions: ActionOps[];
  /** Affiché à la place des boutons quand l'état est terminal. */
  sansAction?: string;
}

export interface LegendeOps {
  code: string;
  fond: string;
  encre: string;
  nombre: number;
  sens: string;
}

export interface FiltreOps {
  code: string;
  libelle: string;
  actif: boolean;
  href: string;
}

/**
 * Le panneau d'opérations à états, partagé par les trois écrans qui en ont un.
 *
 * Il suit `Baobart Design/Baobart Dashboard.dc.html` : une légende où chaque
 * état porte le **nombre d'actions qu'il permet**, puis une liste où chaque
 * ligne n'offre que ces actions-là.
 *
 * Le parti pris de la maquette mérite d'être noté : le nombre d'actions dépend
 * de l'état, jamais du rôle. Un lecteur sans pouvoir voit les mêmes états et
 * les mêmes explications — il ne voit simplement pas les boutons. Cacher aussi
 * la légende lui ferait croire l'écran plus simple qu'il n'est.
 */
export function PanneauOperations({
  legendeTitre,
  legende,
  rechercherPlaceholder,
  filtres,
  colonnes,
  lignes,
  pied,
  peutAgir,
  executer,
}: {
  legendeTitre: string;
  legende: LegendeOps[];
  rechercherPlaceholder: string;
  filtres: FiltreOps[];
  colonnes: string[];
  lignes: LigneOps[];
  pied: string;
  peutAgir: boolean;
  executer: (
    ligneId: string,
    cle: string,
    precedent: ResultatOps | null,
    donnees: FormData,
  ) => Promise<ResultatOps>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <section
        style={{
          border: CADRE,
          borderRadius: 24,
          background: BLANC,
          boxShadow: `6px 6px 0 ${ENCRE}`,
          padding: 20,
        }}
      >
        <div
          style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}
        >
          <div style={{ flex: "1 1 auto", fontSize: 16, fontWeight: 800 }}>
            {legendeTitre}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, opacity: 0.6 }}>
            le chiffre indique le nombre d&apos;actions permises
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
            gap: 11,
            marginTop: 16,
          }}
        >
          {legende.map((l) => (
            <div
              key={l.code}
              style={{
                display: "flex",
                gap: 11,
                padding: 13,
                border: CADRE,
                borderRadius: 15,
                background: LILAS,
              }}
            >
              <div
                style={{
                  flex: "0 0 auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    padding: "5px 10px",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 999,
                    background: l.fond,
                    color: l.encre,
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {l.code}
                </div>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 99,
                    background: BLANC,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-display)",
                    fontSize: 11,
                  }}
                >
                  {l.nombre}
                </div>
              </div>
              <div
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  fontSize: 12.5,
                  fontWeight: 600,
                  lineHeight: 1.45,
                  opacity: 0.85,
                  textWrap: "pretty",
                }}
              >
                {l.sens}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          border: CADRE,
          borderRadius: 24,
          background: BLANC,
          boxShadow: `6px 6px 0 ${ENCRE}`,
          padding: 20,
        }}
      >
        <input
          placeholder={rechercherPlaceholder}
          aria-label={rechercherPlaceholder}
          style={{
            width: "100%",
            minWidth: 0,
            fontFamily: "var(--font-body)",
            fontSize: 12.5,
            fontWeight: 500,
            padding: "10px 14px",
            border: CADRE,
            borderRadius: 12,
            background: LILAS,
            outline: "none",
          }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {filtres.map((f) => (
            <a
              key={f.code}
              href={f.href}
              style={{
                padding: "7px 13px",
                border: `2px solid ${ENCRE}`,
                borderRadius: 999,
                fontFamily: MONO,
                fontSize: 10.5,
                fontWeight: 700,
                background: f.actif ? ENCRE : BLANC,
                color: f.actif ? BLANC : ENCRE,
                textDecoration: "none",
              }}
            >
              {f.libelle}
            </a>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 18,
          }}
        >
          {lignes.length === 0 ? (
            <p style={{ fontSize: 13.5, fontWeight: 600, opacity: 0.7 }}>
              Rien à afficher pour ce filtre.
            </p>
          ) : (
            lignes.map((l) => (
              <Ligne
                key={l.id}
                ligne={l}
                colonnes={colonnes}
                peutAgir={peutAgir}
                executer={executer}
              />
            ))
          )}
        </div>

        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            marginTop: 16,
            paddingTop: 14,
            borderTop: CADRE,
            opacity: 0.6,
          }}
        >
          {pied}
        </div>
      </section>
    </div>
  );
}

const LARGEURS = ["1 1 130px", "1.7 1 170px", "1.3 1 150px", "1 1 100px", "1 1 130px"];

function Ligne({
  ligne,
  colonnes,
  peutAgir,
  executer,
}: {
  ligne: LigneOps;
  colonnes: string[];
  peutAgir: boolean;
  executer: (
    ligneId: string,
    cle: string,
    precedent: ResultatOps | null,
    donnees: FormData,
  ) => Promise<ResultatOps>;
}) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 18,
        background: LILAS,
        padding: 15,
      }}
    >
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}
      >
        {colonnes.map((titre, i) => (
          <div key={titre} style={{ flex: LARGEURS[i] ?? "1 1 130px", minWidth: 0 }}>
            <div style={ETIQUETTE}>{titre}</div>
            <div
              style={{
                marginTop: i === 3 ? 2 : 3,
                fontFamily:
                  i === 3
                    ? "var(--font-display)"
                    : i === 1
                      ? "var(--font-body)"
                      : MONO,
                fontSize: i === 3 ? 16 : i === 1 ? 14 : i === 0 ? 12.5 : 12,
                fontWeight: i === 1 ? 800 : i === 0 ? 700 : 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                opacity: i === 2 || i === 4 ? 0.85 : 1,
              }}
            >
              {ligne.colonnes[i] ?? "—"}
            </div>
          </div>
        ))}

        <div
          style={{
            flex: "0 0 auto",
            padding: "7px 13px",
            border: CADRE,
            borderRadius: 999,
            background: ligne.etatFond,
            color: ligne.etatEncre,
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {ligne.etat}
        </div>
      </div>

      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.45,
          marginTop: 11,
          opacity: 0.7,
          textWrap: "pretty",
        }}
      >
        {ligne.sens}
      </div>

      {ligne.motif ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 11,
            padding: "11px 13px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 13,
            background: BLANC,
          }}
        >
          <div
            style={{
              flex: "0 0 auto",
              fontFamily: MONO,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".1em",
              paddingTop: 2,
              opacity: 0.55,
            }}
          >
            MOTIF
          </div>
          <div
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.45,
              textWrap: "pretty",
            }}
          >
            {ligne.motif}
          </div>
        </div>
      ) : null}

      {ligne.trace ? (
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10.5,
            lineHeight: 1.55,
            marginTop: 10,
            opacity: 0.6,
            textWrap: "pretty",
          }}
        >
          {ligne.trace}
        </div>
      ) : null}

      {ligne.actions.length === 0 && ligne.sansAction ? (
        <div
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "9px 15px",
            border: `2.5px dashed ${ENCRE}`,
            borderRadius: 13,
            background: BLANC,
            fontSize: 12.5,
            fontWeight: 700,
            opacity: 0.7,
          }}
        >
          {ligne.sansAction}
        </div>
      ) : null}

      {peutAgir && ligne.actions.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {ligne.actions.map((a) => (
            <Action key={a.cle} ligneId={ligne.id} action={a} executer={executer} />
          ))}
        </div>
      ) : null}

      {!peutAgir && ligne.actions.length > 0 ? (
        <div
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "9px 15px",
            border: `2.5px dashed ${ENCRE}`,
            borderRadius: 13,
            background: BLANC,
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          Lecture seule — le pouvoir{" "}
          <span style={{ fontFamily: MONO }}>agir_sur_l_exploitation</span> est
          requis.
        </div>
      ) : null}
    </div>
  );
}

function Action({
  ligneId,
  action,
  executer,
}: {
  ligneId: string;
  action: ActionOps;
  executer: (
    ligneId: string,
    cle: string,
    precedent: ResultatOps | null,
    donnees: FormData,
  ) => Promise<ResultatOps>;
}) {
  const lie = executer.bind(null, ligneId, action.cle);
  const [etat, envoyer, enCours] = useActionState<ResultatOps | null, FormData>(
    lie,
    null,
  );
  const [ouvert, setOuvert] = useState(false);

  const bouton = {
    padding: "11px 18px",
    border: CADRE,
    borderRadius: 13,
    background: action.fond,
    fontSize: 12.5,
    fontWeight: 800,
    cursor: enCours ? ("wait" as const) : ("pointer" as const),
    opacity: enCours ? 0.6 : 1,
  };

  // Sans saisie à faire, un seul bouton. Avec, on déplie : demander un motif
  // dans une invite du navigateur perdrait la saisie au moindre clic à côté,
  // et ces motifs sont précisément ce qu'on ne veut pas voir bâclé.
  if (!action.demande) {
    return (
      <form action={envoyer} style={{ display: "inline" }}>
        <button type="submit" className="sticker-press" disabled={enCours} style={bouton}>
          {enCours ? "…" : action.libelle}
        </button>
        <Message etat={etat} />
      </form>
    );
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        style={{ ...bouton, cursor: "pointer", opacity: 1 }}
      >
        {action.libelle}…
      </button>
    );
  }

  return (
    <form
      action={envoyer}
      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
    >
      <label style={{ fontSize: 11.5, fontWeight: 700 }}>
        <span style={{ opacity: 0.7 }}>{action.demande.etiquette} </span>
        <input
          name={action.demande.champ}
          defaultValue={action.demande.valeur}
          style={{
            width: 230,
            padding: "9px 11px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 11,
            background: BLANC,
            fontSize: 12.5,
          }}
        />
      </label>
      <button type="submit" className="sticker-press" disabled={enCours} style={bouton}>
        {enCours ? "…" : action.libelle}
      </button>
      <button
        type="button"
        onClick={() => setOuvert(false)}
        style={{
          padding: "11px 15px",
          border: `2px solid ${ENCRE}`,
          borderRadius: 13,
          background: BLANC,
          fontSize: 12.5,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Annuler
      </button>
      <Message etat={etat} />
    </form>
  );
}

function Message({ etat }: { etat: ResultatOps | null }) {
  if (!etat) return null;
  return (
    <span
      role={etat.ok ? "status" : "alert"}
      style={{
        marginLeft: 8,
        fontSize: 12,
        fontWeight: 700,
        color: etat.ok ? ENCRE : ORANGE_SOMBRE,
      }}
    >
      {etat.message}
    </span>
  );
}
