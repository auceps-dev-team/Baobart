"use client";

import { useActionState, useEffect, useState } from "react";

import {
  BLANC,
  ENCRE,
  JAUNE,
  LAVANDE_CLAIR,
  ORANGE,
} from "@/components/shell/nav-data";
import type { EtatProduit } from "@/lib/products/validation";

/**
 * Formulaire « Publier une ressource », traduit de « Baobart Dashboard.dc.html »
 * (écran `c_publier`) : deux blocs contourés, grille à deux colonnes, et le
 * bouton d'enregistrement sous une barre de séparation.
 */

const CADRE = `2.5px solid ${ENCRE}`;

const CATEGORIES = [
  "Illustration",
  "Photo",
  "Mockup",
  "Font",
  "Icône",
  "Logo",
  "Pack",
  "Art",
  "Audio",
  "Vidéo",
] as const;

const LICENCES = [
  { valeur: "PERSONAL", label: "Personnelle" },
  { valeur: "COMMERCIAL", label: "Commerciale" },
  { valeur: "EXTENDED", label: "Étendue" },
] as const;

const champStyle = (enErreur: boolean) => ({
  minWidth: 0,
  width: "100%",
  fontFamily: "var(--font-body)",
  fontSize: 13.5,
  fontWeight: 500,
  padding: "12px 14px",
  border: enErreur ? `2.5px solid ${ORANGE}` : CADRE,
  borderRadius: 13,
  background: LAVANDE_CLAIR,
  outline: "none",
});

function Bloc({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 24,
        background: BLANC,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 22,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 19,
          textTransform: "uppercase",
          letterSpacing: "-.4px",
        }}
      >
        {titre}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 14,
          marginTop: 18,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Champ({
  nom,
  label,
  pleineLargeur = false,
  children,
}: {
  nom: string;
  label: string;
  pleineLargeur?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
        gridColumn: pleineLargeur ? "1 / span 2" : "auto",
      }}
    >
      <label htmlFor={nom} style={{ fontSize: 12.5, fontWeight: 800 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function FormulaireProduit({
  action,
}: {
  action: (etat: EtatProduit, donnees: FormData) => Promise<EtatProduit>;
}) {
  const [etat, envoyer, enCours] = useActionState(action, {});
  const saisie = etat.saisie;
  const [gratuit, setGratuit] = useState(false);

  // React vide les champs non contrôlés quand l'action se termine. On les
  // repeuple depuis ce que le serveur vient de nous renvoyer, sinon un refus
  // de validation efface tout le formulaire.
  useEffect(() => {
    if (saisie) setGratuit(saisie.gratuit);
  }, [saisie]);

  return (
    <form action={envoyer} style={{ display: "grid", gap: 20, maxWidth: 900 }}>
      <Bloc titre="Fichier & aperçu">
        <Champ nom="titre" label="Titre de la ressource" pleineLargeur>
          <input
            id="titre"
            name="titre"
            defaultValue={saisie?.titre ?? ""}
            key={`titre-${saisie?.titre ?? ""}`}
            placeholder="Illu Femme au Foulard"
            style={champStyle(etat.champ === "titre")}
          />
        </Champ>

        <Champ nom="famille" label="Catégorie">
          <select
            id="famille"
            name="famille"
            defaultValue={saisie?.famille ?? ""}
            key={`famille-${saisie?.famille ?? ""}`}
            style={champStyle(etat.champ === "famille")}
          >
            <option value="" disabled>
              Choisir…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Champ>

        <Champ nom="licence" label="Type de licence">
          <select
            id="licence"
            name="licence"
            defaultValue={saisie?.licence ?? "COMMERCIAL"}
            key={`licence-${saisie?.licence ?? ""}`}
            style={champStyle(false)}
          >
            {LICENCES.map((l) => (
              <option key={l.valeur} value={l.valeur}>
                {l.label}
              </option>
            ))}
          </select>
        </Champ>

        <Champ nom="motsCles" label="Mots-clés" pleineLargeur>
          <input
            id="motsCles"
            name="motsCles"
            defaultValue={saisie?.motsCles ?? ""}
            key={`mots-${saisie?.motsCles ?? ""}`}
            placeholder="wax, portrait, motif"
            style={champStyle(false)}
          />
        </Champ>

        <Champ nom="description" label="Description" pleineLargeur>
          <textarea
            id="description"
            name="description"
            defaultValue={saisie?.description ?? ""}
            key={`desc-${saisie?.description ?? ""}`}
            placeholder="Ce que contient le fichier, dimensions, usages conseillés…"
            style={{ ...champStyle(etat.champ === "description"), minHeight: 96, resize: "vertical" }}
          />
        </Champ>
      </Bloc>

      <Bloc titre="Prix & fichiers">
        <Champ nom="prix" label="Prix (FCFA)">
          <input
            id="prix"
            name="prix"
            defaultValue={saisie?.prix ?? ""}
            key={`prix-${saisie?.prix ?? ""}`}
            inputMode="numeric"
            placeholder="5 000"
            disabled={gratuit}
            style={{
              ...champStyle(etat.champ === "prix"),
              opacity: gratuit ? 0.45 : 1,
            }}
          />
        </Champ>

        <Champ nom="gratuit" label="Gratuit ?">
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              border: CADRE,
              borderRadius: 13,
              background: gratuit ? JAUNE : LAVANDE_CLAIR,
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: 700,
            }}
          >
            <input
              id="gratuit"
              name="gratuit"
              type="checkbox"
              checked={gratuit}
              onChange={(e) => setGratuit(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: ENCRE }}
            />
            {gratuit ? "Oui, gratuite" : "Non, payante"}
          </label>
        </Champ>

        {/*
          Fichiers, dimensions et poids sont des faits du fichier, pas des
          déclarations. Les laisser saisir produirait des valeurs qui
          contredisent le fichier réel. Ils sont affichés — la maquette les
          prévoit — mais renseignés à l'envoi, quand l'upload existera.
        */}
        <Champ nom="fichiers" label="Fichiers sources" pleineLargeur>
          <input
            id="fichiers"
            disabled
            placeholder="Renseignés à l'envoi du fichier"
            style={{ ...champStyle(false), opacity: 0.5 }}
          />
        </Champ>

        <Champ nom="dimensions" label="Dimensions">
          <input
            id="dimensions"
            disabled
            placeholder="Lues dans le fichier"
            style={{ ...champStyle(false), opacity: 0.5 }}
          />
        </Champ>

        <Champ nom="poids" label="Poids total">
          <input
            id="poids"
            disabled
            placeholder="Calculé à l'envoi"
            style={{ ...champStyle(false), opacity: 0.5 }}
          />
        </Champ>

        <div style={{ gridColumn: "1 / span 2" }}>
          {etat.erreur ? (
            <div
              role="alert"
              style={{
                marginBottom: 16,
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

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              paddingTop: 18,
              borderTop: CADRE,
            }}
          >
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
              }}
            >
              {enCours ? "Enregistrement…" : "Enregistrer le brouillon"}
            </button>
            <a
              href="/dashboard"
              style={{
                padding: "14px 24px",
                border: CADRE,
                borderRadius: 14,
                background: BLANC,
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              Annuler
            </a>
          </div>
        </div>
      </Bloc>
    </form>
  );
}
