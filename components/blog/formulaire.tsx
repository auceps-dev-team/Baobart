"use client";

import { useActionState, useRef, useState, useTransition } from "react";

import {
  creerArticle,
  modifierArticle,
  type EtatFormulaire,
} from "@/lib/blog/actions";
import { televerserImageArticle } from "@/lib/blog/images";
import type { Saisie } from "@/lib/blog/validation";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Écrire un article.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN CHAMP DE TEXTE, ET UNE AIDE-MÉMOIRE À CÔTÉ
 *
 * Pas d'éditeur riche — voir l'en-tête de `lib/cms/corps.ts` : ce projet ne
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

  // Le corps est incontrôlé — c'est ce qui permet de taper sans re-rendre à
  // chaque touche. Pour y insérer une image après téléversement, il faut donc
  // atteindre l'élément lui-même.
  const corpsRef = useRef<HTMLTextAreaElement>(null);
  const couvertureRef = useRef<HTMLInputElement>(null);

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
          <div style={{ display: "grid", gap: 8 }}>
            <textarea
              ref={corpsRef}
              name="corps"
              defaultValue={v?.corps ?? ""}
              required
              rows={22}
              placeholder="Le wax n'est pas né en Afrique de l'Ouest…"
              style={{ ...saisieStyle, resize: "vertical", lineHeight: 1.6 }}
            />
            <EnvoiImage
              libelle="Insérer une image dans l'article"
              onDepose={(url) => {
                // Insérée à l'endroit du curseur, seule sur sa ligne : le
                // parseur ne reconnaît une image qu'en début de ligne.
                const zone = corpsRef.current;
                if (!zone) return;

                const ou = zone.selectionStart ?? zone.value.length;
                const avant = zone.value.slice(0, ou).replace(/\n*$/, "");
                const apres = zone.value.slice(ou).replace(/^\n*/, "");

                zone.value = `${avant}\n\n![](${url})\n\n${apres}`;
                zone.focus();
              }}
            />
          </div>
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
          <div style={{ display: "grid", gap: 8 }}>
            <input
              ref={couvertureRef}
              name="couvertureUrl"
              defaultValue={v?.couvertureUrl ?? ""}
              placeholder="/img/wax.jpg"
              style={saisieStyle}
            />
            <EnvoiImage
              libelle="Envoyer une couverture"
              onDepose={(url) => {
                if (couvertureRef.current) couvertureRef.current.value = url;
              }}
            />
          </div>
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

      <Champ
        label="Parution prévue"
        aide="Laisse vide pour publier toi-même. Heure d'Abidjan (GMT). Un passage horaire met en ligne les brouillons dont l'heure est venue."
        faute={champFautif === "parutionPrevue"}
      >
        <input
          type="datetime-local"
          name="parutionPrevue"
          defaultValue={v?.parutionPrevue ?? ""}
          style={saisieStyle}
        />
      </Champ>

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

/**
 * Envoyer une image, et rendre son adresse.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN ENVOI SÉPARÉ, PAS UN CHAMP DU FORMULAIRE
 *
 * L'image part tout de suite, et ce qu'on range dans l'article est son
 * adresse. L'alternative — la joindre à l'envoi de l'article — obligerait à
 * retransférer le fichier à chaque correction de typo, et ferait échouer
 * l'enregistrement entier si le stockage bronchait.
 *
 * Ce que ça implique : une image envoyée puis abandonnée reste au stockage
 * jusqu'au passage quotidien `/api/cron/medias` (depuis v1.71.5), qui retire
 * ce que plus aucun texte ne cite, vingt-quatre heures après le dépôt — voir
 * `lib/medias/balayage.ts`.
 */
function EnvoiImage({
  libelle,
  onDepose,
}: {
  libelle: string;
  onDepose: (url: string) => void;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 13px",
          border: CADRE,
          borderRadius: 12,
          background: enCours ? GRIS : BLANC,
          fontSize: 12.5,
          fontWeight: 800,
          cursor: enCours ? "progress" : "pointer",
          justifySelf: "start",
        }}
      >
        {enCours ? "Envoi…" : libelle}
        <input
          type="file"
          // Un filtre de confort, pas une garde : le type annoncé vient du
          // navigateur et se falsifie. Ce sont les premiers octets qui
          // décident, côté serveur — voir `lib/blog/formats-image.ts`.
          accept="image/png,image/jpeg,image/gif,image/webp"
          disabled={enCours}
          onChange={(e) => {
            const fichier = e.target.files?.[0];
            if (!fichier) return;

            // Le champ est vidé tout de suite : sans ça, renvoyer le même
            // fichier après une erreur ne déclencherait aucun événement.
            e.target.value = "";
            setErreur(null);

            const donnees = new FormData();
            donnees.set("image", fichier);

            demarrer(async () => {
              const suite = await televerserImageArticle(donnees);
              if (suite.ok) onDepose(suite.url);
              else setErreur(suite.message);
            });
          }}
          style={{ display: "none" }}
        />
      </label>

      {erreur ? (
        <span style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>
          {erreur}
        </span>
      ) : null}
    </div>
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
