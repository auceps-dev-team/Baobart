import { redirect } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { FormulaireProduit } from "@/components/dashboard/product-form";
import { sessionCourante } from "@/lib/auth/session";
import { connexionPuis } from "@/lib/auth/suite";
import { creerBrouillon } from "@/lib/products/actions";
import { db } from "@/lib/db";
import { libelleDelai } from "@/lib/remboursements/regles";

export const metadata = { title: "Publier une ressource — Baobart." };
export const dynamic = "force-dynamic";

/**
 * « Publier une ressource » de la maquette. Le cadre commun depuis le 27/10 :
 * la page montait sa barre à la main, et n'avait donc ni l'en-tête ni la
 * ligne d'espace des autres écrans.
 */
export default async function NouveauProduitPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect(connexionPuis("/dashboard/produits/nouveau"));
  // Q-21 : le délai de remboursement du compte, montré à la publication.
  const compte = await db.user.findUnique({ where: { id: utilisateur.id }, select: { refundWindowDays: true } });
  const delai = libelleDelai(compte?.refundWindowDays ?? 30);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Publier une ressource"
      description="Formats acceptés : PNG, JPG, AI, PSD, SVG, TTF, MP4, ZIP — 200 Mo max. Ta ressource est enregistrée en brouillon : elle ne sera visible qu'une fois publiée."
    >
      <FormulaireProduit action={creerBrouillon} delaiRemboursement={delai} />
    </DashboardFrame>
  );
}
