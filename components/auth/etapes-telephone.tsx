"use client";

import { useActionState, useEffect, useState } from "react";

import { ChampsAntiBot } from "@/components/auth/champs-antibot";
import { BLANC, ENCRE, JAUNE, ORANGE } from "@/components/shell/nav-data";
import type { EtatTelephone } from "@/lib/auth/actions-telephone";
import { PAYS, PAYS_PAR_DEFAUT } from "@/lib/payments/rails";

/**
 * Les deux étapes d'un code par SMS : le numéro, puis les six chiffres.
 *
 * Partagé par la connexion (`/connexion/telephone`) et par la vérification
 * d'un numéro dans le profil : les deux parcours ne diffèrent que par les
 * actions qu'ils appellent et par les mots qui les entourent.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'INDICATIF À CÔTÉ DU NUMÉRO, ET NON DEVINÉ
 *
 * « 07 00 00 00 00 » est un numéro ivoirien ou béninois selon le pays ; le
 * zéro de tête se garde chez l'un et tombe au Ghana (`lib/sms/numero.ts`).
 * Le deviner enverrait le code chez quelqu'un d'autre. On le demande, la Côte
 * d'Ivoire présélectionnée — et un numéro tapé en « +225… » l'emporte.
 */

type Action = (etat: EtatTelephone | null, donnees: FormData) => Promise<EtatTelephone>;

const CADRE = `2.5px solid ${ENCRE}`;

const etiquette = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textTransform: "uppercase" as const,
  letterSpacing: ".1em",
  opacity: 0.55,
  marginBottom: 7,
};

const champ = {
  width: "100%",
  padding: "13px 15px",
  border: CADRE,
  borderRadius: 14,
  background: BLANC,
  fontFamily: "inherit",
  fontSize: 15,
};

const boutonPlein = (enCours: boolean) => ({
  marginTop: 18,
  width: "100%",
  padding: "14px 18px",
  border: CADRE,
  borderRadius: 15,
  background: JAUNE,
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 800,
  cursor: enCours ? "wait" : "pointer",
  opacity: enCours ? 0.7 : 1,
});

function Message({ etat }: { etat: EtatTelephone | null }) {
  if (!etat?.erreur && !etat?.info) return null;
  return (
    <p
      role={etat.erreur ? "alert" : "status"}
      style={{
        marginTop: 12,
        marginBottom: 0,
        fontSize: 13.5,
        fontWeight: 700,
        color: etat.erreur ? ORANGE : ENCRE,
      }}
    >
      {etat.erreur ?? etat.info}
    </p>
  );
}

export function EtapesTelephone({
  demander,
  verifier,
  libelleEnvoi,
  libelleValidation,
  avecAntiBot = false,
}: {
  demander: Action;
  verifier: Action;
  libelleEnvoi: string;
  libelleValidation: string;
  /** Le champ leurre des formulaires publics (`lib/securite/antibot.ts`). */
  avecAntiBot?: boolean;
}) {
  const [etape, setEtape] = useState<"numero" | "code">("numero");
  const [masque, setMasque] = useState<string | undefined>(undefined);

  // Les actions rendent l'étape suivante : c'est le serveur qui sait si un
  // code est en attente, l'écran ne fait que suivre.
  //
  // Les actions serveur sont passées TELLES QUELLES à `useActionState`, sans
  // fonction qui les enveloppe : la connexion réussie se termine par une
  // redirection, et c'est Next qui doit la recevoir, pas une enveloppe.
  const [etatDemande, envoyerNumero, demandeEnCours] = useActionState(demander, null);
  const [etatCode, envoyerCode, codeEnCours] = useActionState(verifier, null);

  useEffect(() => {
    if (etatDemande?.etape) setEtape(etatDemande.etape);
    if (etatDemande?.numeroMasque) setMasque(etatDemande.numeroMasque);
  }, [etatDemande]);

  useEffect(() => {
    if (etatCode?.etape) setEtape(etatCode.etape);
  }, [etatCode]);

  if (etape === "code") {
    return (
      <form action={envoyerCode}>
        <Message etat={etatCode ?? etatDemande} />
        <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: "12px 0 16px" }}>
          {masque
            ? `Recopie les six chiffres reçus au ${masque}. Le code expire dans dix minutes.`
            : "Recopie les six chiffres reçus par SMS. Le code expire dans dix minutes."}
        </p>

        <label htmlFor="code-sms" style={etiquette}>
          Code reçu par SMS
        </label>
        <input
          id="code-sms"
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="123 456"
          style={{ ...champ, fontFamily: "var(--font-mono)", fontSize: 20, letterSpacing: ".18em" }}
        />

        <button type="submit" disabled={codeEnCours} style={boutonPlein(codeEnCours)}>
          {codeEnCours ? "Un instant…" : libelleValidation}
        </button>

        <button
          type="button"
          onClick={() => setEtape("numero")}
          style={{
            marginTop: 12,
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Changer de numéro, ou redemander un code
        </button>
      </form>
    );
  }

  return (
    <form action={envoyerNumero}>
      {avecAntiBot ? <ChampsAntiBot /> : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.6fr)", gap: 10 }}>
        <div>
          <label htmlFor="pays-sms" style={etiquette}>
            Pays
          </label>
          <select id="pays-sms" name="pays" defaultValue={PAYS_PAR_DEFAUT} style={champ}>
            {PAYS.map((p) => (
              <option key={p.code} value={p.code}>
                {`${p.label} (${p.indicatif})`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="numero-sms" style={etiquette}>
            Numéro
          </label>
          <input
            id="numero-sms"
            name="numero"
            type="tel"
            required
            autoComplete="tel-national"
            inputMode="tel"
            placeholder="07 00 00 00 00"
            style={champ}
          />
        </div>
      </div>

      <Message etat={etatCode?.etape === "numero" ? etatCode : etatDemande} />

      <button type="submit" disabled={demandeEnCours} style={boutonPlein(demandeEnCours)}>
        {demandeEnCours ? "Un instant…" : libelleEnvoi}
      </button>
    </form>
  );
}
