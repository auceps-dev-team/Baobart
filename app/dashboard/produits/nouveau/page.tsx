import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { FormulaireProduit } from "@/components/dashboard/product-form";
import { sessionCourante } from "@/lib/auth/session";
import { creerBrouillon } from "@/lib/products/actions";

export const metadata = { title: "Publier une ressource — Baobart." };
export const dynamic = "force-dynamic";

export default async function NouveauProduitPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar
        etape={utilisateur.progression.etape}
        nom={utilisateur.nom}
        email={utilisateur.email}
      />

      <main style={{ flex: "1 1 auto", padding: "32px 36px", minWidth: 0 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px,3.2vw,40px)",
            letterSpacing: "-1.4px",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          Publier une ressource
        </h1>
        <p
          style={{
            fontSize: 14.5,
            fontWeight: 500,
            opacity: 0.75,
            margin: "8px 0 24px",
            maxWidth: 640,
          }}
        >
          Formats acceptés : PNG, JPG, AI, PSD, SVG, TTF, MP4, ZIP — 200 Mo max.
          Ta ressource est enregistrée en brouillon : elle ne sera visible
          qu&apos;une fois publiée.
        </p>

        <FormulaireProduit action={creerBrouillon} />
      </main>
    </div>
  );
}
