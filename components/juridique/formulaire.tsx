"use client";

import { useActionState, useState } from "react";

import {
  deposerUneNotification,
  type EtatDepot,
} from "@/lib/juridique/actions";
import type { Manque, Saisie } from "@/lib/juridique/article47";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Déposer une notification.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES CHAMPS CHANGENT SELON QU'ON EST UNE PERSONNE OU UNE ORGANISATION
 *
 * L'article 47 demande six éléments à une personne physique — nom, prénoms,
 * profession, domicile, nationalité, date et lieu de naissance — et deux
 * seulement à une personne morale : dénomination et siège social.
 *
 * Afficher les six à tout le monde ferait remplir à une entreprise une date de
 * naissance qu'elle n'a pas, et ferait croire qu'on l'exige. Les champs de
 * personne physique disparaissent donc quand on coche « organisation ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RIEN N'EST REVALIDÉ ICI
 *
 * Aucune longueur minimale, aucune expression régulière. Les six exigences
 * vivent dans `lib/juridique/article47.ts`, et les répéter au navigateur ferait
 * deux endroits à changer le jour où la loi bouge — avec la certitude qu'on en
 * oubliera un. Sur un formulaire juridique, cet oubli-là se paierait.
 *
 * `required` n'est PAS un raccourci d'affichage : le navigateur refuse
 * d'envoyer. Posé sur les éléments de l'article 47, il empêchait d'enregistrer
 * ce que ce module promet d'enregistrer — une notification sans motifs ou sans
 * correspondance préalable ne partait jamais (mesuré le 25/09, Qualitytest
 * R41, R43). Il ne reste donc que sur le courriel : la loi ne l'exige pas,
 * mais sans lui personne ne peut répondre au notifiant, et un formulaire
 * vide ne consomme pas une référence.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE NOTIFICATION INCOMPLÈTE EST ENREGISTRÉE, ET LE DIT
 *
 * Elle reçoit sa référence et sa date. Ce qui manque est listé, champ par
 * champ. Refuser en bloc obligerait à tout ressaisir, et ferait perdre la date
 * de première tentative — celle qui compte devant un juge.
 */
export function FormulaireNotification() {
  const [etat, envoyer, enCours] = useActionState<EtatDepot | null, FormData>(
    deposerUneNotification,
    null,
  );
  const [morale, setMorale] = useState(false);
  const [injoignable, setInjoignable] = useState(false);

  if (etat?.ok && etat.complete) {
    return (
      <Recu reference={etat.reference}>
        <p style={P}>
          Elle est complète. Nous l&apos;examinons, et le contenu visé sera
          retiré le temps de cet examen s&apos;il y a lieu. La personne
          concernée sera prévenue par courriel, avec ton motif tel que tu
          l&apos;as écrit.
        </p>
        <p style={{ ...P, fontSize: 13.5, opacity: 0.75 }}>
          Conserve cette référence : c&apos;est elle qu&apos;il faudra citer
          dans toute correspondance.
        </p>
      </Recu>
    );
  }

  const manques = etat?.ok && !etat.complete ? etat.manques : [];
  const manque = (champ: keyof Saisie) =>
    manques.find((m) => m.champ === champ)?.message;

  return (
    <>
      {etat?.ok && !etat.complete ? (
        <Recu reference={etat.reference} incomplete>
          <p style={P}>
            Elle est enregistrée, avec sa date — mais il lui manque{" "}
            {manques.length === 1 ? "un élément" : `${manques.length} éléments`}{" "}
            que la loi exige. Tant qu&apos;ils manquent, nous ne pouvons pas la
            traiter : l&apos;article 47 dit que notre obligation d&apos;agir ne
            commence qu&apos;une fois la notification complète.
          </p>
          <ul style={{ margin: "10px 0 0", paddingLeft: 20, display: "grid", gap: 6 }}>
            {manques.map((m: Manque) => (
              <li key={m.champ} style={{ fontSize: 14, lineHeight: 1.5 }}>
                {m.message}
              </li>
            ))}
          </ul>
        </Recu>
      ) : null}

      {etat && !etat.ok ? (
        <p style={{ ...P, color: ORANGE, fontWeight: 700 }}>{etat.message}</p>
      ) : null}

      <form action={envoyer} style={{ display: "grid", gap: 26 }}>
        {/* ── Qui notifie ────────────────────────────────────────────── */}
        <Bloc titre="Qui tu es" note="Article 47, premier et deuxième tirets">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <Bascule active={!morale} onClick={() => setMorale(false)}>
              Une personne
            </Bascule>
            <Bascule active={morale} onClick={() => setMorale(true)}>
              Une organisation
            </Bascule>
          </div>
          <input type="hidden" name="qualite" value={morale ? "PERSONNE_MORALE" : "PERSONNE_PHYSIQUE"} />

          <Champ
            libelle={morale ? "Dénomination" : "Nom"}
            erreur={manque("nom")}
          >
            <input name="nom" maxLength={120} style={CHAMP} />
          </Champ>

          {!morale ? (
            <>
              <Champ libelle="Prénoms" erreur={manque("prenoms")}>
                <input name="prenoms" maxLength={120} style={CHAMP} />
              </Champ>
              <Champ libelle="Profession" erreur={manque("profession")}>
                <input name="profession" maxLength={120} style={CHAMP} />
              </Champ>
              <Champ libelle="Nationalité" erreur={manque("nationalite")}>
                <input name="nationalite" maxLength={80} style={CHAMP} />
              </Champ>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Champ libelle="Date de naissance" erreur={manque("naissanceDate")}>
                  <input name="naissanceDate" type="date" style={CHAMP} />
                </Champ>
                <Champ libelle="Lieu de naissance" erreur={manque("naissanceLieu")}>
                  <input name="naissanceLieu" maxLength={120} style={CHAMP} />
                </Champ>
              </div>
            </>
          ) : (
            <p style={{ ...P, fontSize: 13, opacity: 0.7 }}>
              La loi ivoirienne ne demande à une organisation que sa
              dénomination et son siège social. Ni forme juridique, ni organe
              représentant — ce sont les exigences sénégalaises, et nous ne les
              ajoutons pas.
            </p>
          )}

          <Champ
            libelle={morale ? "Siège social" : "Domicile"}
            erreur={manque("adresse")}
          >
            <textarea name="adresse" rows={2} maxLength={300} style={CHAMP} />
          </Champ>

          <Champ
            libelle="Adresse électronique"
            aide="Pour l'accusé de réception et la décision. La loi ne l'exige pas ; sans elle nous ne pouvons pas te répondre."
            erreur={manque("courriel")}
          >
            <input name="courriel" type="email" required maxLength={200} style={CHAMP} />
          </Champ>
        </Bloc>

        {/* ── Qui est visé ───────────────────────────────────────────── */}
        <Bloc titre="Qui est visé" note="Article 47, troisième tiret">
          <Champ
            libelle="Nom ou dénomination"
            aide="Tel qu'il apparaît sur le contenu. Un pseudonyme suffit."
            erreur={manque("destinataireNom")}
          >
            <input name="destinataireNom" maxLength={120} style={CHAMP} />
          </Champ>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Champ libelle="Prénoms, si tu les connais">
              <input name="destinatairePrenoms" maxLength={120} style={CHAMP} />
            </Champ>
            <Champ libelle="Domicile, si tu le connais">
              <input name="destinataireAdresse" maxLength={300} style={CHAMP} />
            </Champ>
          </div>
        </Bloc>

        {/* ── Les faits ─────────────────────────────────────────────── */}
        <Bloc titre="Ce qui est litigieux, et où" note="Article 47, quatrième tiret">
          <Champ libelle="Décris les faits" erreur={manque("faits")}>
            <textarea name="faits" rows={4} maxLength={4000} style={CHAMP} />
          </Champ>

          <Champ
            libelle="Adresses exactes"
            aide="Une par ligne. La loi demande une « localisation précise sur le réseau » : nous ne retirerons pas des pages que personne n'a regardées."
            erreur={manque("adressesVisees")}
          >
            <textarea
              name="adressesVisees"
              rows={3}
              placeholder="https://baobart.ci/products/…"
              style={{ ...CHAMP, fontFamily: "var(--font-mono)", fontSize: 13.5 }}
            />
          </Champ>
        </Bloc>

        {/* ── Les motifs ────────────────────────────────────────────── */}
        <Bloc titre="Le droit que tu invoques" note="Article 47, cinquième tiret">
          <Champ
            libelle="Quel droit, et pourquoi il s'applique ici"
            aide="Droit d'auteur, marque, vie privée, diffamation… et ce qui te fait dire qu'il s'applique."
            erreur={manque("motifs")}
          >
            <textarea name="motifs" rows={4} maxLength={4000} style={CHAMP} />
          </Champ>
        </Bloc>

        {/* ── La correspondance préalable ────────────────────────────── */}
        <Bloc
          titre="Ce que tu as écrit à l'auteur"
          note="Article 47, sixième tiret"
        >
          <p style={{ ...P, fontSize: 13.5 }}>
            La loi ivoirienne exige que tu aies d&apos;abord demandé à
            l&apos;auteur de retirer, d&apos;interrompre ou de modifier — ou que
            tu expliques pourquoi tu n&apos;as pas pu le joindre. La loi
            américaine ne le demande pas ; celle-ci, si.
          </p>

          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              fontSize: 14,
              fontWeight: 700,
              margin: "4px 0 10px",
            }}
          >
            <input
              type="checkbox"
              name="contactImpossible"
              checked={injoignable}
              onChange={(e) => setInjoignable(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            Je n&apos;ai pas pu joindre l&apos;auteur
          </label>

          <Champ
            libelle={
              injoignable
                ? "Pourquoi tu n'as pas pu le joindre"
                : "Copie de ce que tu lui as écrit"
            }
            erreur={manque("contactPrealable")}
          >
            <textarea name="contactPrealable" rows={5} maxLength={6000} style={CHAMP} />
          </Champ>
        </Bloc>

        {/* ── Article 49 ────────────────────────────────────────────── */}
        <div
          style={{
            border: CADRE,
            borderRadius: 18,
            background: ORANGE,
            padding: 22,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: ".12em",
              marginBottom: 8,
            }}
          >
            Avant d&apos;envoyer — article 49
          </div>
          <p style={{ ...P, margin: 0, fontSize: 14.5, fontWeight: 600 }}>
            Présenter de mauvaise foi un contenu comme illicite pour en obtenir
            le retrait est puni de <strong>un à cinq ans d&apos;emprisonnement
            et de 1 à 5 millions de francs CFA</strong>. Si tu hésites sur tes
            droits, écris-nous plutôt que de déposer.
          </p>
        </div>

        <div>
          <button
            type="submit"
            disabled={enCours}
            className="sticker-press"
            style={{
              padding: "15px 30px",
              border: CADRE,
              borderRadius: 16,
              background: enCours ? GRIS : ENCRE,
              color: BLANC,
              fontSize: 15,
              fontWeight: 800,
              cursor: enCours ? "progress" : "pointer",
            }}
          >
            {enCours ? "…" : "Déposer la notification"}
          </button>
        </div>
      </form>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════ pièces ══

const P: React.CSSProperties = { fontSize: 15, lineHeight: 1.55, margin: "0 0 10px" };

const CHAMP: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  border: CADRE,
  borderRadius: 12,
  background: BLANC,
  fontSize: 15,
  fontFamily: "inherit",
};

function Recu({
  reference,
  incomplete,
  children,
}: {
  reference: string;
  incomplete?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 22,
        background: incomplete ? JAUNE : VERT,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 28,
        marginBottom: 26,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: ".12em",
          opacity: 0.7,
        }}
      >
        {incomplete ? "Enregistrée, incomplète" : "Notification reçue"}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 30,
          lineHeight: 1.1,
          margin: "8px 0 14px",
        }}
      >
        {reference}
      </div>
      {children}
    </div>
  );
}

function Bloc({
  titre,
  note,
  children,
}: {
  titre: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset
      style={{
        border: CADRE,
        borderRadius: 20,
        background: BLANC,
        padding: 24,
        display: "grid",
        gap: 14,
        margin: 0,
      }}
    >
      <legend style={{ padding: "0 10px" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>{titre}</span>
      </legend>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          opacity: 0.6,
          marginTop: -8,
        }}
      >
        {note}
      </div>
      {children}
    </fieldset>
  );
}

function Champ({
  libelle,
  aide,
  erreur,
  children,
}: {
  libelle: string;
  aide?: string;
  erreur?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{libelle}</span>
      {aide ? (
        <span style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.45 }}>{aide}</span>
      ) : null}
      {children}
      {erreur ? (
        <span style={{ fontSize: 12.5, fontWeight: 700, color: ORANGE }}>{erreur}</span>
      ) : null}
    </label>
  );
}

function Bascule({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "9px 18px",
        border: CADRE,
        borderRadius: 999,
        background: active ? ENCRE : BLANC,
        color: active ? BLANC : ENCRE,
        fontSize: 13.5,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
