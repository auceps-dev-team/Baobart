"use client";

import { useActionState, useState } from "react";

import { enregistrerProfil, type EtatProfil } from "@/lib/profil/actions";
import type { Saisie } from "@/lib/profil/validation";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Le formulaire du profil public.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL NE VALIDE RIEN
 *
 * `lib/profil/validation.ts` est autorité. Ce qu'on met ici — `required`,
 * `maxLength` — n'est qu'un confort : un formulaire se contourne.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE CHANGEMENT D'ADRESSE S'ANNONCE AVANT, PAS APRÈS
 *
 * Modifier son nom d'utilisateur déplace sa vitrine : `/@ancien` cesse de
 * répondre. C'est permis — une personne mal nommée à l'inscription vit avec
 * cette adresse partout où on la cite — mais cela se découvre mal après coup.
 * L'avertissement n'apparaît donc qu'au moment où le champ change vraiment.
 */
export function FormulaireProfil({ depart }: { depart: Saisie }) {
  const [etat, envoyer, enCours] = useActionState<EtatProfil | null, FormData>(
    enregistrerProfil,
    null,
  );

  const v = etat && !etat.ok ? etat.saisie : depart;
  const [username, setUsername] = useState(depart.username);

  const changeDAdresse = username.trim() !== depart.username;
  const refus = etat && !etat.ok ? etat : null;

  return (
    <form
      action={envoyer}
      style={{ display: "grid", gap: 18, maxWidth: 900 }}
    >
      {refus ? (
        <div
          role="alert"
          style={{
            padding: "13px 15px",
            border: CADRE,
            borderRadius: 14,
            background: ORANGE,
            color: BLANC,
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {refus.message}
        </div>
      ) : null}

      {etat?.ok ? (
        <div
          role="status"
          style={{
            padding: "13px 15px",
            border: CADRE,
            borderRadius: 14,
            background: VERT,
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          Profil enregistré. Il est visible sur ta page publique.
        </div>
      ) : null}

      <Bloc titre="Qui tu es">
        <Champ label="Nom affiché" pour="nomAffiche">
          <input
            id="nomAffiche"
            name="nomAffiche"
            required
            maxLength={80}
            defaultValue={v.nomAffiche}
            key={`nom-${v.nomAffiche}`}
            style={entree}
          />
        </Champ>

        <Champ
          label="Nom d'utilisateur"
          pour="username"
          aide="C'est l'adresse de ta page : baobart.com/@ton-nom"
        >
          <input
            id="username"
            name="username"
            required
            maxLength={40}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={entree}
          />
        </Champ>

        {changeDAdresse ? (
          <div
            style={{
              gridColumn: "1 / span 2",
              padding: "12px 14px",
              border: CADRE,
              borderRadius: 14,
              background: JAUNE,
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.5,
              textWrap: "pretty",
            }}
          >
            Tu changes l&apos;adresse de ta page. <strong>/@{depart.username}</strong>{" "}
            cessera de répondre, et les liens déjà partagés ne mèneront plus
            nulle part.
          </div>
        ) : null}

        <Champ
          label="Présentation"
          pour="bio"
          aide="Quelques lignes : ce que tu fais, pour qui, ce qui te distingue."
          pleineLargeur
        >
          <textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={600}
            defaultValue={v.bio}
            key={`bio-${v.bio}`}
            style={{ ...entree, resize: "vertical" }}
          />
        </Champ>

        <Champ label="Ville" pour="ville">
          <input
            id="ville"
            name="ville"
            maxLength={80}
            defaultValue={v.ville}
            key={`ville-${v.ville}`}
            placeholder="Abidjan"
            style={entree}
          />
        </Champ>

        <Champ label="Pays" pour="pays" aide="Code à deux lettres : CI, SN, ML…">
          <input
            id="pays"
            name="pays"
            maxLength={2}
            defaultValue={v.pays}
            key={`pays-${v.pays}`}
            placeholder="CI"
            style={entree}
          />
        </Champ>
      </Bloc>

      <Bloc titre="Ce que tu proposes">
        <Champ label="Spécialité" pour="specialite">
          <input
            id="specialite"
            name="specialite"
            maxLength={80}
            defaultValue={v.specialite}
            key={`spe-${v.specialite}`}
            placeholder="Illustration éditoriale"
            style={entree}
          />
        </Champ>

        <Champ
          label="Disponibilité"
          pour="disponibilite"
          aide="En toutes lettres : « Oui, sous 2 semaines »."
        >
          <input
            id="disponibilite"
            name="disponibilite"
            maxLength={80}
            defaultValue={v.disponibilite}
            key={`dispo-${v.disponibilite}`}
            placeholder="Oui, sous 2 semaines"
            style={entree}
          />
        </Champ>

        <Champ
          label="Tarif journalier (F CFA)"
          pour="tarifJournalier"
          aide="Indicatif. Laisse vide pour ne pas l'afficher."
        >
          <input
            id="tarifJournalier"
            name="tarifJournalier"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={v.tarifJournalier}
            key={`tarif-${v.tarifJournalier}`}
            placeholder="45000"
            style={entree}
          />
        </Champ>
      </Bloc>

      <Bloc titre="Où l'on te trouve">
        <Champ label="Portfolio" pour="portfolio" aide="Adresse complète, en https://">
          <input
            id="portfolio"
            name="portfolio"
            type="url"
            maxLength={300}
            defaultValue={v.portfolio}
            key={`porte-${v.portfolio}`}
            placeholder="https://mon-site.example"
            style={entree}
          />
        </Champ>

        <Champ
          label="Instagram"
          pour="instagram"
          aide="Ton pseudo, ou colle l'adresse — on garde ce qu'il faut."
        >
          <input
            id="instagram"
            name="instagram"
            maxLength={80}
            defaultValue={v.instagram}
            key={`insta-${v.instagram}`}
            placeholder="awa.diallo"
            style={entree}
          />
        </Champ>

        <Champ label="Behance" pour="behance">
          <input
            id="behance"
            name="behance"
            maxLength={80}
            defaultValue={v.behance}
            key={`behance-${v.behance}`}
            placeholder="awadiallo"
            style={entree}
          />
        </Champ>
      </Bloc>

      <div>
        <button
          type="submit"
          disabled={enCours}
          className="sticker-press"
          style={{
            padding: "14px 24px",
            border: CADRE,
            borderRadius: 14,
            background: ENCRE,
            color: BLANC,
            fontSize: 14,
            fontWeight: 800,
            cursor: enCours ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {enCours ? "Enregistrement…" : "Enregistrer mon profil"}
        </button>
      </div>
    </form>
  );
}

const entree = {
  width: "100%",
  padding: "13px 15px",
  border: CADRE,
  borderRadius: 14,
  background: "#F4EEFC",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 500,
  outline: "none",
  color: ENCRE,
} as const;

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 22,
        background: BLANC,
        boxShadow: `5px 5px 0 ${ENCRE}`,
        padding: 22,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 17,
          textTransform: "uppercase",
          letterSpacing: "-.4px",
          marginBottom: 16,
        }}
      >
        {titre}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 16,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Champ({
  label,
  pour,
  aide,
  pleineLargeur = false,
  children,
}: {
  label: string;
  pour: string;
  aide?: string;
  pleineLargeur?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minWidth: 0, gridColumn: pleineLargeur ? "1 / -1" : "auto" }}>
      <label
        htmlFor={pour}
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
        {label}
      </label>
      {children}
      {aide ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.45,
            marginTop: 6,
            opacity: 0.7,
            textWrap: "pretty",
          }}
        >
          {aide}
        </div>
      ) : null}
    </div>
  );
}
