import Link from "next/link";
import type { Route } from "next";

import { ENTREES_RAIL } from "@/components/shell/nav-data";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { BAREME_XOF, partDuCreateur } from "@/lib/domain/fees";
import { couverturesPopulaires } from "@/lib/feed/queries";
import { RAILS_BAOBART } from "@/lib/payments/payout-schedule";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE, ORANGE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Fonctionnalités — Baobart.",
  description: "La boutique, le paiement, les licences et les espaces d'équipe : ce que Baobart fait aujourd'hui.",
};

export const dynamic = "force-dynamic";

const LAVANDE_CLAIR = "#F4EEFC";

interface Bloc {
  fond: string;
  sombre?: boolean;
  inverse?: boolean;
  kicker: string;
  titre: string;
  intro: string;
  items: Array<{ t: string; d: string }>;
}

/**
 * Fonctionnalités — l'écran `isFeatures` de la maquette, et ses cinq blocs
 * (`FEATURES`).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA MISE EN PAGE TELLE QUELLE, CHAQUE PHRASE REVÉRIFIÉE
 *
 * Lu le 04/10, contre le code. La maquette promettait, entre autres : l'URL
 * « baobart.africa/vendor/ton-nom » (le profil est à /@ton-nom), « 80 % pour
 * toi » et un versement « le 7 de chaque mois » (88,5 %, chaque semaine selon
 * le moyen), une « curation locale dans 14 pays » (aucun réseau de curateurs),
 * « tes factures » (aucune n'est émise), et des avis qui « comptent dans le
 * classement de la grille » (rien ne classe par les avis). Ces phrases sont
 * remplacées par ce que le site fait ; les blocs, leur ordre et leurs couleurs
 * sont ceux de la maquette.
 *
 * Les images de la maquette étaient ses propres photos : ce sont ici des
 * couvertures de la bibliothèque, les plus téléchargées.
 */
export default async function FonctionnalitesPage() {
  const [visiteur, couvertures] = await Promise.all([sessionCourante(), couverturesPopulaires(5)]);
  const part = partDuCreateur().directe;
  const moyens = Object.values(RAILS_BAOBART).map((r) => r.label);
  const familles = ENTREES_RAIL.filter((e) => e.filtre !== "Tous").map((e) => e.label);
  const ouvrir = (visiteur ? "/dashboard/produits/nouveau" : "/inscription") as Route;

  const blocs: Bloc[] = [
    {
      fond: JAUNE,
      kicker: "Ta vitrine",
      titre: "Ta boutique, à ta façon",
      intro: "Baobart s'occupe du paiement, du fichier et de la licence. Toi, tu montres ton travail.",
      items: [
        { t: "Ta page publique, dès la première ressource", d: "Ton profil, à l'adresse /@ton-nom, montre ce que tu publies. Il n'y a rien à configurer de plus." },
        { t: "Une page par ressource", d: "Aperçus, format, dimensions, poids, licence et commentaires : ce que l'acheteur veut savoir avant de payer." },
        { t: "Ton profil devient ton portfolio", d: "Bio, ville, spécialité, liens, pièces de portfolio et services proposés : on voit ce que tu sais faire." },
      ],
    },
    {
      fond: MAUVE,
      inverse: true,
      kicker: "Encaisser",
      titre: "Te faire payer, ici et maintenant",
      intro: "Prix en francs CFA, paiement chez l'opérateur, versement chaque semaine.",
      items: [
        { t: "Carte ou mobile money", d: "L'acheteur paie sur la page sécurisée de Paystack, avec ce qu'elle propose dans son pays. Toi, tu reçois par " + moyens.slice(0, -1).join(", ") + " ou " + moyens.at(-1) + "." },
        { t: `${part} pour toi`, d: `${BAREME_XOF.directRateBp / 100} % de commission, les frais d'opérateur, et rien d'autre : aucun frais fixe, aucune exclusivité. Ton solde part chaque semaine, le jour de ton moyen de versement, dès qu'il atteint le minimum.` },
        { t: "Gratuit, payant, ou prix libre", d: "Fixe un prix, offre une ressource, ou laisse l'acheteur choisir au-dessus d'un minimum. Et des codes promo, à ta charge." },
      ],
    },
    {
      fond: ENCRE,
      sombre: true,
      kicker: "Travailler ensemble",
      titre: "Des espaces, pas des dossiers Drive",
      intro: "Collections, communautés et commentaires, au même endroit que les fichiers.",
      items: [
        { t: "Collections", d: "Range les ressources d'un projet, garde la collection privée ou rends-la publique, et partage-la avec une communauté." },
        { t: "Commentaires au bon endroit", d: "On commente une ressource sur sa fiche, pas dans un fil WhatsApp : la discussion reste attachée au fichier." },
        { t: "Rôles simples", d: "Membre, modérateur, administrateur. On invite en partageant le lien de l'espace." },
      ],
    },
    {
      fond: BLANC,
      inverse: true,
      kicker: "Trouver vite",
      titre: "Une recherche qui parle d'ici",
      intro: `${familles.length} familles de ressources, des filtres, et une recherche qui suggère.`,
      items: [
        { t: "Filtres par famille", d: `${familles.join(", ")} — la grille se recompose sans recharger.` },
        { t: "Suggestions à la frappe", d: "Dès les premières lettres, la recherche de l'en-tête propose les ressources de la bibliothèque, avec leur famille." },
        { t: "À la une", d: "Des ressources choisies par l'équipe, en tête de la mosaïque." },
      ],
    },
    {
      fond: JAUNE,
      kicker: "Piloter",
      titre: "Savoir ce qui marche",
      intro: "Un tableau de bord par rôle : acheteur ou créateur, tu vois ce qui te concerne.",
      items: [
        { t: "Gains et ventes", d: "Ce qui est disponible, en attente, le prochain versement ; chaque vente, ses remboursements, et les téléchargements et ventes de chaque ressource." },
        { t: "Côté acheteur", d: "Tes achats, tes téléchargements, ton quota si tu as un forfait, et la clé de licence de chaque achat." },
        { t: "Ce qui se passe, quand ça se passe", d: "Une vente, un versement, un nouvel abonné : dans la cloche, et par courriel selon tes réglages." },
      ],
    },
  ];

  return (
    <>
      <Header utilisateur={visiteur} />
      <main style={{ background: LAVANDE, minHeight: "100vh" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "44px 32px 0", display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ border: CADRE, borderRadius: 28, background: BLANC, boxShadow: `7px 7px 0 ${ENCRE}`, padding: "40px 32px", textAlign: "center" }}>
            <div style={{ display: "inline-block", border: CADRE, borderRadius: 999, background: JAUNE, padding: "7px 16px", fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em" }}>
              Fonctionnalités
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px,5vw,68px)", lineHeight: 0.94, letterSpacing: "-2.5px", margin: "18px auto 0", maxWidth: 900, textTransform: "uppercase" }}>
              Tout ce qu&apos;il faut pour créer, vendre et bosser à plusieurs<span style={{ color: ORANGE }}>.</span>
            </h1>
            <p style={{ maxWidth: 620, margin: "16px auto 0", fontSize: 16.5, fontWeight: 500, lineHeight: 1.5, opacity: 0.78 }}>
              Baobart n&apos;est pas qu&apos;une banque d&apos;images : c&apos;est la boutique, le paiement, les licences et
              l&apos;espace d&apos;équipe, dans un seul outil pensé pour les créatifs du continent.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 24 }}>
              {blocs.map((b, i) => (
                <a key={b.kicker} href={`#bloc-${i + 1}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", border: CADRE, borderRadius: 999, background: LAVANDE_CLAIR, fontSize: 12.5, fontWeight: 800, color: ENCRE }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.6 }}>0{i + 1}</span>
                  {b.kicker}
                </a>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
              <Link href="/explore" className="sticker-press" style={{ ...cta, background: JAUNE }}>
                Explorer les ressources
              </Link>
              <Link href={ouvrir} className="sticker-press" style={{ ...cta, background: BLANC }}>
                Ouvrir ma boutique
              </Link>
            </div>
          </div>

          {blocs.map((b, i) => {
            const couverture = couvertures[i % Math.max(couvertures.length, 1)] ?? null;
            const bord = b.sombre ? `2.5px solid ${BLANC}` : CADRE;
            return (
              <section
                key={b.kicker}
                id={`bloc-${i + 1}`}
                data-bloc-fonction={i + 1}
                style={{ border: CADRE, borderRadius: 28, boxShadow: `7px 7px 0 ${ENCRE}`, padding: 30, background: b.fond, color: b.sombre ? BLANC : ENCRE, scrollMarginTop: 120 }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", opacity: 0.65 }}>
                    0{i + 1} · {b.kicker}
                  </div>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,3.6vw,44px)", lineHeight: 1, letterSpacing: "-1.6px", margin: "10px 0 0", textTransform: "uppercase" }}>{b.titre}</h2>
                  <p style={{ maxWidth: 560, margin: "12px auto 0", fontSize: 15.5, fontWeight: 500, lineHeight: 1.5, opacity: 0.8 }}>{b.intro}</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(320px,100%),1fr))", gap: 22, marginTop: 26, alignItems: "stretch" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, order: b.inverse ? 2 : 1 }}>
                    {b.items.map((it) => (
                      <div key={it.t} style={{ borderRadius: 20, padding: 18, background: b.sombre ? "#1E1E1E" : BLANC, border: bord }}>
                        <div style={{ fontSize: 16.5, fontWeight: 800, lineHeight: 1.25 }}>{it.t}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, marginTop: 6, opacity: 0.8 }}>{it.d}</div>
                      </div>
                    ))}
                  </div>
                  {couverture ? (
                    <Link
                      href={`/products/${couverture.slug}` as Route}
                      aria-label={couverture.titre}
                      style={{
                        display: "block",
                        minHeight: 360,
                        borderRadius: 22,
                        order: b.inverse ? 1 : 2,
                        border: bord,
                        boxShadow: `6px 6px 0 ${b.sombre ? ORANGE : ENCRE}`,
                        background: `url(${JSON.stringify(couverture.couverture)}) center / cover no-repeat`,
                      }}
                    />
                  ) : (
                    <div style={{ minHeight: 360, borderRadius: 22, order: b.inverse ? 1 : 2, border: bord, background: `repeating-linear-gradient(135deg,${LAVANDE_CLAIR} 0 8px,${BLANC} 8px 18px)` }} />
                  )}
                </div>
              </section>
            );
          })}

          <div style={{ border: CADRE, borderRadius: 28, background: ORANGE, color: BLANC, boxShadow: `7px 7px 0 ${ENCRE}`, padding: "40px 32px", textAlign: "center" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px,4.2vw,52px)", lineHeight: 0.98, letterSpacing: "-2px", margin: 0, textTransform: "uppercase" }}>
              Partage ton travail.
              <br />
              Quelqu&apos;un en a besoin.
            </h2>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
              <Link href={ouvrir} className="sticker-press" style={{ ...cta, background: JAUNE, color: ENCRE }}>
                Commencer gratuitement
              </Link>
              <Link href={"/tarifs" as Route} className="sticker-press" style={{ ...cta, background: BLANC, color: ENCRE }}>
                Voir les tarifs
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </>
  );
}

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
