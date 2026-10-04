import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { FormulaireCollection } from "@/components/collections/formulaire";
import { DashboardFrame } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { mesCollections } from "@/lib/collections/service";
import { BLANC, CADRE, ENCRE, LAVANDE } from "@/lib/systeme/charte";

export const metadata = { title: "Collections — Baobart." };
export const dynamic = "force-dynamic";

const TRAME = `repeating-linear-gradient(135deg,${LAVANDE} 0 7px,${BLANC} 7px 16px)`;

/**
 * Mes collections : en créer une, retrouver les siennes.
 *
 * L'écran invitait à « épingler une ressource depuis le feed » alors que rien
 * ne le permettait (relevé le 04/10). On crée ici, on range depuis le bouton
 * « Épingler » des cartes, et on partage une collection depuis la page d'une
 * communauté.
 */
export default async function CollectionsPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const collections = await mesCollections(utilisateur.id);

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Mes collections" description="Range les ressources d'un projet. Épingle-les depuis les cartes de la mosaïque.">
      <div style={{ display: "grid", gap: 22 }}>
        <FormulaireCollection />

        {collections.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, opacity: 0.75, maxWidth: 560 }}>
            Aucune collection pour l&apos;instant. Crée la première ci-dessus, ou épingle une ressource depuis{" "}
            <Link href="/explore" style={{ fontWeight: 800, color: ENCRE }}>
              Explorer
            </Link>{" "}
            : le choix « Épingler » propose d&apos;en créer une.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(240px,100%),1fr))", gap: 16 }}>
            {collections.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/collections/${c.id}` as Route}
                className="sticker-press"
                data-collection={c.id}
                style={{ display: "block", border: CADRE, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 12, color: ENCRE }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, height: 120 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        border: `2px solid ${ENCRE}`,
                        borderRadius: 10,
                        background: c.apercu[i] ? `url(${JSON.stringify(c.apercu[i])}) center / cover no-repeat` : TRAME,
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 10 }}>{c.titre}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.65, marginTop: 2 }}>
                  {c.ressources} ressource{c.ressources > 1 ? "s" : ""} · {c.publique ? "publique" : "privée"}
                  {c.communaute ? ` · partagée avec ${c.communaute.nom}` : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardFrame>
  );
}
