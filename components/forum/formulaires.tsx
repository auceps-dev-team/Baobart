"use client";

import { useActionState } from "react";

import {
  ouvrirUnSujet,
  repondreAUnSujet,
  ouvrirUneCommunaute,
  type EtatFormulaire,
} from "@/lib/forum/actions";
import { BLANC, CADRE, ENCRE, GRIS, ORANGE } from "@/lib/systeme/charte";

/**
 * Les trois formulaires du forum.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * AUCUNE VALIDATION N'EST REJOUÉE ICI
 *
 * Ni longueur minimale, ni champ requis en JavaScript. Les règles vivent dans
 * `lib/forum/validation.ts`, et les répéter au navigateur ferait deux endroits
 * à changer le jour où l'une bouge — avec la certitude qu'on en oubliera un.
 *
 * `required` reste sur les champs, parce qu'il évite un aller-retour complet
 * pour un champ vide. Ce n'est pas une garde : c'est un raccourci d'affichage,
 * et le serveur refuse de toute façon.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA SYNTAXE DES MESSAGES EST LA MÊME QUE CELLE DU BLOG
 *
 * `lib/cms/corps.ts` lit les deux. Ce qui veut dire qu'un message de forum
 * accepte `**gras**`, les listes et les liens, et que rien de ce qui est écrit
 * ne devient jamais du HTML — pas même un `<b>` tapé exprès.
 */

const CHAMP: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: CADRE,
  borderRadius: 12,
  background: BLANC,
  fontSize: 15,
  fontFamily: "inherit",
};

const BOUTON: React.CSSProperties = {
  padding: "13px 26px",
  border: CADRE,
  borderRadius: 14,
  background: ENCRE,
  color: BLANC,
  fontSize: 14.5,
  fontWeight: 800,
  cursor: "pointer",
};

// ══════════════════════════════════════════════════════════════ la communauté ══

export function FormulaireCommunaute() {
  const [etat, envoyer, enCours] = useActionState<
    EtatFormulaire | null,
    FormData
  >(ouvrirUneCommunaute, null);

  return (
    <form action={envoyer} style={{ display: "grid", gap: 16 }}>
      <Champ libelle="Nom" erreur={erreurDe(etat, "nom")}>
        <input
          name="nom"
          required
          maxLength={60}
          placeholder="Sérigraphie Dakar"
          style={CHAMP}
        />
      </Champ>

      <Champ
        libelle="Description"
        aide="Ce qu'on y fait, en une ou deux phrases. C'est ce qu'on lit dans l'annuaire."
        erreur={erreurDe(etat, "description")}
      >
        <textarea name="description" rows={3} maxLength={600} style={CHAMP} />
      </Champ>

      <Champ
        libelle="Qui peut entrer"
        aide="Une privée se voit exister sans se lire. Une communauté sur invitation ne figure même pas dans l'annuaire."
      >
        <select name="visibilite" defaultValue="PUBLIC" style={CHAMP}>
          <option value="PUBLIC">Publique — tout le monde lit, les membres écrivent</option>
          <option value="PRIVATE">Privée — seuls les membres lisent</option>
          <option value="INVITE_ONLY">Sur invitation — invisible aux autres</option>
        </select>
      </Champ>

      <Erreur etat={etat} />

      <div>
        <button type="submit" disabled={enCours} style={{ ...BOUTON, background: enCours ? GRIS : ENCRE }}>
          {enCours ? "…" : "Ouvrir la communauté"}
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════ le sujet ══

export function FormulaireSujet({
  slug,
  categorieId,
}: {
  slug: string;
  categorieId: string;
}) {
  const [etat, envoyer, enCours] = useActionState<
    EtatFormulaire | null,
    FormData
  >(ouvrirUnSujet.bind(null, slug, categorieId), null);

  return (
    <form action={envoyer} style={{ display: "grid", gap: 14 }}>
      <Champ libelle="Titre" erreur={erreurDe(etat, "titre")}>
        <input
          name="titre"
          required
          maxLength={140}
          placeholder="Quelle encre pour du wax ?"
          style={CHAMP}
        />
      </Champ>

      <Champ libelle="Message" erreur={erreurDe(etat, "corps")}>
        <textarea name="corps" required rows={6} style={CHAMP} />
      </Champ>

      <Erreur etat={etat} />

      <div>
        <button type="submit" disabled={enCours} style={{ ...BOUTON, background: enCours ? GRIS : ENCRE }}>
          {enCours ? "…" : "Ouvrir le sujet"}
        </button>
      </div>
    </form>
  );
}

// ════════════════════════════════════════════════════════════════ la réponse ══

export function FormulaireReponse({
  slug,
  sujetId,
}: {
  slug: string;
  sujetId: string;
}) {
  const [etat, envoyer, enCours] = useActionState<
    EtatFormulaire | null,
    FormData
  >(repondreAUnSujet.bind(null, slug, sujetId), null);

  return (
    <form
      action={envoyer}
      // La clé change à chaque succès : React garde sinon le texte envoyé dans
      // la zone de saisie, et l'on croit que la réponse n'est pas partie.
      key={etat?.ok ? "vide" : "saisie"}
      style={{ display: "grid", gap: 12 }}
    >
      <textarea
        name="corps"
        required
        rows={4}
        placeholder="Répondre…"
        style={CHAMP}
      />

      <Erreur etat={etat} />

      <div>
        <button type="submit" disabled={enCours} style={{ ...BOUTON, background: enCours ? GRIS : ENCRE }}>
          {enCours ? "…" : "Répondre"}
        </button>
      </div>
    </form>
  );
}

// ════════════════════════════════════════════════════════════════════ outils ══

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
        <span style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.4 }}>{aide}</span>
      ) : null}
      {children}
      {erreur ? (
        <span style={{ fontSize: 12.5, fontWeight: 700, color: ORANGE }}>{erreur}</span>
      ) : null}
    </label>
  );
}

/** Le message d'échec qui ne vise aucun champ en particulier. */
function Erreur({ etat }: { etat: EtatFormulaire | null }) {
  if (!etat || etat.ok || etat.champ) return null;
  return (
    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: ORANGE }}>
      {etat.message}
    </p>
  );
}

function erreurDe(etat: EtatFormulaire | null, champ: string): string | undefined {
  if (!etat || etat.ok || etat.champ !== champ) return undefined;
  return etat.message;
}
