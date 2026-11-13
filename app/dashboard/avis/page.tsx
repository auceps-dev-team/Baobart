import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { CarteAvis } from "@/components/avis/carte-avis";
import { FormulaireReponse } from "@/components/avis/formulaire-reponse";
import { BLANC, DashboardFrame, DashboardPanel, EmptyState, ENCRE, JAUNE, MetricCard } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { avisRecus, FILTRES_AVIS, type FiltreAvis } from "@/lib/avis/lecture";
import { lireProfilDashboard } from "@/lib/dashboard/lectures";
import { formatCount } from "@/lib/i18n/money";
import { MAUVE } from "@/lib/systeme/charte";

export const metadata = { title: "Avis & commentaires — Baobart." };
export const dynamic = "force-dynamic";

/**
 * « Avis & commentaires », la page `c_avis` de « Baobart Dashboard.dc.html » :
 * les filtres de la maquette, chaque avis avec son état (« À RÉPONDRE » /
 * « RÉPONDU ») et sa réponse. Lot 4, 09/11/2026.
 *
 * Deux écarts avec la maquette, et leur raison :
 *   — l'introduction ne dit pas « Réponds vite : ça pèse dans le classement ».
 *     Le responsable du dépôt a décidé le 09/11 que les avis ne pèsent pas
 *     encore dans l'ordre de la grille ; l'écrire serait promettre ce que le
 *     code ne tient pas ;
 *   — « Répondre à tout » ouvre les avis sans réponse : on répond à chacun, il
 *     n'existe pas de réponse groupée — un même texte collé sous dix avis se
 *     lirait comme une réponse automatique.
 *
 * Seuls les avis COMPTÉS s'affichent (`lib/avis/lecture.ts`) : ceux que la note
 * de la boutique prend en compte.
 */
export default async function AvisPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/dashboard/avis");
  // Écran de vendeur : la barre latérale ne le montre pas à un acheteur, et
  // l'URL tapée à la main l'ouvrait quand même (audit du 31/10, Q3-4).
  if (utilisateur.progression.etape === "ACHETEUR") redirect("/dashboard/apercu");

  const demande = (await searchParams).filtre;
  const filtre: FiltreAvis = FILTRES_AVIS.some((f) => f.cle === demande) ? (demande as FiltreAvis) : "tous";
  const [profil, recus] = await Promise.all([lireProfilDashboard(utilisateur.id), avisRecus(utilisateur.id, filtre)]);

  const note = profil?.profile && profil.profile.ratingCount > 0 ? Number(profil.profile.ratingAvg).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—";
  // « 1 attend », « 2 attendent » : l’intro disait « 1 attendent » (relu le 13/11).
  const enAttente = (n: number) =>
    n === 0 ? "Tu as répondu à tout." : `${formatCount(n)} avis ${n > 1 ? "attendent" : "attend"} ta réponse.`;
  const intro =
    recus.total > 0
      ? `${formatCount(recus.total)} avis, note moyenne ${note}. ${enAttente(recus.sansReponse)}`
      : "Les avis arrivent quand tes ressources sont obtenues, puis notées.";

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Avis & commentaires"
      description={intro}
      action={
        <Link
          href={"/dashboard/avis?filtre=sans-reponse" as Route}
          className="sticker-press"
          style={{ padding: "11px 18px", border: `2.5px solid ${ENCRE}`, borderRadius: 13, background: JAUNE, boxShadow: `4px 4px 0 ${ENCRE}`, fontSize: 13, fontWeight: 800 }}
        >
          Répondre à tout
        </Link>
      }
    >
      <div data-avis-recus style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/*
          Dans la file « Sans réponse », l'avis auquel on vient de répondre sort
          de la liste — et le message du formulaire part avec lui (mesuré au
          navigateur le 13/11). Cette ligne reste, change de texte, et c'est ce
          changement qu'un lecteur d'écran annonce.
        */}
        {filtre === "sans-reponse" ? (
          <p role="status" className="sr-only">
            {enAttente(recus.sansReponse)}
          </p>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
          <MetricCard label="Note de la boutique" value={note} hint={recus.total > 0 ? `sur ${formatCount(recus.total)} avis` : "aucun avis encore"} accent />
          <MetricCard label="Avis reçus" value={formatCount(recus.total)} hint="ceux qui comptent dans la note" />
          <MetricCard label="Sans réponse" value={formatCount(recus.sansReponse)} hint={recus.sansReponse > 0 ? "ils attendent un mot de toi" : "rien en attente"} mauve />
        </div>

        <nav aria-label="Filtrer les avis" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FILTRES_AVIS.map((f) => {
            const actif = f.cle === filtre;
            return (
              <Link
                key={f.cle}
                href={(f.cle === "tous" ? "/dashboard/avis" : `/dashboard/avis?filtre=${f.cle}`) as Route}
                aria-current={actif ? "page" : undefined}
                style={{ padding: "8px 14px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: actif ? ENCRE : BLANC, color: actif ? BLANC : ENCRE, fontSize: 12.5, fontWeight: 800 }}
              >
                {f.libelle}
              </Link>
            );
          })}
        </nav>

        <DashboardPanel titre="Derniers avis">
          {recus.avis.length === 0 ? (
            <EmptyState
              titre={filtre === "tous" ? "Aucun avis pour l'instant" : "Aucun avis dans ce filtre"}
              texte={filtre === "sans-reponse" ? "Tu as répondu à tous les avis reçus." : "Les avis apparaîtront ici dès que tes acheteurs noteront tes ressources."}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {recus.avis.map((a) => (
                <div key={a.id}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        border: `2px solid ${ENCRE}`,
                        borderRadius: 999,
                        background: a.reponse ? BLANC : MAUVE,
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        fontWeight: 700,
                      }}
                    >
                      {a.reponse ? "RÉPONDU" : "À RÉPONDRE"}
                    </span>
                    <Link href={`/products/${a.ressource.slug}#avis` as Route} style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {a.ressource.nom}
                    </Link>
                  </div>
                  <CarteAvis avis={a} />
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 800, width: "fit-content" }}>
                      {a.reponse ? "Modifier ma réponse" : "Répondre"}
                    </summary>
                    <FormulaireReponse avisId={a.id} reponse={a.reponse?.texte ?? null} />
                  </details>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>
    </DashboardFrame>
  );
}
