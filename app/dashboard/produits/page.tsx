import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatCount, formatPrice } from "@/lib/i18n/money";

export const metadata = { title: "Produits — Baobart." };
export const dynamic = "force-dynamic";

const ENCRE = "#121212";
const CADRE = `2.5px solid ${ENCRE}`;

export default async function MesProduitsPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const produits = await db.product.findMany({
    where: { sellerId: utilisateur.id },
    // Les brouillons d'abord : ce sont eux qui attendent une action.
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      price: true,
      currency: true,
      family: true,
      downloadsCount: true,
      _count: {
        select: { files: { where: { role: "SOURCE", deletedAt: null } } },
      },
    },
  });

  const brouillons = produits.filter((p) => p.status !== "PUBLISHED").length;

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
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: "clamp(28px,3.2vw,40px)",
                letterSpacing: "-1.4px",
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              Produits
            </h1>
            <p
              style={{
                fontSize: 14.5,
                fontWeight: 500,
                opacity: 0.75,
                margin: "8px 0 0",
              }}
            >
              {produits.length === 0
                ? "Rien encore. Dépose une première ressource."
                : `${produits.length} ressource${produits.length > 1 ? "s" : ""}${
                    brouillons > 0 ? ` · ${brouillons} en brouillon` : ""
                  }`}
            </p>
          </div>

          <Link
            href="/dashboard/produits/nouveau"
            className="sticker-press"
            style={{
              padding: "13px 22px",
              border: CADRE,
              borderRadius: 14,
              background: "#FFD84A",
              boxShadow: `4px 4px 0 ${ENCRE}`,
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            Ajouter un produit
          </Link>
        </div>

        <div
          style={{
            marginTop: 26,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxWidth: 900,
          }}
        >
          {produits.map((p) => (
            <a
              key={p.id}
              href={`/dashboard/produits/${p.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                border: CADRE,
                borderRadius: 18,
                background: "#FFFFFF",
                boxShadow: `4px 4px 0 ${ENCRE}`,
                padding: 16,
              }}
            >
              <span
                style={{
                  padding: "5px 11px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 999,
                  background: p.status === "PUBLISHED" ? "#FFD84A" : "#FFFFFF",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  whiteSpace: "nowrap",
                }}
              >
                {p.status === "PUBLISHED" ? "En ligne" : "Brouillon"}
              </span>

              <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 800 }}>
                  {p.name}
                </span>
                <span
                  style={{
                    display: "block",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 11,
                    opacity: 0.6,
                  }}
                >
                  {p.family ?? "sans catégorie"} ·{" "}
                  {formatCount(p.downloadsCount)} dl
                  {p._count.files === 0 ? " · aucun fichier" : ""}
                </span>
              </span>

              <span
                style={{
                  padding: "6px 12px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                {formatPrice(p.price, p.currency)}
              </span>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
