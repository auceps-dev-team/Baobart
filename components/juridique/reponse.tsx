"use client";

import { useActionState } from "react";

import { repondreAuDossier, type EtatGeste } from "@/lib/juridique/actions";
import { BLANC, CADRE, ENCRE, GRIS, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Répondre à une notification qui vise son contenu.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RIEN À JURER, RIEN À PROUVER
 *
 * Le DMCA américain exige une contre-notification sous peine de parjure, et
 * l'acceptation de la compétence d'un tribunal fédéral. C'est ce qui décourage
 * la plupart des contestations légitimes : on demande à quelqu'un de s'exposer
 * pénalement pour récupérer son propre travail.
 *
 * La loi ivoirienne ne demande rien de tel côté auteur. Elle punit en revanche
 * la mauvaise foi **du notifiant** (article 49). L'asymétrie est dans le bon
 * sens, et on ne la corrige pas en ajoutant un serment de notre invention.
 *
 * On expose sa version, et le dossier repasse devant un humain.
 */
export function FormulaireReponse({ reference }: { reference: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatGeste | null, FormData>(
    repondreAuDossier.bind(null, reference),
    null,
  );

  if (etat?.ok) {
    return (
      <div
        style={{
          border: CADRE,
          borderRadius: 16,
          background: VERT,
          padding: 18,
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.5,
        }}
      >
        Ta réponse est enregistrée. Le dossier repasse devant un humain, et tu
        seras prévenu de la décision.
      </div>
    );
  }

  return (
    <form action={envoyer} style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>Ta réponse</span>
        <span style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.45 }}>
          Explique pourquoi ce contenu est le tien, ou pourquoi tu as le droit
          de le publier. Tu n&apos;as rien à jurer ni à prouver à ce stade.
        </span>
        <textarea
          name="corps"
          required
          rows={5}
          style={{
            width: "100%",
            padding: "11px 14px",
            border: CADRE,
            borderRadius: 12,
            background: BLANC,
            fontSize: 15,
            fontFamily: "inherit",
          }}
        />
      </label>

      {etat && !etat.ok ? (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ORANGE }}>
          {etat.message}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={enCours}
          className="sticker-press"
          style={{
            padding: "12px 24px",
            border: CADRE,
            borderRadius: 14,
            background: enCours ? GRIS : ENCRE,
            color: BLANC,
            fontSize: 14,
            fontWeight: 800,
            cursor: enCours ? "progress" : "pointer",
          }}
        >
          {enCours ? "…" : "Envoyer ma réponse"}
        </button>
      </div>
    </form>
  );
}
