"use client";

import { useActionState } from "react";

import {
  ecrireDansLeFilDe,
  ouvrirUneCommunaute,
  type EtatFormulaire,
} from "@/lib/forum/actions";
import { BLANC, CADRE, ENCRE, GRIS, ORANGE } from "@/lib/systeme/charte";

/**
 * Les deux formulaires des communautés.
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
 * IL N'Y A PLUS DE CHOIX DE VISIBILITÉ
 *
 * Le formulaire en portait un — publique, privée, sur invitation. Il a
 * disparu : toutes les communautés sont ouvertes. La raison tient en une
 * phrase — adhérer à une privée était refusé faute de table de demandes, donc
 * deux des trois valeurs menaient à une porte close. Aucune maquette n'en
 * dessine.
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

      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, opacity: 0.7 }}>
        Tout le monde pourra lire ce qui s&apos;y écrit. Seuls les membres
        pourront écrire.
      </p>

      <Erreur etat={etat} />

      <div>
        <button
          type="submit"
          disabled={enCours}
          style={{ ...BOUTON, background: enCours ? GRIS : ENCRE }}
        >
          {enCours ? "…" : "Ouvrir la communauté"}
        </button>
      </div>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════ le fil ══

/**
 * Écrire dans le fil.
 *
 * La maquette (`#collab`) montre une zone de saisie large et un bouton
 * « Envoyer » à droite, sous les messages. On la reprend telle quelle, y
 * compris le placeholder — « Écrire un commentaire… ».
 */
export function FormulaireFil({ slug }: { slug: string }) {
  const [etat, envoyer, enCours] = useActionState<
    EtatFormulaire | null,
    FormData
  >(ecrireDansLeFilDe.bind(null, slug), null);

  return (
    <form
      action={envoyer}
      // La clé change à chaque succès : React garde sinon le texte envoyé dans
      // la zone de saisie, et l'on croit que le message n'est pas parti.
      key={etat?.ok ? "vide" : "saisie"}
      style={{ display: "grid", gap: 12 }}
    >
      <textarea
        name="corps"
        required
        rows={3}
        placeholder="Écrire un commentaire…"
        style={CHAMP}
      />

      <Erreur etat={etat} />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={enCours}
          style={{ ...BOUTON, background: enCours ? GRIS : ENCRE }}
        >
          {enCours ? "…" : "Envoyer"}
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
