import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel } from "@/components/dashboard/frame";
import { PanneauCodesPromo } from "@/components/dashboard/codes-promo";
import { sessionCourante } from "@/lib/auth/session";
import {
  creerMonCode,
  retirerMonCode,
} from "@/lib/commerce/actions-promo";
import { listerLesCodes } from "@/lib/commerce/codes-promo";

export const metadata = { title: "Codes promo — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Les codes promo d'un créateur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * AUCUNE GARDE DE RÔLE, ET C'EST COHÉRENT AVEC LE RESTE
 *
 * `lib/auth/roles.ts` pose qu'il n'existe aucune colonne de rôle : on ne
 * devient pas créateur parce qu'on l'a déclaré, mais parce qu'on a publié.
 *
 * Un acheteur qui atterrit ici voit donc un écran vide et un formulaire qui
 * marche — et le code qu'il créerait ne s'appliquerait à rien, puisque
 * `evaluerUnCode` cherche par vendeur et qu'il n'a aucune ressource. C'est
 * inoffensif, et c'est plus honnête qu'une garde qui prétendrait trancher un
 * statut que la base ne stocke pas.
 */
export default async function PromosPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/dashboard/promos");

  const codes = await listerLesCodes(utilisateur.id);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Codes promo"
      description="Une remise que tu accordes, sur tes ressources. Elle est à ta charge — la commission de Baobart baisse avec elle."
    >
      <div style={{ maxWidth: 900 }}>
        <DashboardPanel titre="Tes codes">
          <PanneauCodesPromo
            codes={codes}
            creer={creerMonCode}
            retirer={retirerMonCode}
          />
        </DashboardPanel>
      </div>
    </DashboardFrame>
  );
}
