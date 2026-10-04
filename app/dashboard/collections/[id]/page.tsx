import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { FormulaireCollection } from "@/components/collections/formulaire";
import { RetirerDeLaCollection, SupprimerLaCollection } from "@/components/collections/gestes";
import { DashboardFrame } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { collectionAVoir } from "@/lib/collections/service";
import { BLANC, CADRE, ENCRE, LAVANDE } from "@/lib/systeme/charte";

export const metadata = { title: "Collection — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Une collection et ce qu'elle range.
 *
 * Visible de son propriétaire, des membres de la communauté avec laquelle elle
 * est partagée, et de tout membre connecté si elle est publique — voir
 * `lib/collections/regles.ts`. Sinon, 404 : dire « elle existe mais ce n'est
 * pas pour toi » apprendrait qu'elle existe.
 */
export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const { id } = await params;
  const c = await collectionAVoir(utilisateur.id, id);
  if (!c) notFound();

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre={c.titre}
      description={[
        `${c.ressources.length} ressource${c.ressources.length > 1 ? "s" : ""}`,
        c.publique ? "publique" : "privée",
        c.communaute ? `partagée avec ${c.communaute.nom}` : null,
        c.modifiable ? null : `de ${c.proprietaire}`,
      ]
        .filter(Boolean)
        .join(" · ")}
      action={
        <Link href={"/dashboard/collections" as Route} style={{ padding: "10px 16px", border: CADRE, borderRadius: 13, background: BLANC, fontSize: 13, fontWeight: 800, color: ENCRE }}>
          ← Mes collections
        </Link>
      }
    >
      <div style={{ display: "grid", gap: 22 }}>
        {c.description ? <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, opacity: 0.8, maxWidth: 680 }}>{c.description}</p> : null}

        {c.communaute ? (
          <Link href={`/communautes/${c.communaute.slug}` as Route} style={{ fontSize: 13.5, fontWeight: 800, color: ENCRE }}>
            Ouvrir l&apos;espace « {c.communaute.nom} » →
          </Link>
        ) : null}

        {c.ressources.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, opacity: 0.75 }}>
            Rien de rangé pour l&apos;instant. Épingle une ressource depuis{" "}
            <Link href="/explore" style={{ fontWeight: 800, color: ENCRE }}>
              Explorer
            </Link>
            .
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(200px,100%),1fr))", gap: 14 }}>
            {c.ressources.map((r) => (
              <div key={r.id} data-ressource={r.slug} style={{ border: CADRE, borderRadius: 18, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, overflow: "hidden" }}>
                <Link href={`/products/${r.slug}` as Route} style={{ display: "block", color: ENCRE }}>
                  <div style={{ height: 130, borderBottom: CADRE, background: r.coverUrl ? `url(${JSON.stringify(r.coverUrl)}) center / cover no-repeat` : LAVANDE }} />
                  <div style={{ padding: "10px 12px 0", fontSize: 13.5, fontWeight: 800 }}>{r.name}</div>
                </Link>
                <div style={{ padding: "8px 12px 12px" }}>{c.modifiable ? <RetirerDeLaCollection collectionId={c.id} produitId={r.id} /> : null}</div>
              </div>
            ))}
          </div>
        )}

        {c.modifiable ? (
          <div style={{ display: "grid", gap: 14 }}>
            <FormulaireCollection collectionId={c.id} depart={{ titre: c.titre, description: c.description ?? "", publique: c.publique }} />
            <SupprimerLaCollection collectionId={c.id} />
          </div>
        ) : null}
      </div>
    </DashboardFrame>
  );
}
