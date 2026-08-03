import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";

export const metadata = { title: "Tableau de bord — Baobart." };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  return (
    <main style={{ padding: 40 }}>
      <h1>Bonjour {utilisateur.nom}</h1>
    </main>
  );
}
