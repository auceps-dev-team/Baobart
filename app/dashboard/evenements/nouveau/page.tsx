import Link from "next/link";
import type { Route } from "next";

import { DashboardFrame } from "@/components/dashboard/frame";
import { FormulaireEvenement } from "@/components/evenements/formulaire";
import { exigerAccesAuxEvenements } from "@/lib/evenements/garde";
import { BLANC, CADRE, ENCRE, JAUNE } from "@/lib/systeme/charte";

export const metadata = { title: "Nouvel événement — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Créer un événement.
 *
 * Il naît en brouillon, toujours : on écrit rarement une fiche juste du
 * premier coup, et le défaut précédent du schéma — publier à la création —
 * mettait en ligne des textes à moitié rédigés.
 *
 * La phrase d'accompagnement change selon la portée. Promettre « tu le
 * publieras » à une agence qui devra passer par la relecture serait la
 * laisser chercher un bouton qui n'apparaîtra jamais.
 */
export default async function NouvelEvenementPage() {
  const { utilisateur, portee } = await exigerAccesAuxEvenements();

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Nouvel événement"
      description={
        portee.etendue === "TOUT"
          ? "Il naîtra en brouillon. Tu le publieras quand la fiche sera prête."
          : "Il naîtra en brouillon. Tu l'enverras en relecture quand la fiche sera prête — l'équipe Baobart le met en ligne."
      }
      action={
        <Link
          href={"/dashboard/evenements" as Route}
          style={{
            padding: "10px 16px",
            border: CADRE,
            borderRadius: 13,
            background: BLANC,
            fontSize: 13,
            fontWeight: 800,
            color: ENCRE,
          }}
        >
          ← Tous les événements
        </Link>
      }
    >
      <div
        style={{
          display: "flex",
          gap: 13,
          marginBottom: 20,
          padding: "16px 18px",
          border: CADRE,
          borderRadius: 18,
          background: JAUNE,
          maxWidth: 860,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            flex: "0 0 auto",
            border: `2px solid ${ENCRE}`,
            borderRadius: 99,
            background: BLANC,
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          !
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.5, textWrap: "pretty" }}>
          Les heures se saisissent à l&apos;heure d&apos;Abidjan (GMT). C&apos;est
          exact pour Dakar, Bamako, Ouagadougou, Lomé et Accra ; pour Douala,
          retire une heure.
        </div>
      </div>

      <div style={{ maxWidth: 860 }}>
        <FormulaireEvenement />
      </div>
    </DashboardFrame>
  );
}
