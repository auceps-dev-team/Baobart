import { redirect } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { FormulaireProduit } from "@/components/dashboard/product-form";
import { sessionCourante } from "@/lib/auth/session";
import { creerBrouillon } from "@/lib/products/actions";

export const metadata = { title: "Publier une ressource — Baobart." };
export const dynamic = "force-dynamic";

/**
 * « Publier une ressource » de la maquette. Le cadre commun depuis le 27/10 :
 * la page montait sa barre à la main, et n'avait donc ni l'en-tête ni la
 * ligne d'espace des autres écrans.
 */
export default async function NouveauProduitPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Publier une ressource"
      description="Formats acceptés : PNG, JPG, AI, PSD, SVG, TTF, MP4, ZIP — 200 Mo max. Ta ressource est enregistrée en brouillon : elle ne sera visible qu'une fois publiée."
    >
      <FormulaireProduit action={creerBrouillon} />
    </DashboardFrame>
  );
}
