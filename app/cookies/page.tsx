import { EtatDuChoix } from "@/components/consentement/etat-du-choix";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { ADRESSE_DONNEES_PERSONNELLES } from "@/lib/config/contact";
import { AUTRES_DONNEES, REGISTRE, type EntreeRegistre } from "@/lib/consentement/regles";
import { BLANC, CADRE, ENCRE, LAVANDE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Politique de cookies — Baobart.",
  description:
    "Chaque cookie que Baobart dépose, à quoi il sert, combien de temps il reste — et ce qu'on garde sans cookie.",
};

export const dynamic = "force-dynamic";

/**
 * La politique de cookies.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA FORME VIENT DE LA MAQUETTE, LE CONTENU DU CODE
 *
 * Le gabarit est celui des pages « Conditions générales » de
 * `Baobart Accueil.dc.html` (`DOCS.cookies`) : surtitre, titre, intro, sections
 * séparées d'un filet. L'intro est la sienne, mot pour mot.
 *
 * Deux écarts, et pourquoi :
 *   — le titre perd « (UE) ». Baobart est établie à Abidjan ; la loi qui
 *     s'applique est ivoirienne. Même raison que « Signalement DMCA », renommé
 *     dans le menu : nommer une page juridique d'après un texte qui ne la
 *     régit pas est une erreur de fait, pas un choix de design ;
 *   — la section « Mesure d'audience — statistiques conservées 13 mois » n'est
 *     pas reprise : Baobart n'a pas de mesure d'audience. Cherché le 03/10 dans
 *     `app`, `components` et `lib` (Google Analytics, Tag Manager, Meta,
 *     Hotjar, Plausible, Umami, Segment, Clarity, `next/script`) : rien.
 *     L'annoncer serait décrire un traitement qui n'existe pas.
 *
 * Les listes viennent de `lib/consentement/regles.ts`, la seule liste : un test
 * y vérifie que tout fichier qui pose un cookie est déclaré.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ADRESSE DE CONTACT
 *
 * Décidée le 04/10 : privacy@baobart.africa, celle de la maquette. Elle vit
 * dans `lib/config/contact.ts`, partagée avec la politique de confidentialité.
 */
export default async function CookiesPage() {
  const visiteur = await sessionCourante();
  const essentiels = REGISTRE.filter((c) => c.categorie === "essentiel");
  const mesure = REGISTRE.filter((c) => c.categorie === "mesure");
  const contact = ADRESSE_DONNEES_PERSONNELLES;

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 80 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "44px 32px 0" }}>
          <div
            style={{
              border: CADRE,
              borderRadius: 28,
              background: BLANC,
              boxShadow: `7px 7px 0 ${ENCRE}`,
              padding: 32,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                textTransform: "uppercase",
                letterSpacing: ".14em",
                opacity: 0.6,
              }}
            >
              Conditions générales
            </div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(30px,3.8vw,48px)",
                lineHeight: 1,
                letterSpacing: "-1.6px",
                margin: "12px 0 0",
                textTransform: "uppercase",
              }}
            >
              Politique de cookies
            </h1>
            <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.55, margin: "14px 0 0", opacity: 0.82, maxWidth: 720 }}>
              On utilise le minimum de traceurs nécessaires, et rien de publicitaire sans ton accord.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 26 }}>
              <Section titre="Cookies essentiels">
                <Texte>
                  Sans eux, le site ne marche pas : ils ne se refusent pas, et ne servent à rien d&apos;autre
                  qu&apos;à ce qui est écrit.
                </Texte>
                <Liste cookies={essentiels} />
              </Section>

              <Section titre="Mesure des publicités">
                <Texte>
                  Le seul cookie facultatif. Il n&apos;est déposé qu&apos;avec ton accord, donné dans la
                  bannière ; tu peux le retirer à tout moment, et le refuser ne change rien à ce que tu peux
                  faire sur Baobart.
                </Texte>
                <Liste cookies={mesure} />
                <EtatDuChoix />
              </Section>

              <Section titre="Ce qu'on garde sans cookie">
                <Texte>
                  Rien de ce qui suit n&apos;est déposé dans ton navigateur ; on le dit quand même, parce que
                  c&apos;est gardé.
                </Texte>
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {AUTRES_DONNEES.map((d) => (
                    <div key={d.quoi} style={{ border: CADRE, borderRadius: 16, padding: "12px 14px" }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800 }}>{d.quoi}</div>
                      <Ligne libelle="Pourquoi">{d.pourquoi}</Ligne>
                      <Ligne libelle="Combien de temps">{d.duree}</Ligne>
                    </div>
                  ))}
                </div>
              </Section>

              <Section titre="Ce que Baobart n'installe pas">
                <Texte>
                  Aucun outil de mesure d&apos;audience ni de publicité d&apos;un autre site. Une couverture de
                  ressource peut être une image hébergée ailleurs : son hébergeur voit alors passer ta
                  visite, comme pour toute image sur le web.
                </Texte>
              </Section>

              <Section titre="Tes droits">
                <Texte>
                  Baobart est établie à Abidjan ; tes données relèvent de la loi ivoirienne n° 2013-450 du
                  19 juin 2013 relative à la protection des données à caractère personnel. Tu peux demander
                  l&apos;effacement de ton compte depuis ton profil — il prend effet trente jours plus tard,
                  et reste annulable jusque-là.
                  {" "}
                  Pour toute autre demande — accès, rectification, retrait du consentement —,
                  écris à{" "}
                  <a href={`mailto:${contact}`} style={{ color: ENCRE, fontWeight: 700 }}>
                    {contact}
                  </a>
                  .
                </Texte>
              </Section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section style={{ borderTop: CADRE, paddingTop: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{titre}</h2>
      {children}
    </section>
  );
}

function Texte({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.6, margin: "6px 0 0", opacity: 0.82, textWrap: "pretty" }}>
      {children}
    </p>
  );
}

function Liste({ cookies }: { cookies: readonly EntreeRegistre[] }) {
  return (
    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      {cookies.map((c) => (
        <div key={c.nom} data-cookie={c.nom} style={{ border: CADRE, borderRadius: 16, padding: "12px 14px" }}>
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>{c.nom}</code>
          <Ligne libelle="À quoi il sert">{c.finalite}</Ligne>
          <Ligne libelle="Ce qu'il contient">{c.contenu}</Ligne>
          <Ligne libelle="Combien de temps">{c.duree}</Ligne>
        </div>
      ))}
    </div>
  );
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 6, fontSize: 13.5, lineHeight: 1.5 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          opacity: 0.6,
          minWidth: 130,
          paddingTop: 2,
        }}
      >
        {libelle}
      </span>
      <span style={{ flex: "1 1 260px", fontWeight: 500 }}>{children}</span>
    </div>
  );
}
