import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel } from "@/components/dashboard/frame";
import { PanneauCodesPromo } from "@/components/dashboard/codes-promo";
import { PanneauUpsells } from "@/components/dashboard/upsells";
import { sessionCourante } from "@/lib/auth/session";
import {
  basculerMonUpsell,
  creerMonCode,
  declarerMonUpsell,
  retirerMonCode,
} from "@/lib/commerce/actions-promo";
import { listerLesCodes } from "@/lib/commerce/codes-promo";
import { listerLesUpsells } from "@/lib/commerce/upsell";
import { db } from "@/lib/db";

export const metadata = { title: "Promotions — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Les promotions d'un créateur : codes et offres après achat.
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

  const [codes, upsells, ressources] = await Promise.all([
    listerLesCodes(utilisateur.id),
    listerLesUpsells(utilisateur.id),
    // Seulement les publiées : proposer une ressource en brouillon mènerait à
    // une fiche introuvable, et `offreApresAchat` la filtrerait de toute façon
    // — autant ne pas la laisser choisir.
    db.product.findMany({
      where: { sellerId: utilisateur.id, status: "PUBLISHED" },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Promotions"
      description="Une remise que tu accordes, et ce que tu proposes après un achat. Les deux sont à ta charge — la commission de Baobart baisse avec la remise."
    >
      <div style={{ maxWidth: 900 }}>
        <DashboardPanel titre="Tes codes">
          <PanneauCodesPromo
            codes={codes}
            creer={creerMonCode}
            retirer={retirerMonCode}
          />
        </DashboardPanel>

        <div style={{ marginTop: 20 }}>
          <DashboardPanel titre="Offres après achat">
            <PanneauUpsells
              upsells={upsells}
              ressources={ressources.map((r) => ({ id: r.id, nom: r.name }))}
              declarer={declarerMonUpsell}
              basculer={basculerMonUpsell}
            />
          </DashboardPanel>
        </div>
      </div>
    </DashboardFrame>
  );
}
