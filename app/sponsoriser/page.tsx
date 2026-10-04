import { FormulaireContact } from "@/components/contact/formulaire";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { compterCommunaute } from "@/lib/feed/queries";
import { formatCount } from "@/lib/i18n/money";
import { TAILLE_MAX_IMAGE, TAILLE_MAX_VIDEO } from "@/lib/publicites/formats";
import { FREQUENCE_MIN } from "@/lib/publicites/regles";
import { DUREE_ATTRIBUTION_S } from "@/lib/publicites/types";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Sponsoriser — Baobart.",
  description: "Mettre ton produit devant les créatifs de Baobart : le format, ce qu'on mesure, et comment en parler.",
};

export const dynamic = "force-dynamic";

const mo = (octets: number) => `${Math.round(octets / (1024 * 1024))} Mo`;

/**
 * Sponsoriser — la page « PAGE SPONSORISER » de la maquette.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA MISE EN PAGE DE LA MAQUETTE, LES FAITS DU CODE
 *
 * La maquette annonçait « 12 400 designers », « 68 000 visites / mois », « 31 %
 * d'agences », « 14 pays », six logos de partenaires, et trois formats avec
 * leur prix : bannière d'accueil (180 000 F), collection sponsorisée (260 000
 * F), encart de newsletter (120 000 F, « 9 200 abonnés, 38 % d'ouverture »).
 *
 * Lu le 04/10 : Baobart ne mesure pas ses visites, n'a aucun partenaire, et
 * n'envoie aucune lettre. Le seul format qui existe est la carte de la
 * mosaïque (v1.71.0), et le code ne fixe aucun prix. La page montre donc les
 * vrais chiffres de la bibliothèque, ce seul format, ce qu'il mesure, et le
 * formulaire — qui écrit à l'équipe, au lieu d'un <div>.
 */
export default async function SponsoriserPage() {
  const [visiteur, chiffres] = await Promise.all([sessionCourante(), compterCommunaute()]);
  const jours = DUREE_ATTRIBUTION_S / 86_400;

  const formats = [
    {
      nom: "Vers une ressource Baobart",
      fond: JAUNE,
      texte: "Ta carte mène à la fiche d'une ressource publiée ici. On compte les affichages, les clics, et les ventes qu'elle a amenées.",
    },
    {
      nom: "Vers ton site",
      fond: BLANC,
      texte: "Ta carte mène à ton site, dans un nouvel onglet. On compte les affichages et les clics ; ce qui se vend chez toi, on ne le voit pas.",
    },
  ];

  return (
    <>
      <Header utilisateur={visiteur} />
      <main style={{ background: LAVANDE, minHeight: "100vh" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "44px 32px 0" }}>
          <div
            data-sponsor-hero
            style={{
              border: CADRE,
              borderRadius: 28,
              background: ENCRE,
              color: BLANC,
              boxShadow: `7px 7px 0 ${MAUVE}`,
              padding: 34,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(min(320px,100%),1fr))",
              gap: 30,
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ display: "inline-block", border: `2.5px solid ${BLANC}`, borderRadius: 999, padding: "6px 14px", fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em" }}>
                Sponsoriser
              </div>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px,4.4vw,58px)", lineHeight: 0.96, letterSpacing: "-2px", margin: "14px 0 0", textTransform: "uppercase" }}>
                Parle aux créatifs qui font l&apos;Afrique<span style={{ color: JAUNE }}>.</span>
              </h1>
              <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5, maxWidth: 540, margin: "14px 0 0", opacity: 0.82 }}>
                Ta carte prend place dans la mosaïque, entre les ressources, au même format qu&apos;elles — pas de bandeau
                qui clignote, pas de traceur d&apos;un autre site.
              </p>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 24 }}>
                <Chiffre valeur={formatCount(chiffres.ressources)} libelle="ressources publiées" />
                <Chiffre valeur={formatCount(chiffres.createurs)} libelle="créateurs qui publient" />
              </div>
            </div>

            <div style={{ border: `2.5px solid ${BLANC}`, borderRadius: 22, padding: 18 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", opacity: 0.75 }}>Ce qu&apos;on mesure</div>
              <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10, fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 }}>
                <li>Les affichages et les clics, comptés par jour.</li>
                <li>
                  Une vente compte seulement si ta carte menait à la ressource achetée, dans les {jours} jours qui suivent le
                  clic.
                </li>
                <li>Une même connexion ne fait compter qu&apos;un nombre borné d&apos;affichages et de clics par jour : les chiffres ne se gonflent pas d&apos;un script.</li>
              </ul>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(280px,100%),1fr))", gap: 18, marginTop: 26 }}>
            {formats.map((f) => (
              <div key={f.nom} data-sponsor-format style={{ border: CADRE, borderRadius: 22, background: f.fond, boxShadow: `5px 5px 0 ${ENCRE}`, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{f.nom}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>Sur devis</div>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.45, opacity: 0.8, flex: "1 1 auto" }}>{f.texte}</div>
              </div>
            ))}
            <div style={{ border: CADRE, borderRadius: 22, background: BLANC, boxShadow: `5px 5px 0 ${ENCRE}`, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>Ce que tu fournis</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, opacity: 0.8 }}>
                Une image (JPG, PNG, WebP ou GIF, {mo(TAILLE_MAX_IMAGE)} au plus) ou une vidéo (MP4 ou WebM, {mo(TAILLE_MAX_VIDEO)} au plus), et le lien
                où elle mène. Au plus une carte toutes les {FREQUENCE_MIN} ressources : la mosaïque reste une bibliothèque.
              </div>
            </div>
          </div>

          <div
            id="parlons-en"
            style={{
              border: CADRE,
              borderRadius: 26,
              background: BLANC,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 28,
              marginTop: 26,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(min(320px,100%),1fr))",
              gap: 28,
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1, letterSpacing: "-1.2px", margin: 0, textTransform: "uppercase" }}>Parlons-en</h2>
              <p style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.5, opacity: 0.78, margin: "12px 0 0" }}>
                Dis-nous ce que tu veux mettre en avant et quand. L&apos;équipe revient vers toi avec un plan et un tarif.
              </p>
            </div>
            <FormulaireContact genre="SPONSOR" sujets={[]} depart={{ nom: visiteur?.nom ?? "", email: visiteur?.email ?? "" }} />
          </div>
        </div>
        <Footer />
      </main>
    </>
  );
}

function Chiffre({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26 }}>{valeur}</div>
      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>{libelle}</div>
    </div>
  );
}

