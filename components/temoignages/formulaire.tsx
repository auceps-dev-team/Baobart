"use client";

import { useActionState, useState, useTransition } from "react";

import { CarteTemoignage } from "@/components/temoignages/carte";
import { proposerTemoignage, retirerMonTemoignage, type EtatProposition } from "@/lib/temoignages/actions";
import { CORPS_MAX, ROLE_MAX } from "@/lib/temoignages/regles";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Proposer, corriger ou retirer son témoignage — en voyant ce qui paraîtra.
 */
export function FormulaireTemoignage({
  depart,
  nom,
  avatarUrl,
  existe,
}: {
  depart: { corps: string; role: string };
  nom: string;
  avatarUrl: string | null;
  /** Un témoignage existe déjà : le bouton dit « Envoyer la correction », et on peut le retirer. */
  existe: boolean;
}) {
  const [etat, envoyer, enCours] = useActionState<EtatProposition | null, FormData>(proposerTemoignage, null);
  const v = etat && !etat.ok ? etat.saisie : depart;
  const faute = etat && !etat.ok ? etat.champ : undefined;
  const [corps, setCorps] = useState(v.corps);
  const [role, setRole] = useState(v.role);
  const [retrait, demarrerRetrait] = useTransition();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}>
      <form action={envoyer} style={{ display: "grid", gap: 16 }}>
        {etat && !etat.ok ? <Bandeau fond={ORANGE} clair>{etat.message}</Bandeau> : null}
        {etat?.ok ? (
          <Bandeau fond={VERT}>Envoyé. L&apos;équipe le relit avant qu&apos;il paraisse sur l&apos;accueil.</Bandeau>
        ) : null}

        <Champ libelle="Ton témoignage" aide={`${corps.trim().length} / ${CORPS_MAX} caractères. Ce que Baobart a changé pour toi, en une ou deux phrases.`} faute={faute === "corps"}>
          <textarea
            name="corps"
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
            required
            rows={5}
            maxLength={CORPS_MAX + 50}
            placeholder="J'ai vendu mon premier pack de polices en trois semaines, payé en Orange Money."
            style={{ ...saisie, resize: "vertical", lineHeight: 1.5 }}
          />
        </Champ>

        <Champ libelle="Ta présentation (facultatif)" aide="Sous ton nom. Vide : on reprend la spécialité de ton profil." faute={faute === "role"}>
          <input
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={ROLE_MAX}
            placeholder="Typographe, Abidjan"
            style={saisie}
          />
        </Champ>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, fontWeight: 700, lineHeight: 1.45, color: faute === "accord" ? ORANGE : ENCRE }}>
          <input type="checkbox" name="accord" style={{ width: 18, height: 18, marginTop: 1 }} />
          J&apos;accepte que ce témoignage paraisse sur l&apos;accueil de Baobart avec mon nom affiché et mon avatar. Je peux
          le retirer à tout moment.
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button type="submit" disabled={enCours} className="sticker-press" style={{ ...bouton, background: JAUNE, boxShadow: `4px 4px 0 ${ENCRE}` }}>
            {enCours ? "Un instant…" : existe ? "Envoyer la correction" : "Envoyer mon témoignage"}
          </button>
          {existe ? (
            <button
              type="button"
              disabled={retrait}
              onClick={() => demarrerRetrait(async () => retirerMonTemoignage())}
              style={{ ...bouton, background: BLANC }}
            >
              {retrait ? "Un instant…" : "Retirer mon témoignage"}
            </button>
          ) : null}
        </div>
        {existe ? (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, opacity: 0.65 }}>
            Une correction repart en relecture : ce qui est publié n&apos;est pas ce que tu viens d&apos;écrire.
          </p>
        ) : null}
      </form>

      <aside style={{ display: "grid", gap: 10 }}>
        <span style={etiquette}>Ce qui paraîtra</span>
        <div style={{ maxWidth: 340 }}>
          <CarteTemoignage
            texte={corps.trim() || "Ton témoignage paraît ici."}
            nom={nom}
            presentation={role.trim() || null}
            avatarUrl={avatarUrl}
            rang={1}
          />
        </div>
      </aside>
    </div>
  );
}

function Bandeau({ fond, clair = false, children }: { fond: string; clair?: boolean; children: React.ReactNode }) {
  return (
    <div role="status" style={{ padding: "12px 15px", border: CADRE, borderRadius: 14, background: fond, color: clair ? BLANC : ENCRE, fontSize: 13.5, fontWeight: 700 }}>
      {children}
    </div>
  );
}

function Champ({ libelle, aide, faute, children }: { libelle: string; aide?: string; faute?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ ...etiquette, color: faute ? ORANGE : ENCRE, opacity: faute ? 1 : 0.6, fontWeight: faute ? 700 : 400 }}>{libelle}</span>
      {children}
      {aide ? <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.65 }}>{aide}</span> : null}
    </label>
  );
}

const etiquette: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: ".1em",
  opacity: 0.6,
};

const saisie: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  border: CADRE,
  borderRadius: 12,
  background: BLANC,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "inherit",
  color: ENCRE,
};

const bouton: React.CSSProperties = {
  padding: "12px 20px",
  border: CADRE,
  borderRadius: 13,
  fontSize: 13.5,
  fontWeight: 800,
  fontFamily: "inherit",
  color: ENCRE,
  cursor: "pointer",
};
