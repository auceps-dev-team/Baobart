import { notFound } from "next/navigation";

import { DetailProduit, EnTeteFiche } from "@/components/product/detail";
import { BoutonFermer, ModaleProduit } from "@/components/product/modal";
import { obtenirProduit } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

/**
 * La même fiche, ouverte par-dessus le feed.
 *
 * Route interceptée : une navigation interne vers /products/… atterrit ici,
 * un accès direct rend la page complète. C'est ce qui permet de respecter la
 * modale de la maquette sans renoncer à une URL partageable.
 */
export default async function ModaleFicheProduit({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const produit = await obtenirProduit(slug);

  if (!produit) notFound();

  return (
    <ModaleProduit>
      <EnTeteFiche titre={produit.titre} action={<BoutonFermer />} />
      <DetailProduit produit={produit} />
    </ModaleProduit>
  );
}
