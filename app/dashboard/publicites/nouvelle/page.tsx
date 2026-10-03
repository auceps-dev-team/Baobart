import Link from "next/link";
import type { Route } from "next";

import { DashboardFrame } from "@/components/dashboard/frame";
import { FormulairePublicite } from "@/components/publicites/formulaire";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { BLANC, CADRE, ENCRE } from "@/lib/systeme/charte";

export const metadata = { title: "Nouvelle publicité — Baobart." };
export const dynamic = "force-dynamic";

/** Créer une bannière. Sans date de début, elle paraît dès l'enregistrement. */
export default async function NouvellePublicitePage() {
  const utilisateur = await exigerLePouvoir("promouvoir_du_contenu");

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Nouvelle publicité"
      description="Sans date de début, elle paraît dans la mosaïque dès que tu l'enregistres."
      action={<Retour />}
    >
      <div style={{ maxWidth: 1080 }}>
        <FormulairePublicite />
      </div>
    </DashboardFrame>
  );
}

function Retour() {
  return (
    <Link
      href={"/dashboard/publicites" as Route}
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
      ← Toutes les publicités
    </Link>
  );
}
