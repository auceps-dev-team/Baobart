"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { EtatFormulaire } from "@/lib/auth/actions";
import { CADRE, ENCRE, JAUNE, ORANGE } from "@/lib/systeme/charte";

/**
 * « Facturation & sécurité » de la maquette (`Baobart Dashboard.dc.html`,
 * Acheteur › Profil), avec ce qui existe derrière chaque case.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA FACTURATION RESTE EN LECTURE SEULE
 *
 * Décision antérieure, gardée le 27/10 : ces champs touchent au paiement et à
 * la vérification d'identité. Les rendre modifiables demanderait les gardes
 * du KYC. Mesuré le 27/10 : seule l'inscription les écrit (prénom, nom) —
 * l'adresse n'est écrite par aucun code. Les cases suivent la maquette ; leur
 * contenu dit ce qui est vraiment rangé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MOT DE PASSE PASSE PAR LA BOÎTE
 *
 * La maquette pose « Nouveau mot de passe » et « Confirmer » dans la page.
 * Ici, un lien part à l'adresse du compte (`envoyerLienMotDePasse`) : un champ
 * direct ferait d'une session volée un compte volé.
 */
export function FacturationSecurite({
  facturation,
  envoyerLien,
}: {
  facturation: Array<[libelle: string, valeur: string | null | undefined, largeur?: "pleine"]>;
  envoyerLien: () => Promise<EtatFormulaire>;
}) {
  const [etat, agir, enCours] = useActionState<EtatFormulaire | null, FormData>(() => envoyerLien(), null);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
        {facturation.map(([libelle, valeur, largeur]) => (
          <div key={libelle} style={{ gridColumn: largeur === "pleine" ? "1 / -1" : undefined, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>{libelle}</div>
            <div
              style={{
                padding: "11px 13px",
                border: `2px solid ${ENCRE}`,
                borderRadius: 12,
                background: "#F4EEFC",
                fontSize: 13.5,
                fontWeight: 600,
                opacity: valeur ? 1 : 0.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {valeur || "—"}
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, opacity: 0.72 }}>
        Ces informations touchent au paiement : elles ne se modifient pas ici.{" "}
        <Link href="/contact" style={{ fontWeight: 800, textDecoration: "underline" }}>
          Écris-nous
        </Link>{" "}
        pour les corriger.
      </p>

      <div style={{ borderTop: `2px solid ${ENCRE}`, paddingTop: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>Mot de passe</div>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, lineHeight: 1.5, opacity: 0.78 }}>
          Un lien part à l&apos;adresse de ton compte ; tu choisis le nouveau mot de passe en l&apos;ouvrant.
        </p>
        <form action={agir}>
          <button
            type="submit"
            disabled={enCours}
            data-lien-mot-de-passe
            className="sticker-press"
            style={{ padding: "11px 17px", border: CADRE, borderRadius: 13, background: JAUNE, fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}
          >
            {enCours ? "Envoi…" : "Recevoir un lien pour le changer"}
          </button>
        </form>
        {etat ? (
          <p role="status" style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 700, color: etat.erreur ? ORANGE : ENCRE }}>
            {etat.erreur ?? etat.succes}
          </p>
        ) : null}
      </div>
    </div>
  );
}
