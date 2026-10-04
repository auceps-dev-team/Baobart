import Link from "next/link";
import type { Route } from "next";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { CarteTemoignage } from "@/components/temoignages/carte";
import { sessionCourante } from "@/lib/auth/session";
import { BAREME_XOF, partDuCreateur } from "@/lib/domain/fees";
import { compterCommunaute, compterParFamille, creditsAuxCreateurs, meilleuresVentes } from "@/lib/feed/queries";
import { formatCount, formatMoney } from "@/lib/i18n/money";
import { RAILS_BAOBART } from "@/lib/payments/payout-schedule";
import { temoignagesPublies } from "@/lib/temoignages/service";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE, ORANGE } from "@/lib/systeme/charte";

export const metadata = {
  title: "À propos — Baobart.",
  description: "Pourquoi Baobart existe, comment il se finance, et la façon de commencer : petit, ensemble, vite.",
};

export const dynamic = "force-dynamic";

/**
 * À propos.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA STRUCTURE DE GUMROAD, LES FAITS DE BAOBART
 *
 * Décidé le 04/10 : structurée d'après la page « About » de Gumroad, lue dans
 * son dépôt (antiwork/gumroad, `app/views/home/about.html.erb`, version du
 * 1er octobre 2026). Ses blocs, dans son ordre : un titre-promesse (« Go from
 * 0 to $1 ») et la bibliothèque à portée de main ; vendre n'importe quoi, à sa
 * façon, à tout le monde, partout ; « plutôt que de monter une entreprise,
 * commence par un projet à côté » ; la méthode en trois temps (commencer
 * petit, progresser ensemble, apprendre vite) ; un chiffre vivant — ce que les
 * créateurs ont gagné la semaine passée ; des témoignages ; des meilleures
 * ventes ; « place de petits paris » ; et l'appel final, « Share your work.
 * Someone out there needs it. »
 *
 * Ce qui n'est pas repris : le lien vers le code source (Baobart n'est pas
 * ouvert), et la barre de recherche, faute de page de résultats — elle devient
 * les familles de la bibliothèque, avec leur compte réel.
 *
 * Ce que disait la maquette (`DOCS.apropos`) et qui n'est pas repris : « 80 %
 * du prix revient au créateur » (88,5 %), et « une petite équipe basée à Dakar
 * et Abidjan, épaulée par des curateurs dans 14 pays » — Baobart est établie à
 * Abidjan, et rien n'atteste ni l'équipe de Dakar ni les curateurs.
 *
 * Chaque bloc nourri par la base disparaît quand la base est vide : pas de
 * témoignage inventé, pas de meilleure vente à zéro vente.
 */
export default async function AProposPage() {
  const [visiteur, familles, chiffres, credits, ventes, temoignages] = await Promise.all([
    sessionCourante(),
    compterParFamille(),
    compterCommunaute(),
    creditsAuxCreateurs(7),
    meilleuresVentes(6),
    temoignagesPublies(3),
  ]);
  const part = partDuCreateur().directe;
  const moyens = Object.values(RAILS_BAOBART).map((r) => r.label);
  const commencer = (visiteur ? "/dashboard/produits/nouveau" : "/inscription") as Route;

  return (
    <>
      <Header utilisateur={visiteur} />
      <main style={{ background: LAVANDE, minHeight: "100vh" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "44px 32px 0", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* ── De zéro à ton premier franc ─────────────────────────────── */}
          <section style={{ ...carte, background: BLANC, padding: "48px 32px", textAlign: "center" }}>
            <div style={pastille(JAUNE)}>À propos</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px,6vw,84px)", lineHeight: 0.92, letterSpacing: "-3px", margin: "18px auto 0", maxWidth: 980, textTransform: "uppercase" }}>
              De zéro à ton premier franc<span style={{ color: ORANGE }}>.</span>
            </h1>
            <p style={{ maxWidth: 640, margin: "18px auto 0", fontSize: 17, fontWeight: 500, lineHeight: 1.5, opacity: 0.8 }}>
              Tout le monde peut gagner son premier franc en ligne. Commence avec ce que tu sais faire, regarde ce qui
              marche, et fais-toi payer. Baobart s&apos;occupe du paiement, du fichier et de la licence.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
              <Link href={commencer} className="sticker-press" style={{ ...cta, background: JAUNE }}>
                Commencer à vendre
              </Link>
              <Link href="/explore" className="sticker-press" style={{ ...cta, background: BLANC }}>
                Explorer la bibliothèque
              </Link>
            </div>
            {familles.length > 0 ? (
              <div data-apropos-familles style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 26 }}>
                {familles.map((f) => (
                  <Link key={f.famille} href={`/explore?filtre=${encodeURIComponent(f.famille)}` as Route} style={{ padding: "9px 16px", border: CADRE, borderRadius: 999, background: "#F4EEFC", fontSize: 13, fontWeight: 800, color: ENCRE }}>
                    {f.famille} <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.6 }}>{formatCount(f.total)}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </section>

          {/* ── Vendre : quoi, comment, à qui, où ──────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(300px,100%),1fr))", gap: 18 }}>
            <Bloc fond={JAUNE} titre="Vends ce que tu crées">
              Illustrations, photos, mockups, polices, icônes, sons, vidéos, packs : si c&apos;est un fichier que quelqu&apos;un
              peut utiliser, il a sa place ici.
            </Bloc>
            <Bloc fond={BLANC} titre="Trace ta route">
              Fixe ton prix, offre une ressource, ou laisse l&apos;acheteur choisir au-dessus d&apos;un minimum. Choisis ta
              licence. Aucune exclusivité : ce que tu vends ici, tu peux le vendre ailleurs.
            </Bloc>
            <Bloc fond={MAUVE} titre="Vends à tout le monde">
              Tes acheteurs paient en francs CFA, par carte ou mobile money, sur la page sécurisée de l&apos;opérateur. Toi,
              tu reçois chaque semaine par {moyens.slice(0, -1).join(", ")} ou {moyens.at(-1)}.
            </Bloc>
            <Bloc fond={BLANC} titre="Vends partout">
              Chaque ressource a sa page, et ton profil la sienne. Leur lien se partage où sont tes clients : WhatsApp,
              Instagram, ton site, une carte de visite.
            </Bloc>
          </div>

          {/* ── Plutôt que de monter une entreprise ────────────────────── */}
          <section style={{ ...carte, background: ENCRE, color: BLANC, boxShadow: `7px 7px 0 ${ORANGE}`, padding: "40px 32px" }}>
            <h2 style={titreSection}>Plutôt que de monter une entreprise…</h2>
            <p style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.55, maxWidth: 760, margin: "14px 0 0", opacity: 0.85 }}>
              …commence par vendre un projet à côté. Pas de statuts à déposer, pas de boutique à coder, pas de terminal de
              paiement à louer : un fichier, un prix, une page. Si ça prend, tu grandis. Sinon, tu n&apos;as perdu
              qu&apos;une soirée.
            </p>
          </section>

          {/* ── La méthode ─────────────────────────────────────────────── */}
          <section style={{ ...carte, background: BLANC, padding: "36px 32px" }}>
            <h2 style={titreSection}>La méthode Baobart</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(260px,100%),1fr))", gap: 16, marginTop: 20 }}>
              {[
                { n: "01", t: "Commence petit", d: "Une ressource, pas un catalogue. Publie-la dès qu'elle est prête : il n'y a pas de relecture à attendre." },
                { n: "02", t: "Progresse ensemble", d: "Les communautés réunissent ceux qui font le même métier : on y montre son travail, on y apprend des autres." },
                { n: "03", t: "Apprends vite", d: "Tes ventes et tes téléchargements te disent ce qui plaît. Garde ce qui marche, change le reste." },
              ].map((e) => (
                <div key={e.n} style={{ border: CADRE, borderRadius: 20, padding: 18, background: "#F4EEFC" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.6 }}>{e.n}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{e.t}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, marginTop: 6, opacity: 0.8 }}>{e.d}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Le chiffre vivant ──────────────────────────────────────── */}
          <section data-apropos-chiffre style={{ ...carte, background: JAUNE, padding: "40px 32px", textAlign: "center" }}>
            {credits > 0 ? (
              <>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px,6vw,76px)", letterSpacing: "-2px" }}>{formatMoney(credits, "XOF")}</div>
                <p style={{ fontSize: 16, fontWeight: 700, margin: "8px 0 0" }}>crédités aux créateurs sur les ventes des sept derniers jours.</p>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(40px,6vw,76px)", letterSpacing: "-2px" }}>{formatCount(chiffres.createurs)}</div>
                <p style={{ fontSize: 16, fontWeight: 700, margin: "8px 0 0" }}>
                  créateur{chiffres.createurs > 1 ? "s" : ""} publie{chiffres.createurs > 1 ? "nt" : ""} déjà sur Baobart — {formatCount(chiffres.ressources)} ressource
                  {chiffres.ressources > 1 ? "s" : ""}.
                </p>
              </>
            )}
          </section>

          {temoignages.length > 0 ? (
            <section style={{ ...carte, background: BLANC, padding: "36px 32px" }}>
              <h2 style={titreSection}>Ils le disent mieux que nous</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(280px,100%),1fr))", gap: 16, marginTop: 20 }}>
                {temoignages.map((t, i) => (
                  <CarteTemoignage key={t.id} texte={t.texte} nom={t.nom} presentation={t.presentation} avatarUrl={t.avatarUrl} rang={i} />
                ))}
              </div>
            </section>
          ) : null}

          {ventes.length > 0 ? (
            <section data-apropos-ventes style={{ ...carte, background: BLANC, padding: "36px 32px" }}>
              <h2 style={titreSection}>Des possibilités sans fin</h2>
              <p style={{ fontSize: 15, fontWeight: 500, opacity: 0.75, margin: "8px 0 0" }}>Ce qui se vend le plus sur Baobart, en ce moment.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(200px,100%),1fr))", gap: 16, marginTop: 20 }}>
                {ventes.map((v) => (
                  <Link key={v.slug} href={`/products/${v.slug}` as Route} style={{ display: "flex", flexDirection: "column", gap: 8, color: ENCRE }}>
                    <div style={{ height: 160, border: CADRE, borderRadius: 18, boxShadow: `4px 4px 0 ${ENCRE}`, background: v.couverture ? `url(${JSON.stringify(v.couverture)}) center / cover no-repeat` : "#F4EEFC" }} />
                    <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{v.titre}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.65 }}>
                      {v.createur ? `${v.createur} · ` : ""}
                      {formatCount(v.ventes)} vente{v.ventes > 1 ? "s" : ""}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── Place de petits paris ──────────────────────────────────── */}
          <section style={{ ...carte, background: MAUVE, padding: "40px 32px" }}>
            <h2 style={titreSection}>Ne prends pas de risques</h2>
            <p style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.55, maxWidth: 760, margin: "14px 0 0" }}>
              Plutôt que de vendre un livre, commence par vendre un chapitre. Plutôt qu&apos;un pack de deux cents icônes,
              vends-en douze. Place de petits paris : tu sauras vite lesquels méritent d&apos;être agrandis.
            </p>
          </section>

          {/* ── Comment Baobart se finance, et qui le fait ─────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(300px,100%),1fr))", gap: 18 }}>
            <Bloc fond={BLANC} titre="Comment on se finance">
              Par une commission de {BAREME_XOF.directRateBp / 100} % sur chaque vente — tu gardes {part}, une fois
              déduits aussi les frais de l&apos;opérateur de paiement — et par les cartes sponsorisées de la mosaïque. Une ressource offerte ne
              rapporte rien à personne, et ne coûte rien non plus.
            </Bloc>
            <Bloc fond={BLANC} titre="Qui fait Baobart">
              Baobart est établie à Abidjan, en Côte d&apos;Ivoire. Une question, une idée, un partenariat :{" "}
              <Link href={"/contact" as Route} style={{ color: ENCRE, fontWeight: 800 }}>
                écris-nous
              </Link>
              .
            </Bloc>
          </div>

          {/* ── L'appel final ──────────────────────────────────────────── */}
          <section style={{ ...carte, background: ORANGE, color: BLANC, padding: "48px 32px", textAlign: "center" }}>
            <h2 style={{ ...titreSection, fontSize: "clamp(32px,4.6vw,58px)" }}>
              Partage ton travail.
              <br />
              Quelqu&apos;un, quelque part, en a besoin.
            </h2>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
              <Link href={commencer} className="sticker-press" style={{ ...cta, background: JAUNE }}>
                Commencer à vendre
              </Link>
            </div>
          </section>
        </div>
        <Footer />
      </main>
    </>
  );
}

function Bloc({ fond, titre, children }: { fond: string; titre: string; children: React.ReactNode }) {
  return (
    <section style={{ ...carte, background: fond, padding: 26 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1.05, letterSpacing: "-0.8px", margin: 0, textTransform: "uppercase" }}>{titre}</h2>
      <p style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.55, margin: "12px 0 0", opacity: 0.85 }}>{children}</p>
    </section>
  );
}

const carte: React.CSSProperties = { border: CADRE, borderRadius: 28, boxShadow: `7px 7px 0 ${ENCRE}`, color: ENCRE };

const titreSection: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(28px,3.6vw,44px)",
  lineHeight: 1,
  letterSpacing: "-1.6px",
  margin: 0,
  textTransform: "uppercase",
};

const cta: React.CSSProperties = {
  padding: "15px 28px",
  border: CADRE,
  borderRadius: 16,
  boxShadow: `5px 5px 0 ${ENCRE}`,
  fontSize: 15,
  fontWeight: 800,
  color: ENCRE,
  textDecoration: "none",
};

function pastille(fond: string): React.CSSProperties {
  return {
    display: "inline-block",
    border: CADRE,
    borderRadius: 999,
    background: fond,
    padding: "7px 16px",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: ".14em",
  };
}
