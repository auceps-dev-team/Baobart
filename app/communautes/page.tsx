import Link from "next/link";
import type { Route } from "next";

import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { listerCommunautes } from "@/lib/forum/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE, VERT } from "@/lib/systeme/charte";

export const metadata = {
  title: "Communautés — Baobart.",
  description:
    "Des espaces où les créateurs du continent se parlent : techniques, tarifs, matériel, entraide.",
};

export const dynamic = "force-dynamic";

/**
 * L'annuaire des communautés.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE LA MAQUETTE DIT DE CET ÉCRAN — ET CE QU'ELLE N'EN DIT PAS
 *
 * Une version de cet en-tête affirmait : « `Baobart Design/` en dessine huit ;
 * aucune ne montre le forum. » C'était faux, et surtout ça n'avait pas été
 * vérifié : les huit noms de fichiers avaient été lus, pas les fichiers.
 *
 * Vérifié le 18 septembre 2026, sur les huit maquettes : il n'y a pas d'écran
 * d'annuaire, mais il y a bien un espace communautaire —
 * `Baobart Accueil.dc.html`, section `#collab`, « Vos espaces d'équipe ». Elle
 * y appelle depuis trois endroits : le bouton « Créer un espace », le lien
 * « Voir les espaces », et « Espaces » dans la colonne « Communauté » du pied
 * de page.
 *
 * Ce qu'elle dessine est un **fil plat** attaché à une collection partagée,
 * pas un annuaire. Cet écran-ci est donc une invention assumée : il faut bien
 * une porte d'entrée. Son vocabulaire visuel est repris des autres pages —
 * cadre noir, ombre de 7 px, titres en display capitales.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TOUTES LES COMMUNAUTÉS SONT OUVERTES
 *
 * Il n'y a plus de réglage de visibilité : chacune se voit et se lit, et seule
 * l'écriture demande d'être membre. `clauseAnnuaire` écarte encore les fermées
 * par l'administration, et les éventuelles lignes privées d'avant ce
 * changement — la règle est restée, dans le `WHERE`, pas ici.
 */
export default async function CommunautesPage() {
  const visiteur = await sessionCourante();
  const communautes = await listerCommunautes(visiteur?.id ?? null);

  const miennes = communautes.filter((c) => c.chezMoi);
  const autres = communautes.filter((c) => !c.chezMoi);

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "44px 32px 0" }}>
          <div
            style={{
              border: CADRE,
              borderRadius: 28,
              background: JAUNE,
              boxShadow: `7px 7px 0 ${ENCRE}`,
              padding: 34,
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "6px 14px",
                border: CADRE,
                borderRadius: 999,
                background: BLANC,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".12em",
              }}
            >
              Communautés
            </div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(34px,4.4vw,58px)",
                lineHeight: 0.96,
                letterSpacing: "-2px",
                margin: "14px 0 0",
                textTransform: "uppercase",
              }}
            >
              On ne crée pas tout seul.
            </h1>
            <p
              style={{
                fontSize: 16,
                fontWeight: 500,
                lineHeight: 1.5,
                maxWidth: 560,
                margin: "14px 0 0",
                opacity: 0.8,
              }}
            >
              Des espaces pour parler technique, tarifs, matériel et clients —
              entre gens qui font le même métier.
            </p>

            {visiteur ? (
              <Link
                href={"/communautes/nouvelle" as Route}
                className="sticker-press"
                style={{
                  display: "inline-block",
                  marginTop: 22,
                  padding: "14px 26px",
                  border: CADRE,
                  borderRadius: 16,
                  background: ENCRE,
                  color: BLANC,
                  fontSize: 14.5,
                  fontWeight: 800,
                }}
              >
                Ouvrir une communauté
              </Link>
            ) : (
              <p style={{ marginTop: 22, fontSize: 14, fontWeight: 700 }}>
                <Link href={"/connexion" as Route} style={{ textDecoration: "underline" }}>
                  Connecte-toi
                </Link>{" "}
                pour en ouvrir une ou rejoindre celles qui existent.
              </p>
            )}
          </div>

          {miennes.length > 0 ? (
            <Section titre="Chez moi" communautes={miennes} />
          ) : null}

          <Section
            titre={miennes.length > 0 ? "À découvrir" : "Les communautés"}
            communautes={autres}
          />

          {communautes.length === 0 ? (
            <p
              style={{
                marginTop: 32,
                padding: 28,
                border: CADRE,
                borderRadius: 22,
                background: BLANC,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              Aucune communauté pour l&apos;instant. La première sera la tienne.
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}

function Section({
  titre,
  communautes,
}: {
  titre: string;
  communautes: Awaited<ReturnType<typeof listerCommunautes>>;
}) {
  if (communautes.length === 0) return null;

  return (
    <section style={{ marginTop: 40 }}>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 24,
          textTransform: "uppercase",
          letterSpacing: "-.5px",
          margin: "0 0 18px",
        }}
      >
        {titre}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
          gap: 20,
        }}
      >
        {communautes.map((c) => (
          <Link
            key={c.slug}
            href={`/communautes/${c.slug}` as Route}
            className="sticker-press"
            style={{
              display: "block",
              border: CADRE,
              borderRadius: 22,
              background: BLANC,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              padding: 22,
              color: ENCRE,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 21,
                  lineHeight: 1.05,
                }}
              >
                {c.nom}
              </span>
              <Pastille visibilite={c.visibilite} />
            </div>

            {c.description ? (
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.5,
                  margin: "12px 0 0",
                  opacity: 0.78,
                }}
              >
                {c.description}
              </p>
            ) : null}

            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: CADRE,
                fontSize: 13,
                fontWeight: 700,
                opacity: 0.7,
              }}
            >
              {c.membres} membre{c.membres > 1 ? "s" : ""}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Le réglage de visibilité, dit en un mot.
 *
 * « Privée » est affiché, et c'est voulu : on voit l'espace exister sans
 * pouvoir le lire. Ne rien afficher ferait croire à un espace ouvert dont les
 * sujets tardent à charger.
 */
function Pastille({ visibilite }: { visibilite: string }) {
  if (visibilite === "PUBLIC") return null;

  const fond = visibilite === "PRIVATE" ? MAUVE : VERT;
  const mot = visibilite === "PRIVATE" ? "Privée" : "Sur invitation";

  return (
    <span
      style={{
        flexShrink: 0,
        padding: "4px 10px",
        border: CADRE,
        borderRadius: 999,
        background: fond,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: ".1em",
      }}
    >
      {mot}
    </span>
  );
}
