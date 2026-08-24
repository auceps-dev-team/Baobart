import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState, ENCRE } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { lireCollections } from "@/lib/dashboard/lectures";

export const metadata = { title: "Collections — Baobart." };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const collections = await lireCollections(utilisateur.id);

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Mes collections" description="Les tableaux rassemblent tes ressources et inspirations sauvegardées.">
      <DashboardPanel titre="Tableaux">
        {collections.length === 0 ? (
          <EmptyState titre="Aucune collection" texte="Épingle une ressource depuis le feed pour commencer à organiser ta bibliothèque visuelle." action={<Link href="/explore" style={{ fontWeight: 900 }}>Explorer →</Link>} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            {collections.map((c) => (
              <div key={c.id} style={{ border: `2px solid ${ENCRE}`, borderRadius: 18, padding: 16, background: "#F4EEFC" }}>
                <strong>{c.title}</strong>
                <p style={{ margin: "6px 0 0", fontSize: 13, opacity: .7 }}>{c.description ?? "Sans description"}</p>
                <div style={{ marginTop: 12, fontSize: 12, fontWeight: 800 }}>{c._count.saves} élément(s) · {c.isPublic ? "public" : "privé"}</div>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>
    </DashboardFrame>
  );
}
