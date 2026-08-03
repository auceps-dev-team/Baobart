import { notFound } from "next/navigation";

import { DetailProduit, EnTeteFiche } from "@/components/product/detail";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { droitDeTelecharger, obtenirProduit } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const produit = await obtenirProduit(slug);
  if (!produit) return { title: "Ressource introuvable — Baobart." };

  return {
    title: `${produit.titre} — Baobart.`,
    description:
      produit.description ??
      `${produit.famille ?? "Ressource"} par ${produit.auteur.nom} sur Baobart.`,
  };
}

/**
 * Fiche ressource en page complète.
 *
 * C'est ce que voit un accès direct ou un lien partagé. Depuis le feed, la même
 * fiche s'ouvre en modale (route interceptée) — comme dans la maquette.
 */
export default async function FicheProduitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [produit, utilisateur] = await Promise.all([
    obtenirProduit(slug),
    sessionCourante(),
  ]);

  if (!produit) notFound();

  const droit = await droitDeTelecharger(produit.id, utilisateur?.id ?? null);

  return (
    <>
      <Header utilisateur={utilisateur} />
      <main
        style={{
          minHeight: "100vh",
          background: "#EADFF9",
          padding: "24px 32px 0",
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            border: "3px solid #121212",
            borderRadius: 28,
            background: "#EADFF9",
            boxShadow: "10px 10px 0 #121212",
          }}
        >
          <EnTeteFiche titre={produit.titre} />
          <DetailProduit produit={produit} droit={droit} />
        </div>
        <Footer />
      </main>
    </>
  );
}
