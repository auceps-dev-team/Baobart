import { redirect } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { deconnecter } from "@/lib/auth/actions";
import { sessionCourante } from "@/lib/auth/session";
import { messageProgression } from "@/lib/dashboard/nav";

export const metadata = { title: "Tableau de bord — Baobart." };
export const dynamic = "force-dynamic";

const ENCRE = "#121212";
const CADRE = `2.5px solid ${ENCRE}`;

export default async function DashboardPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const { etape, aDesProduits, aPublie } = utilisateur.progression;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar
        etape={etape}
        nom={utilisateur.nom}
        email={utilisateur.email}
      />

      <main style={{ flex: "1 1 auto", padding: "32px 36px", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: "clamp(30px,3.4vw,44px)",
                letterSpacing: "-1.4px",
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              Bonjour {utilisateur.nom}
            </h1>
            <p
              style={{
                fontSize: 15,
                fontWeight: 500,
                opacity: 0.75,
                margin: "8px 0 0",
                maxWidth: 560,
              }}
            >
              {messageProgression(etape)}
            </p>
          </div>

          <form action={deconnecter}>
            <button
              type="submit"
              style={{
                padding: "11px 18px",
                border: CADRE,
                borderRadius: 13,
                background: "#FFFFFF",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Se déconnecter
            </button>
          </form>
        </div>

        <div
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 16,
          }}
        >
          {[
            { cle: "Étape", valeur: etape },
            { cle: "Produits déposés", valeur: aDesProduits ? "oui" : "aucun" },
            { cle: "Publié", valeur: aPublie ? "oui" : "pas encore" },
          ].map((k) => (
            <div
              key={k.cle}
              style={{
                border: CADRE,
                borderRadius: 20,
                background: "#FFFFFF",
                boxShadow: `4px 4px 0 ${ENCRE}`,
                padding: 18,
              }}
            >
              <div
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  opacity: 0.6,
                }}
              >
                {k.cle}
              </div>
              <div
                style={{
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: 26,
                  marginTop: 8,
                }}
              >
                {k.valeur}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
