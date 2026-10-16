import { notFound } from "next/navigation";

import { DetailProduit, EnTeteFiche, RetourAchat } from "@/components/product/detail";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { urlDuSite } from "@/lib/config/site";
import { absolue } from "@/lib/reseaux/partage";
import { droitDeTelecharger, obtenirProduit } from "@/lib/products/queries";
import { commentairesDe, etatSocial } from "@/lib/social/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const produit = await obtenirProduit(slug);
  if (!produit) return { title: "Ressource introuvable — Baobart." };

  const description =
    produit.description ??
    `${produit.famille ?? "Ressource"} par ${produit.auteur.nom} sur Baobart.`;
  const base = urlDuSite();
  const image = produit.coverUrl && base ? absolue(produit.coverUrl, base) : produit.coverUrl;

  return {
    title: `${produit.titre} — Baobart.`,
    description,
    // L'aperçu d'un lien partagé montre la ressource, plus l'image du site.
    // Le bloc `openGraph` porte son propre titre : déclaré ici sans titre,
    // il remplacerait celui que Next tirait de la page (voir l'avertissement
    // de `app/layout.tsx`). L'image est la couverture que la fiche affiche
    // déjà à tout visiteur : l'aperçu n'en montre pas davantage.
    ...(image
      ? {
          openGraph: {
            type: "website",
            title: produit.titre,
            description,
            images: [image],
          },
          twitter: { card: "summary_large_image" },
        }
      : {}),
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ achat?: string; montant?: string; minimum?: string }>;
}) {
  const { slug } = await params;
  const { achat, montant, minimum } = await searchParams;
  const [produit, utilisateur] = await Promise.all([
    obtenirProduit(slug),
    sessionCourante(),
  ]);

  if (!produit) notFound();

  const [droit, social, commentaires] = await Promise.all([
    droitDeTelecharger(produit.id, utilisateur?.id ?? null),
    etatSocial({
      produitId: produit.id,
      createurId: produit.auteur.id,
      userId: utilisateur?.id ?? null,
    }),
    commentairesDe(produit.id, utilisateur?.id ?? null, produit.auteur.id),
  ]);

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
          <div style={{ padding: "0 24px" }}>
            <RetourAchat code={achat} montant={montant} minimum={minimum} />
          </div>
          <DetailProduit
            produit={produit}
            droit={droit}
            social={{ ...social, connecte: utilisateur !== null }}
            commentaires={commentaires}
          />
        </div>
        <Footer />
      </main>
    </>
  );
}
