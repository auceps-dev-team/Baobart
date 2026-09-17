"use client";

import { useActionState, useState } from "react";

import {
  creerArticle,
  modifierArticle,
  type EtatFormulaire,
} from "@/lib/blog/actions";
import type { Saisie } from "@/lib/blog/validation";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Écrire un article.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN CHAMP DE TEXTE, ET UNE AIDE-MÉMOIRE À CÔTÉ
 *
 * Pas d'éditeur riche — voir l'en-tête de `lib/blog/corps.ts` : ce projet ne
 * rend d'HTML nulle part, et un blog n'est pas une raison de commencer.
 *
 * Ce que ça coûte, c'est qu'il faut apprendre cinq marques. La colonne de
 * droite les rappelle en permanence plutôt que de les cacher derrière un
 * bouton « aide » : on écrit un article une fois par semaine, pas dix fois par
 * jour, et personne ne retient une syntaxe à cette fréquence.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE SEO EST REPLIÉ
 *
 * Trois champs qui servent une fois sur dix, et qui poussent le corps hors de
 * l'écran s'ils restent ouverts. Repliés par défaut, et le repli s'ouvre tout
 * seul quand l'un d'eux est déjà rempli — sinon on croirait l'avoir perdu.
 */
export function FormulaireArticle({
  articleId,
  depart,
  categories,
}: {
  /** Absent à la création. */
  articleId?: string;
  depart?: Saisie;
  categories: { id: string; nom: string }[];
}) {
  const action = articleId
    ? modifierArticle.bind(null, articleId)
    : creerArticle;

  const [etat, envoyer, enCours] = useActionState<EtatFormulaire | null, FormData>(
    action,
    null,
  );

  // Ce que le serveur a renvoyé prime sur le départ : React vide les champs
  // non contrôlés à la fin d'une action, et sans ça une erreur de titre SEO
  // effacerait l'article entier.
  const v = etat && !etat.ok ? etat.saisie : depart;

  const aDuSeo = Boolean(
    (v?.seoTitre ?? "") || (v?.seoDescription ?? "") || (v?.urlCanonique ?? ""),
  );
  const [seoOuvert, setSeoOuvert] = useState(aDuSeo);

  const champFautif = etat && !etat.ok ? etat.champ : undefined;

  return (
    <form action={envoyer} style={{ display: "grid", gap: 16 }}>
      {etat && !etat.ok && etat.message ? (
        <div
          role="status"
          style={{
            padding: "12px 15px",
            border: CADRE,
            borderRadius: 14,
            background: ORANGE,
            color: BLANC,
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {etat.message}
        </div>
      ) : null}

      {etat?.ok ? (
        <div
          role="status"
          style={{
            padding: "12px 15px",
            border: CADRE,
            borderRadius: 14,
            background: VERT,
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          Enregistré.
        </div>
      ) : null}

      <Champ label="Titre" faute={champFautif === "titre"}>
        <input
          name="titre"
          defaultValue={v?.titre ?? ""}
          required
          maxLength={140}
          placeholder="D'où vient vraiment le wax"
          style={saisieStyle}
        />
      </Champ>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,260px)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <Champ label="L'article" faute={champFautif === "corps"}>
          <textarea
            name="corps"
            defaultValue={v?.corps ?? ""}
            required
            rows={22}
            placeholder="Le wax n'est pas né en Afrique de l'Ouest…"
            style={{ ...saisieStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        </Champ>

        <aside
          style={{
            border: CADRE,
            borderRadius: 16,
            background: JAUNE,
            padding: 14,
            position: "sticky",
            top: 16,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              opacity: 0.7,
              marginBottom: 10,
            }}
          >
            Les cinq marques
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 0,
              listStyle: "none",
              display: "grid",
              gap: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              lineHeight: 1.5,
            }}
          >
            <li># un titre</li>
            <li>## un sous-titre</li>
            <li>- une puce</li>
            <li>&gt; une citation</li>
            <li>**gras** · [texte](adresse)</li>
          </ul>
          <p
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              lineHeight: 1.5,
              margin: "12px 0 0",
              opacity: 0.85,
            }}
          >
            Une ligne vide sépare deux paragraphes. Tout le reste s&apos;affiche
            tel quel — il n&apos;y a pas d&apos;HTML ici.
          </p>
        </aside>
      </div>

      <Champ
        label="Extrait"
        aide="Ce qu'on lit sur les cartes. Laisse vide pour reprendre le début de l'article."
        faute={champFautif === "extrait"}
      >
        <input
          name="extrait"
          defaultValue={v?.extrait ?? ""}
          maxLength={200}
          style={saisieStyle}
        />
      </Champ>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Champ label="Rubrique">
          <select
            name="categorieId"
            defaultValue={v?.categorieId ?? ""}
            style={saisieStyle}
          >
            <option value="">Sans rubrique</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </Champ>

        <Champ
          label="Couverture"
          aide="Une adresse d'image. https:// ou /."
          faute={champFautif === "couvertureUrl"}
        >
          <input
            name="couvertureUrl"
            defaultValue={v?.couvertureUrl ?? ""}
            placeholder="/img/wax.jpg"
            style={saisieStyle}
          />
        </Champ>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 13.5,
          fontWeight: 700,
        }}
      >
        <input
          type="checkbox"
          name="aLaUne"
          defaultChecked={Boolean(v?.aLaUne)}
          style={{ width: 18, height: 18 }}
        />
        Mettre à la une
      </label>

      {/* ── SEO, replié ─────────────────────────────────────────────────── */}
      <div style={{ border: CADRE, borderRadius: 16, background: BLANC, padding: 14 }}>
        <button
          type="button"
          onClick={() => setSeoOuvert((o) => !o)}
          aria-expanded={seoOuvert}
          style={{
            border: "none",
            background: "none",
            padding: 0,
            font: "inherit",
            fontSize: 13.5,
            fontWeight: 800,
            cursor: "pointer",
            color: ENCRE,
          }}
        >
          {seoOuvert ? "▾" : "▸"} Référencement
        </button>

        {seoOuvert ? (
          <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
            <Champ
              label="Titre SEO"
              aide="Vide : on reprend le titre de l'article."
              faute={champFautif === "seoTitre"}
            >
              <input
                name="seoTitre"
                defaultValue={v?.seoTitre ?? ""}
                maxLength={70}
                style={saisieStyle}
              />
            </Champ>
            <Champ
              label="Description SEO"
              aide="Vide : on reprend l'extrait."
              faute={champFautif === "seoDescription"}
            >
              <textarea
                name="seoDescription"
                defaultValue={v?.seoDescription ?? ""}
                rows={2}
                maxLength={320}
                style={{ ...saisieStyle, resize: "vertical" }}
              />
            </Champ>
            <Champ
              label="Adresse canonique"
              aide="Si l'article a d'abord paru ailleurs."
              faute={champFautif === "urlCanonique"}
            >
              <input
                name="urlCanonique"
                defaultValue={v?.urlCanonique ?? ""}
                style={saisieStyle}
              />
            </Champ>
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={enCours}
        className="sticker-press"
        style={{
          justifySelf: "start",
          padding: "13px 24px",
          border: CADRE,
          borderRadius: 14,
          background: JAUNE,
          boxShadow: `4px 4px 0 ${ENCRE}`,
          fontSize: 14,
          fontWeight: 800,
          fontFamily: "inherit",
          cursor: "pointer",
          color: ENCRE,
        }}
      >
        {enCours ? "Un instant…" : articleId ? "Enregistrer" : "Créer le brouillon"}
      </button>
    </form>
  );
}

function Champ({
  label,
  aide,
  faute,
  children,
}: {
  label: string;
  aide?: string;
  faute?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          // Le champ fautif se signale aussi par sa couleur, mais le message
          // au-dessus du formulaire dit lequel en toutes lettres : la couleur
          // seule ne suffit jamais.
          color: faute ? ORANGE : ENCRE,
          opacity: faute ? 1 : 0.6,
          fontWeight: faute ? 700 : 400,
        }}
      >
        {label}
      </span>
      {children}
      {aide ? (
        <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.65 }}>{aide}</span>
      ) : null}
    </label>
  );
}

const saisieStyle = {
  width: "100%",
  padding: "12px 14px",
  border: CADRE,
  borderRadius: 14,
  background: "#F4EEFC",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 500,
  outline: "none",
} as const;
