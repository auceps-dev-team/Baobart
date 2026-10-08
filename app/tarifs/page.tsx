import Link from "next/link";
import type { Route } from "next";

import { BoutonForfait } from "@/components/abonnements/bouton-forfait";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { ACCES_LIBRE, fonctionsDuForfait } from "@/lib/abonnements/grille";
import { sessionCourante } from "@/lib/auth/session";
import { lirePlans } from "@/lib/dashboard/lectures";
import { db } from "@/lib/db";
import { partDuCreateur } from "@/lib/domain/fees";
import { formatMoney } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, VERT } from "@/lib/systeme/charte";

export const metadata = {
  title: "Tarifs — Baobart.",
  description: "Accès libre, gratuit pour tous ; les forfaits payants à venir ; et le prix de chaque ressource, fixé par son créateur.",
};

export const dynamic = "force-dynamic";

/**
 * Tarifs — l'écran `isTarifs` de la maquette : des cartes, puis une FAQ.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN SEUL FORFAIT OUVERT, LES AUTRES GRISÉS
 *
 * Décidé le 05/10 : Accès libre, gratuit, « tout sauf le payant », s'active
 * d'un clic (`lib/abonnements/souscription.ts`). Les forfaits payants restent
 * dans la grille, grisés, avec leurs fonctionnalités et l'étiquette
 * « Bientôt » : rien de ce qu'ils annoncent n'est appliqué aujourd'hui, et
 * leur paiement n'est pas ouvert (`openForSubscription`). Ce qui est ouvert et
 * ce qui ne l'est pas se lit en base, pas dans cette page.
 *
 * La maquette affichait « Free, Essentiel, Pro » à 0, 5 000 et 10 000 F : les
 * forfaits réels sont ceux de `Plan`.
 */
export default async function TarifsPage() {
  const [visiteur, plans] = await Promise.all([sessionCourante(), lirePlans()]);
  const part = partDuCreateur().directe;
  const ouverts = plans.filter((p) => p.openForSubscription);
  const grises = plans.filter((p) => !p.openForSubscription).sort((a, b) => a.priceMonthly - b.priceMonthly);
  const enCours = visiteur
    ? await db.subscription.findFirst({
        where: { userId: visiteur.id, status: { in: ["ACTIVE", "PENDING_CANCELLATION"] } },
        select: { plan: { select: { code: true, name: true } } },
      })
    : null;

  const faq = [
    {
      q: "Faut-il payer pour utiliser Baobart ?",
      a: "Non. Accès libre est gratuit et s'active d'un clic : toutes les ressources offertes, sans limite, les collections, les communautés. Les ressources payantes s'achètent à l'unité, au prix que leur créateur leur donne.",
    },
    {
      q: "Et les forfaits payants ?",
      a: `${grises.map((p) => p.name).join(", ")} sont prévus, et grisés tant que leur paiement n'est pas ouvert. Ce qu'ils annoncent n'est pas encore appliqué.`,
    },
    {
      q: "Quelle différence entre licence personnelle et commerciale ?",
      a: "La personnelle couvre l'usage privé et les projets non commerciaux. La commerciale couvre les projets pour un client et les produits vendus. Chaque ressource porte la licence choisie par son créateur ; le détail est sur la page Licences.",
    },
    {
      q: "Ce que j'achète reste-t-il accessible ?",
      a: "Oui. Un achat à l'unité donne un droit permanent, hors de tout quota : tu retrouves le fichier dans tes téléchargements, et sa clé de licence sur sa fiche. Ce qui le referme : un remboursement intégral, une contestation de paiement en cours, ou un retrait juridique de la ressource.",
    },
    {
      q: "Puis-je être remboursé ?",
      a: "Dans le délai que le créateur affiche sur la fiche — aucun, 7, 14 ou 30 jours —, depuis ton espace « Remboursements ». Le créateur accepte ou refuse avec un motif ; sans réponse sous sept jours, l'équipe Baobart tranche.",
    },
    {
      q: "Comment sont rémunérés les créateurs ?",
      a: `Pour chaque vente, ${part} du prix revient au créateur : Baobart retient sa commission et les frais de l'opérateur de paiement. Le solde part chaque semaine, par mobile money ou virement.`,
    },
  ];

  return (
    <>
      <Header utilisateur={visiteur} />
      <main style={{ background: LAVANDE, minHeight: "100vh" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "44px 32px 0" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(32px,4.2vw,54px)", letterSpacing: "-2px", margin: 0, textTransform: "uppercase" }}>Tarifs</h1>
          <p style={{ fontSize: 16, fontWeight: 600, opacity: 0.75, margin: "8px 0 0", maxWidth: 760 }}>
            Accès libre est gratuit, pour tout le monde. Chaque ressource payante a le prix que son créateur lui donne ; les
            forfaits payants arriveront plus tard.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(260px,100%),1fr))", gap: 18, marginTop: 24 }}>
            {ouverts.map((p) => (
              <Carte key={p.id} nom={p.name} prix={formatMoney(p.priceMonthly, "XOF")} par="pour toujours" fond={JAUNE} points={p.includesPaidResources ? fonctionsDuForfait(p) : [...ACCES_LIBRE]}>
                {!visiteur ? (
                  <Link href={"/inscription" as Route} style={ctaNoir}>
                    Créer un compte, c&apos;est gratuit
                  </Link>
                ) : enCours?.plan.code === p.code ? (
                  <div data-forfait-actif style={{ display: "grid", gap: 8 }}>
                    <div style={{ padding: 14, border: CADRE, borderRadius: 14, background: VERT, textAlign: "center", fontSize: 14, fontWeight: 800 }}>Actif ✓</div>
                    <Link href={"/dashboard/forfait" as Route} style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: ENCRE }}>
                      Gérer mon forfait
                    </Link>
                  </div>
                ) : enCours ? (
                  <div style={{ padding: 14, border: CADRE, borderRadius: 14, background: BLANC, textAlign: "center", fontSize: 13.5, fontWeight: 700 }}>
                    Tu as déjà le forfait {enCours.plan.name}.
                  </div>
                ) : (
                  <BoutonForfait mode="activer" />
                )}
              </Carte>
            ))}
            {grises.map((p) => (
              <Carte key={p.id} nom={p.name} prix={formatMoney(p.priceMonthly, "XOF")} par="/ mois" fond={BLANC} grise points={fonctionsDuForfait(p)}>
                <div aria-disabled="true" style={{ padding: 14, border: CADRE, borderRadius: 14, background: "#DCDCDC", textAlign: "center", fontSize: 13.5, fontWeight: 800 }}>
                  Bientôt
                </div>
              </Carte>
            ))}
          </div>

          <div style={{ border: CADRE, borderRadius: 26, background: BLANC, boxShadow: `6px 6px 0 ${ENCRE}`, padding: 24, marginTop: 24 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, letterSpacing: "-1px", margin: "0 0 16px", textTransform: "uppercase" }}>FAQ</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {faq.map((f) => (
                <details key={f.q} data-faq style={{ border: CADRE, borderRadius: 16, background: BLANC, padding: "14px 16px" }}>
                  <summary style={{ fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>{f.q}</summary>
                  <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, marginTop: 10, opacity: 0.82 }}>{f.a}</div>
                </details>
              ))}
            </div>
            <p style={{ margin: "14px 0 0", fontSize: 13, fontWeight: 600 }}>
              Les licences en détail :{" "}
              <Link href={"/licences" as Route} style={{ color: ENCRE, fontWeight: 800 }}>
                la page Licences
              </Link>
              .
            </p>
          </div>
        </div>
        <Footer />
      </main>
    </>
  );
}

const ctaNoir: React.CSSProperties = {
  display: "block",
  padding: 14,
  border: CADRE,
  borderRadius: 14,
  background: ENCRE,
  color: BLANC,
  textAlign: "center",
  fontSize: 14,
  fontWeight: 800,
};

function Carte({
  nom,
  prix,
  par,
  fond,
  points,
  grise = false,
  children,
}: {
  nom: string;
  prix: string;
  par: string;
  fond: string;
  points: string[];
  grise?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-tarif={nom}
      data-grise={grise ? "1" : undefined}
      aria-disabled={grise || undefined}
      style={{ border: CADRE, borderRadius: 24, background: fond, boxShadow: `6px 6px 0 ${ENCRE}`, padding: 22, display: "flex", flexDirection: "column", gap: 14, position: "relative" }}
    >
      {/* Grisée, pas illisible : on doit pouvoir lire ce qui viendra. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: "1 1 auto", opacity: grise ? 0.5 : 1, filter: grise ? "grayscale(1)" : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, textTransform: "uppercase" }}>{nom}</div>
          {grise ? (
            <span style={{ padding: "4px 10px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: BLANC, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>Bientôt</span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, paddingBottom: 14, borderBottom: CADRE }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 36 }}>{prix}</div>
          <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}>{par}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: "1 1 auto" }}>
          {points.map((p) => (
            <div key={p} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 }}>
              <span style={{ flex: "0 0 auto", width: 18, height: 18, border: `2px solid ${ENCRE}`, borderRadius: 6, background: BLANC, display: "grid", placeItems: "center", fontSize: 11 }}>✓</span>
              {p}
            </div>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
