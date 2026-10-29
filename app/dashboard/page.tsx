import Link from "next/link";
import { redirect } from "next/navigation";

import {
  DashboardFrame,
  DashboardPanel,
  EmptyState,
  MetricCard,
  CADRE,
  ENCRE,
  JAUNE,
} from "@/components/dashboard/frame";
import { RevenusParMois } from "@/components/dashboard/revenus-mois";
import { UrlBoutique } from "@/components/dashboard/url-boutique";
import { Vignette } from "@/components/dashboard/vignette";
import { deconnecter } from "@/lib/auth/actions";
import { sessionCourante } from "@/lib/auth/session";
import { urlDuSite } from "@/lib/config/site";
import { indicateursCreateur } from "@/lib/dashboard/indicateurs";
import { lireResumeDashboard, lireVentesCreateur } from "@/lib/dashboard/lectures";
import { encaisseDe } from "@/lib/domain/encaisse";
import { nomDuMoisPrecedent, variation } from "@/lib/dashboard/mois";
import { messageProgression } from "@/lib/dashboard/nav";
import { formatCount, formatMoney } from "@/lib/i18n/money";
import { MAUVE, TON_ETAT } from "@/lib/systeme/charte";
import { ETATS_VENTE, etatDeLaVente } from "@/lib/ventes/etats";

export const metadata = { title: "Tableau de bord — Baobart." };
export const dynamic = "force-dynamic";

/**
 * L'accueil du tableau de bord — « Tableau de bord » de `Baobart Dashboard.dc.html`.
 *
 * Revu le 27/10 : l'écran montrait l'étape du compte, un compteur de produits,
 * les achats et le solde, puis une liste de produits et quatre raccourcis — ni
 * gains, ni ventes, ni courbe. La maquette, elle, ouvre sur les chiffres de la
 * boutique. Ce qui manquait est maintenant là ; ce que la maquette montre et
 * qu'on ne sait pas mesurer honnêtement est écrit dans `lib/dashboard/indicateurs.ts`.
 *
 * Un acheteur sans boutique est renvoyé à son Aperçu (`/dashboard/apercu`) :
 * la vue du vendeur n'aurait que des zéros à lui montrer.
 */
export default async function DashboardPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  // Un acheteur sans boutique n'a rien à lire ici : son écran est l'Aperçu.
  // La connexion mène à `/dashboard` pour tout le monde ; c'est ici qu'on trie.
  if (utilisateur.progression.etape === "ACHETEUR") redirect("/dashboard/apercu");

  const action = (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Link
        href="/dashboard/produits/nouveau"
        className="sticker-press"
        style={{ padding: "11px 18px", border: CADRE, borderRadius: 13, background: JAUNE, boxShadow: `4px 4px 0 ${ENCRE}`, fontSize: 13, fontWeight: 800 }}
      >
        Ajouter un produit
      </Link>
      <form action={deconnecter}>
        <button type="submit" style={{ padding: "11px 18px", border: CADRE, borderRadius: 13, background: "#FFFFFF", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
          Se déconnecter
        </button>
      </form>
    </div>
  );

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre={`Bonjour ${utilisateur.nom}`}
      description="Tes gains, tes ventes et l'audience de ta boutique ce mois-ci."
      action={action}
    >
      <VueVendeur userId={utilisateur.id} username={utilisateur.username} progression={messageProgression(utilisateur.progression)} />
    </DashboardFrame>
  );
}

const grilleCartes = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 } as const;

async function VueVendeur({ userId, username, progression }: { userId: string; username: string | null; progression: string }) {
  const maintenant = new Date();
  const [i, resume, ventes] = await Promise.all([
    indicateursCreateur(userId, maintenant),
    lireResumeDashboard(userId),
    lireVentesCreateur(userId, 4),
  ]);
  const argent = (n: number) => formatMoney(n, i.devise);
  const ecart = variation(i.gainsMois, i.gainsMoisPrecedent);
  const base = urlDuSite() ?? "";

  return (
    <>
      <div style={grilleCartes}>
        <MetricCard
          label="Gains ce mois"
          value={argent(i.gainsMois)}
          hint={ecart === null ? "premier mois chiffré" : `${ecart > 0 ? "+" : ""}${ecart} % vs ${nomDuMoisPrecedent(maintenant)}`}
          accent
        />
        <MetricCard label="Solde à verser" value={argent(resume.soldeDisponible)} hint="part prochain versement" />
        <MetricCard label="Ventes" value={formatCount(i.ventesTotal)} hint={`+${i.ventesMois} ce mois`} />
        <MetricCard label="Vues de page" value={formatCount(i.vues)} hint="de ta vitrine, depuis l'ouverture" mauve />
        <MetricCard
          label="Taux de conversion"
          value={i.conversion === null ? "—" : `${i.conversion.toLocaleString("fr-FR")} %`}
          hint={i.conversion === null ? "vues comptées depuis le 16/10" : "vues → vente"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18, marginTop: 18 }}>
        <section style={{ border: CADRE, borderRadius: 24, background: MAUVE, boxShadow: `5px 5px 0 ${ENCRE}`, padding: 20 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20, textTransform: "uppercase", letterSpacing: "-.5px" }}>Ton prochain geste</h2>
          <p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 650, lineHeight: 1.5 }}>{progression}</p>
        </section>
        <section style={{ border: CADRE, borderRadius: 24, background: "#FFFFFF", boxShadow: `5px 5px 0 ${ENCRE}`, padding: 20 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", opacity: 0.62, marginBottom: 12 }}>
            L&apos;URL de ta boutique
          </div>
          {username ? (
            <UrlBoutique adresse={`${base}/@${username}`} />
          ) : (
            <p style={{ margin: 0, fontSize: 13.5 }}>
              Choisis un nom d&apos;utilisateur dans <Link href="/dashboard/profil" style={{ fontWeight: 800, textDecoration: "underline" }}>ton profil</Link> pour avoir ton adresse.
            </p>
          )}
        </section>
      </div>

      <div style={{ marginTop: 18 }}>
        <DashboardPanel titre="Revenus par mois" action={<span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.6 }}>6 derniers mois</span>}>
          <RevenusParMois barres={i.revenus} format={compact} />
        </DashboardPanel>
      </div>

      <div style={{ marginTop: 18 }}>
        <DashboardPanel
          titre="Dernières ventes"
          action={
            <Link href="/dashboard/ventes" style={{ fontSize: 13, fontWeight: 800, textDecoration: "underline" }}>
              Toutes les ventes →
            </Link>
          }
        >
          {ventes.length === 0 ? (
            <EmptyState titre="Pas encore de vente." texte="Ta première vente apparaîtra ici, avec son montant et son état." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {ventes.map((v) => {
                const brut = encaisseDe(v);
                const etat = etatDeLaVente({
                  state: v.state,
                  brut,
                  rembourse: v.refundedAmount,
                  litige: v.chargebackAt !== null && v.chargebackReversedAt === null,
                  accesRetire: v.accessRevokedAt !== null,
                });
                const ton = TON_ETAT[ETATS_VENTE[etat].ton]!;
                return (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 13, border: `2px solid ${ENCRE}`, borderRadius: 16, padding: 12, background: "#F4EEFC" }}>
                    <Vignette couverture={v.product.coverUrl} titre={v.product.name} />
                    <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.product.name}</span>
                      <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.66 }}>
                        {v.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}
                        {v.order.buyer.profile?.displayName ?? "un acheteur"}
                      </span>
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 900, whiteSpace: "nowrap" }}>+{formatMoney(brut, v.product.currency)}</span>
                    <span style={{ padding: "4px 10px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: ton.fond, color: ton.encre, fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                      {etat}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardPanel>
      </div>
    </>
  );
}

/** « 121k » sous une barre : la carte du dessus donne le montant exact. */
function compact(n: number): string {
  if (Math.abs(n) < 1000) return String(n);
  return `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: n % 1000 === 0 ? 0 : 1 })}k`;
}
