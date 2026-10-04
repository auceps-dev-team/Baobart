import Link from "next/link";
import type { Route } from "next";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { lirePlans } from "@/lib/dashboard/lectures";
import { partDuCreateur } from "@/lib/domain/fees";
import { formatMoney } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Tarifs — Baobart.",
  description: "Ce que coûte Baobart : rien pour s'inscrire, le prix du créateur à l'achat, et les forfaits mensuels.",
};

export const dynamic = "force-dynamic";

const LICENCE: Record<string, string> = { PERSONAL: "Licence personnelle", COMMERCIAL: "Licence commerciale", EXTENDED: "Licence étendue" };

/**
 * Tarifs — l'écran `isTarifs` de la maquette : trois cartes, puis une FAQ.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI SE VEND AUJOURD'HUI, ET CE QUI NE SE VEND PAS ENCORE
 *
 * La maquette affichait « Free, Essentiel, Pro » à 0, 5 000 et 10 000 F, avec
 * 100 et 200 téléchargements. Les forfaits réels sont en base (`Plan`) :
 * Découverte, Explorer, Studio, avec leurs propres prix et quotas — on les lit.
 *
 * Mais lu le 04/10, aucun code du site ne CRÉE d'abonnement : seul le script
 * des comptes de test le fait (`scripts/comptes-de-test.ts`). Un forfait se
 * renouvelle (`/abonnement/[id]/renouveler`), il ne se souscrit pas. Les
 * cartes disent donc ce que chaque forfait ouvre, et que la souscription n'est
 * pas ouverte ; un bouton « S'abonner » mènerait nulle part.
 *
 * Les promesses de résolution, de filigrane et de « support prioritaire » ne
 * sont pas reprises : rien ne les applique (`Plan.features` les décrit, aucun
 * code ne les lit).
 */
export default async function TarifsPage() {
  const [visiteur, plans] = await Promise.all([sessionCourante(), lirePlans()]);
  const part = partDuCreateur().directe;
  const payants = plans.filter((p) => p.priceMonthly > 0);

  const faq = [
    {
      q: "Faut-il un forfait pour utiliser Baobart ?",
      a: "Non. Un compte gratuit télécharge toutes les ressources offertes, sans limite, et achète les autres à l'unité. Un forfait sert à télécharger des ressources payantes chaque mois sans les acheter une à une.",
    },
    {
      q: "Quels forfaits existent ?",
      a: `${plans.map((p) => `${p.name} (${formatMoney(p.priceMonthly, "XOF")} par mois, ${p.downloadsPerMonth === null ? "téléchargements illimités" : `${p.downloadsPerMonth} téléchargements`})`).join(", ")}. La souscription en ligne n'est pas encore ouverte.`,
    },
    {
      q: "Quelle différence entre licence personnelle et commerciale ?",
      a: "La personnelle couvre l'usage privé et les projets non commerciaux. La commerciale couvre les projets pour un client et les produits vendus. Le détail, et ce que chacune exclut, est sur la page Licences.",
    },
    {
      q: "Ce que j'achète reste-t-il accessible ?",
      a: "Oui. Un achat à l'unité donne un droit permanent, hors de tout quota : tu retrouves le fichier dans tes téléchargements, et sa clé de licence sur sa fiche. Ce qui le referme : un remboursement intégral, une contestation de paiement en cours, ou un retrait juridique de la ressource.",
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
            S&apos;inscrire ne coûte rien. Chaque ressource payante a le prix que son créateur lui donne ; les forfaits ouvrent
            des téléchargements chaque mois.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(280px,100%),1fr))", gap: 18, marginTop: 24 }}>
            <Carte
              nom="Sans forfait"
              prix="0 F"
              par="pour toujours"
              fond={BLANC}
              points={[
                "Les ressources offertes, sans limite",
                "Les ressources payantes, à l'unité, au prix du créateur",
                "La licence choisie par le créateur, et sa clé",
                "Collections, communautés, commentaires",
              ]}
              action={visiteur ? { label: "Explorer les ressources", href: "/explore" } : { label: "Créer un compte", href: "/inscription" }}
            />
            {payants.map((p, i) => (
              <Carte
                key={p.id}
                nom={p.name}
                prix={formatMoney(p.priceMonthly, "XOF")}
                par="/ mois"
                fond={i === 0 ? JAUNE : BLANC}
                points={[
                  p.downloadsPerMonth === null ? "Téléchargements illimités" : `${p.downloadsPerMonth} téléchargements de ressources payantes par mois`,
                  p.licenseIncluded ? LICENCE[p.licenseIncluded] ?? p.licenseIncluded : "Licence de la ressource",
                  "Le quota repart chaque mois",
                ]}
                action={null}
              />
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

function Carte({
  nom,
  prix,
  par,
  fond,
  points,
  action,
}: {
  nom: string;
  prix: string;
  par: string;
  fond: string;
  points: string[];
  action: { label: string; href: string } | null;
}) {
  return (
    <div data-tarif={nom} style={{ border: CADRE, borderRadius: 24, background: fond, boxShadow: `6px 6px 0 ${ENCRE}`, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, textTransform: "uppercase" }}>{nom}</div>
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
      {action ? (
        <Link href={action.href as Route} style={{ padding: 14, border: CADRE, borderRadius: 14, background: ENCRE, color: BLANC, textAlign: "center", fontSize: 14, fontWeight: 800 }}>
          {action.label}
        </Link>
      ) : (
        <div aria-disabled="true" style={{ padding: 14, border: CADRE, borderRadius: 14, background: MAUVE, color: ENCRE, textAlign: "center", fontSize: 13.5, fontWeight: 800, opacity: 0.75 }}>
          Souscription pas encore ouverte
        </div>
      )}
    </div>
  );
}
