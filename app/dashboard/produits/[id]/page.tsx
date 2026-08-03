import { notFound, redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/i18n/money";

export const metadata = { title: "Ressource — Baobart." };
export const dynamic = "force-dynamic";

const ENCRE = "#121212";
const CADRE = `2.5px solid ${ENCRE}`;

export default async function ProduitDuTableauDeBord({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const { id } = await params;
  const produit = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      price: true,
      currency: true,
      family: true,
      description: true,
      sellerId: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  // Une ressource qui n'est pas la sienne répond comme si elle n'existait pas :
  // dire « accès refusé » confirmerait qu'elle existe.
  if (!produit || produit.sellerId !== utilisateur.id) notFound();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar
        etape={utilisateur.progression.etape}
        nom={utilisateur.nom}
        email={utilisateur.email}
      />

      <main style={{ flex: "1 1 auto", padding: "32px 36px", minWidth: 0 }}>
        <div
          style={{
            display: "inline-block",
            padding: "6px 12px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 999,
            background: produit.status === "PUBLISHED" ? "#FFD84A" : "#FFFFFF",
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: ".1em",
          }}
        >
          {produit.status === "PUBLISHED" ? "En ligne" : "Brouillon"}
        </div>

        <h1
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: "clamp(28px,3.2vw,40px)",
            letterSpacing: "-1.4px",
            margin: "12px 0 0",
            textTransform: "uppercase",
          }}
        >
          {produit.name}
        </h1>

        <div
          style={{
            marginTop: 24,
            maxWidth: 640,
            border: CADRE,
            borderRadius: 24,
            background: "#FFFFFF",
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {[
            ["Prix", formatPrice(produit.price, produit.currency)],
            ["Catégorie", produit.family ?? "—"],
            [
              "Mots-clés",
              produit.tags.map((t) => t.tag.name).join(", ") || "—",
            ],
            ["Description", produit.description ?? "—"],
          ].map(([cle, valeur]) => (
            <div
              key={cle}
              style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
            >
              <span style={{ opacity: 0.6, fontSize: 13, fontWeight: 600 }}>
                {cle}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700, textAlign: "right" }}>
                {valeur}
              </span>
            </div>
          ))}
        </div>

        <p
          style={{
            marginTop: 20,
            fontSize: 13.5,
            fontWeight: 600,
            opacity: 0.7,
            maxWidth: 640,
          }}
        >
          L&apos;envoi du fichier et la publication arrivent avec le module
          d&apos;upload.
        </p>
      </main>
    </div>
  );
}
