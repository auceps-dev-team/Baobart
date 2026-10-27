"use client";

import { useActionState, useEffect, useState } from "react";

import {
  demanderCodeVersement,
  enregistrerCadence,
  enregistrerCompteDeVersement,
  type EtatCode,
  type EtatCompte,
} from "@/lib/payments/actions";
import {
  CADENCES,
  MOYENS_VERSEMENT,
  type CodeCadence,
} from "@/lib/payments/cadences";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const LAVANDE = "#EADFF9";
const LILAS = "#F4EEFC";
const ORANGE_SOMBRE = "#B34A1F";
const CADRE = `2.5px solid ${ENCRE}`;

const TITRE = {
  fontFamily: "var(--font-display)",
  fontSize: 19,
  textTransform: "uppercase" as const,
  letterSpacing: "-.4px",
};

const ETIQUETTE = {
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  textTransform: "uppercase" as const,
  letterSpacing: ".12em",
  opacity: 0.6,
};

const CHAMP = {
  width: "100%",
  minWidth: 0,
  fontFamily: "var(--font-body)",
  fontSize: 13.5,
  fontWeight: 500,
  padding: "12px 14px",
  border: CADRE,
  borderRadius: 13,
  background: LILAS,
  outline: "none",
};

function Carte({
  fond = BLANC,
  children,
}: {
  fond?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: CADRE,
        borderRadius: 24,
        background: fond,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 22,
      }}
    >
      {children}
    </section>
  );
}

/**
 * Le compte de versement.
 *
 * Chaque moyen annonce son terrain et son jour : le vendeur choisit en sachant
 * quand il sera payé, pas seulement par qui. Le libellé du champ suit le moyen
 * — demander un « identifiant » pour un numéro Wave fait hésiter.
 */
function CompteDeVersement({
  actuel,
  facteur,
}: {
  actuel: { label: string; apercu: string; code: string; titulaire: string | null } | null;
  /** Le second facteur que l'action attendra (`facteurPropose`, lib/payments/preuve.ts). */
  facteur: "TOTP" | "COURRIEL";
}) {
  const [etat, envoyer, enCours] = useActionState<EtatCompte | null, FormData>(
    enregistrerCompteDeVersement,
    null,
  );
  const [demande, demander, enDemande] = useActionState<EtatCode | null, FormData>(demanderCodeVersement, null);

  // Contrôlés : React vide les champs non contrôlés à la fin de CHAQUE action
  // du formulaire — demander le code effacerait le numéro qu'il doit confirmer.
  const [reference, setReference] = useState("");
  const [titulaire, setTitulaire] = useState(actuel?.titulaire ?? "");

  // Le formulaire reste replié tant qu'un compte existe : la maquette ouvre par
  // un rappel de l'état, pas par une invitation à en changer.
  const [ouvert, setOuvert] = useState(actuel === null);
  const [moyen, setMoyen] = useState(actuel?.code ?? MOYENS_VERSEMENT[0].code);

  // Enregistré : le formulaire se referme, et le code qui a servi n'est plus
  // annoncé comme « envoyé » à sa réouverture — il est consommé.
  const [codeConsomme, setCodeConsomme] = useState<EtatCode | null>(null);
  useEffect(() => {
    if (etat?.ok) {
      setOuvert(false);
      setReference("");
      setCodeConsomme(demande);
    }
    // `demande` est lu, pas suivi : seul un nouvel enregistrement compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat]);
  const demandeVisible = demande === codeConsomme ? null : demande;

  const choisi = MOYENS_VERSEMENT.find((m) => m.code === moyen) ?? MOYENS_VERSEMENT[0];
  const refus = etat && !etat.ok ? etat : null;

  return (
    <Carte>
      <div style={TITRE}>Compte de versement</div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 14,
          marginTop: 16,
          padding: 16,
          border: CADRE,
          borderRadius: 18,
          background: actuel ? LILAS : JAUNE,
        }}
      >
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.3 }}>
            {actuel ? `${actuel.label} ${actuel.apercu}` : "Aucun compte enregistré"}
          </div>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              lineHeight: 1.45,
              marginTop: 6,
              opacity: 0.75,
              textWrap: "pretty",
            }}
          >
            {actuel
              ? `Au nom de ${actuel.titulaire ?? "—"}. En enregistrer un nouveau remplace celui-ci ; les versements déjà partis gardent l'ancien.`
              : "Sans compte enregistré, aucun versement ne peut partir. Ton solde reste acquis en attendant."}
          </div>
        </div>

        {actuel ? (
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            style={{
              flex: "0 0 auto",
              padding: "9px 14px",
              border: `2px solid ${ENCRE}`,
              borderRadius: 11,
              background: BLANC,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".06em",
              cursor: "pointer",
            }}
          >
            {ouvert ? "ANNULER" : "CHANGER DE COMPTE"}
          </button>
        ) : null}
      </div>

      {ouvert ? (
        <form action={envoyer}>
          {/*
            Le moyen part ICI, pas par les boutons radio. React remet le
            formulaire à zéro après chaque action, et un radio revient alors à
            celui coché au rendu — l'ancien compte — pendant que l'écran, qui
            lit l'état, montre toujours le nouveau. Mesuré le 24/10 : « wave »
            coché avant de demander un code, « moov » après. Le numéro
            partait sous le mauvais opérateur. Un champ caché garde sa valeur :
            pour lui, valeur et valeur par défaut sont la même.
          */}
          <input type="hidden" name="provider" value={moyen} />
          <div style={{ ...ETIQUETTE, margin: "20px 0 9px" }}>
            Moyen de versement
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MOYENS_VERSEMENT.map((m) => (
              <label
                key={m.code}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 15px",
                  border: CADRE,
                  borderRadius: 14,
                  cursor: "pointer",
                  background: m.code === moyen ? ENCRE : BLANC,
                  color: m.code === moyen ? BLANC : ENCRE,
                }}
              >
                <input
                  type="radio"
                  name="provider-choix"
                  value={m.code}
                  checked={m.code === moyen}
                  onChange={() => setMoyen(m.code)}
                  style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                />
                <span style={{ flex: "0 1 auto", fontSize: 14, fontWeight: 800 }}>
                  {m.label}
                </span>
                <span
                  style={{
                    flex: "1 1 160px",
                    minWidth: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    textAlign: "right",
                    opacity: 0.7,
                  }}
                >
                  {m.terrain} · versement le {m.jour}
                </span>
              </label>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 14,
              marginTop: 18,
            }}
          >
            <div>
              <div style={{ ...ETIQUETTE, marginBottom: 6 }}>{choisi.champ}</div>
              <input
                name="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={choisi.exemple}
                style={CHAMP}
              />
            </div>
            <div>
              <div style={{ ...ETIQUETTE, marginBottom: 6 }}>Nom du titulaire</div>
              <input
                id="titulaire"
                name="titulaire"
                value={titulaire}
                onChange={(e) => setTitulaire(e.target.value)}
                placeholder="Awa Diallo"
                style={CHAMP}
              />
            </div>
            <div>
              <div style={{ ...ETIQUETTE, marginBottom: 6 }}>
                {facteur === "TOTP"
                  ? "Code de ton application (ou code de secours)"
                  : "Code reçu par courriel"}
              </div>
              <input
                id="code2FA"
                name="code2FA"
                placeholder="123456"
                inputMode={facteur === "TOTP" ? undefined : "numeric"}
                autoComplete="one-time-code"
                style={CHAMP}
              />
            </div>
          </div>

          {/*
            Le second facteur, sans application à installer (décidé le 23/10) :
            le code part à l'adresse du compte, lié au numéro saisi ci-dessus.
            Il faut donc saisir le numéro AVANT de le demander.
          */}
          {facteur === "COURRIEL" ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 14 }}>
              <button
                type="submit"
                formAction={demander}
                disabled={enDemande}
                style={{
                  padding: "11px 16px",
                  border: CADRE,
                  borderRadius: 12,
                  background: BLANC,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: enDemande ? "wait" : "pointer",
                }}
              >
                {enDemande ? "Envoi…" : demandeVisible?.ok ? "Renvoyer un code" : "Recevoir un code par courriel"}
              </button>
              <span role="status" style={{ fontSize: 12.5, fontWeight: 700, color: demandeVisible && !demandeVisible.ok ? ORANGE_SOMBRE : ENCRE }}>
                {demandeVisible?.ok
                  ? `Code envoyé à ${demandeVisible.vers}. Il vaut 15 minutes, pour ce numéro seulement.`
                  : demandeVisible?.message ?? "Une clé d'accès utilisée il y a moins d'un quart d'heure dispense du code."}
              </span>
            </div>
          ) : null}

          {refus ? (
            <p
              role="alert"
              style={{
                margin: "14px 0 0",
                fontSize: 13,
                fontWeight: 700,
                color: ORANGE_SOMBRE,
              }}
            >
              {refus.message}
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 14,
              marginTop: 18,
            }}
          >
            <button
              type="submit"
              className="sticker-press"
              disabled={enCours}
              style={{
                padding: "14px 24px",
                border: CADRE,
                borderRadius: 14,
                background: JAUNE,
                boxShadow: `4px 4px 0 ${ENCRE}`,
                fontSize: 14,
                fontWeight: 800,
                cursor: enCours ? "wait" : "pointer",
                opacity: enCours ? 0.6 : 1,
              }}
            >
              {enCours
                ? "Enregistrement…"
                : actuel
                  ? "Remplacer le compte"
                  : "Enregistrer"}
            </button>
            <div
              style={{
                flex: "1 1 200px",
                minWidth: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                lineHeight: 1.5,
                opacity: 0.65,
              }}
            >
              {/*
                Les vingt-quatre heures ne sont pas une formule : `peutEtrePaye`
                refuse un compte plus récent que cela. L'écrire ici sans la règle
                aurait été promettre une vérification qui n'existe pas.
              */}
              {actuel
                ? "Remplacer archive l'ancien compte et déclenche une vérification de 24 h avant le prochain départ."
                : "Le premier enregistrement déclenche une vérification de 24 h avant le premier départ."}
            </div>
          </div>
        </form>
      ) : null}
    </Carte>
  );
}

function CadenceDesVersements({
  actuelle,
  jourDeVersement,
}: {
  actuelle: CodeCadence;
  jourDeVersement: string | null;
}) {
  const [etat, envoyer, enCours] = useActionState<EtatCompte | null, FormData>(
    enregistrerCadence,
    null,
  );
  const [choix, setChoix] = useState<CodeCadence>(actuelle);

  return (
    <Carte>
      <div style={TITRE}>Cadence des versements</div>

      <div
        style={{
          fontSize: 13.5,
          fontWeight: 700,
          lineHeight: 1.5,
          marginTop: 10,
          padding: "12px 14px",
          border: CADRE,
          borderRadius: 14,
          background: LAVANDE,
          textWrap: "pretty",
        }}
      >
        {jourDeVersement
          ? `Ton moyen de versement paie le ${jourDeVersement}. La cadence décide de la fréquence, le moyen décide du jour.`
          : "Enregistre d'abord un compte : c'est lui qui décide du jour de la semaine où l'argent part."}
      </div>

      <form action={envoyer}>
        {/* Même raison que le moyen de versement, plus haut : le choix part
            par un champ caché, que la remise à zéro du formulaire ne touche pas. */}
        <input type="hidden" name="cadence" value={choix} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 16,
          }}
        >
          {CADENCES.map((c) => (
            <label
              key={c.code}
              style={{
                display: "flex",
                gap: 13,
                padding: 15,
                border: CADRE,
                borderRadius: 16,
                cursor: "pointer",
                background: c.code === choix ? JAUNE : BLANC,
              }}
            >
              <input
                type="radio"
                name="cadence-choix"
                value={c.code}
                checked={c.code === choix}
                onChange={() => setChoix(c.code)}
                style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
              />
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  flex: "0 0 auto",
                  border: CADRE,
                  borderRadius: 99,
                  background: BLANC,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                }}
              >
                {c.code === choix ? "●" : ""}
              </span>
              <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 800 }}>
                  {c.libelle}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 500,
                    lineHeight: 1.45,
                    marginTop: 5,
                    opacity: 0.8,
                    textWrap: "pretty",
                  }}
                >
                  {c.aide}
                </span>
              </span>
            </label>
          ))}
        </div>

        {etat?.ok ? (
          <p role="status" style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 700 }}>
            Cadence enregistrée.
          </p>
        ) : null}

        <button
          type="submit"
          className="sticker-press"
          disabled={enCours}
          style={{
            marginTop: 16,
            padding: "13px 22px",
            border: CADRE,
            borderRadius: 14,
            background: ENCRE,
            color: BLANC,
            fontSize: 14,
            fontWeight: 800,
            cursor: enCours ? "wait" : "pointer",
            opacity: enCours ? 0.6 : 1,
          }}
        >
          {enCours ? "Enregistrement…" : "Enregistrer la cadence"}
        </button>
      </form>
    </Carte>
  );
}

export interface PanneauProps {
  actuel: { label: string; apercu: string; code: string; titulaire: string | null } | null;
  cadence: CodeCadence;
  jourDeVersement: string | null;
  facteur: "TOTP" | "COURRIEL";
}

/** Les deux réglages, côte à côte, comme la maquette les pose. */
export function PanneauVersement(props: PanneauProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))",
        gap: 20,
        alignItems: "start",
      }}
    >
      <CompteDeVersement actuel={props.actuel} facteur={props.facteur} />
      <CadenceDesVersements
        actuelle={props.cadence}
        jourDeVersement={props.jourDeVersement}
      />
    </div>
  );
}
