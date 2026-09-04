import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { formatMoney, type Currency } from "@/lib/i18n/money";
import { offrePublique } from "@/lib/services/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE } from "@/lib/systeme/charte";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const offre = await offrePublique(id);
  if (!offre) return { title: "Service introuvable — Baobart." };
  return {
    title: `${offre.titre} — Baobart.`,
    description: offre.extrait,
  };
}

/**
 * La fiche d'un service.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE VOIT UN ACHETEUR AVANT DE COMMANDER
 *
 * Trois choses comptent, et elles sont toutes présentes : le prix, le délai,
 * ce que le créateur propose. Le reste — portefeuille de médias, avis
 * clients, étapes — attend d'exister en base : les inventer sur la fiche
 * mentirait à l'acheteur, et le peuplerait le jour où on branche pour de
 * bon d'une donnée dont personne ne se rappelle plus l'origine.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE BOUTON « COMMANDER » SERA POSÉ EN S5
 *
 * Un CTA qui n'aboutit pas est pire qu'un CTA absent : l'acheteur clique,
 * ne voit rien se passer, et repart. On annonce donc ici que la mise en
 * relation existe, sans la câbler.
 */
export default async function FicheServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [offre, visiteur] = await Promise.all([
    offrePublique(id),
    sessionCourante(),
  ]);

  // 404 pour tout ce qui n'est pas publié (relecture, refus, retrait). Un
  // identifiant se devine mal, mais il se partage : un lien envoyé avant un
  // refus ne doit pas continuer de montrer la fiche.
  if (!offre) notFound();

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 32px 0" }}>
          <Link
            href={"/services" as Route}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              border: CADRE,
              borderRadius: 13,
              background: BLANC,
              fontSize: 13,
              fontWeight: 800,
              color: ENCRE,
            }}
          >
            ← Tous les services
          </Link>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)",
              gap: 24,
              marginTop: 20,
              alignItems: "start",
            }}
          >
            {/* ── La prestation ───────────────────────────────────────── */}
            <div
              style={{
                border: CADRE,
                borderRadius: 26,
                background: BLANC,
                boxShadow: `7px 7px 0 ${ENCRE}`,
                padding: 26,
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <span
                  style={{
                    padding: "6px 13px",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 999,
                    background: LAVANDE,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                  }}
                >
                  {offre.categorie.name}
                </span>
              </div>

              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(26px,3.2vw,42px)",
                  lineHeight: 1.02,
                  letterSpacing: "-1.5px",
                  margin: "16px 0 0",
                  textTransform: "uppercase",
                }}
              >
                {offre.titre}
              </h1>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 18,
                  marginTop: 12,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  opacity: 0.65,
                }}
              >
                <span>
                  par{" "}
                  {offre.createurUsername ? (
                    <Link
                      href={`/@${offre.createurUsername}` as Route}
                      style={{ color: ENCRE, textDecoration: "underline" }}
                    >
                      {offre.createur}
                    </Link>
                  ) : (
                    offre.createur
                  )}
                </span>
                <span>publiée le {offre.publieeLe.toLocaleDateString("fr-FR")}</span>
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  margin: "26px 0 10px",
                }}
              >
                La prestation
              </div>
              {/*
                Description saisie par le créateur. React échappe : jamais
                interprétée comme du balisage. `pre-wrap` garde les
                paragraphes sans lui offrir de mise en forme.
              */}
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  lineHeight: 1.6,
                  margin: 0,
                  opacity: 0.85,
                  whiteSpace: "pre-wrap",
                  textWrap: "pretty",
                }}
              >
                {offre.description}
              </p>
            </div>

            {/* ── Prix, délai, CTA ────────────────────────────────────── */}
            <div style={{ position: "sticky", top: 88, minWidth: 0 }}>
              <div
                style={{
                  border: CADRE,
                  borderRadius: 26,
                  background: JAUNE,
                  boxShadow: `7px 7px 0 ${ENCRE}`,
                  padding: 22,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    opacity: 0.7,
                  }}
                >
                  À partir de
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 44,
                    lineHeight: 1,
                    marginTop: 4,
                  }}
                >
                  {formatMoney(offre.prixDeDepart, offre.devise as Currency)}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: CADRE,
                  }}
                >
                  <Fait k="Délai annoncé" v={`${offre.delaiJours} jours`} />
                  <Fait k="Catégorie" v={offre.categorie.name} />
                </div>

                {/*
                  Le CTA « Commander » n'est pas câblé ici — S5 le remplace
                  par un `mailto:` sur l'adresse publique du créateur.
                  Aujourd'hui, on indique juste qu'il faudra revenir.
                */}
                <div
                  style={{
                    marginTop: 18,
                    padding: 14,
                    border: CADRE,
                    borderRadius: 15,
                    background: BLANC,
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.5,
                  }}
                >
                  Le contact avec le créateur arrive dans le prochain pas.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Fait({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, fontWeight: 700 }}>
      <div style={{ flex: "1 1 auto", opacity: 0.75 }}>{k}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v}</div>
    </div>
  );
}
