import Link from "next/link";
import type { Route } from "next";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { formatMoney, type Currency } from "@/lib/i18n/money";
import {
  categorieParSlug,
  categoriesPourChoix,
  listerOffres,
} from "@/lib/services/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Services — Baobart.",
  description:
    "Identité visuelle, illustration, retouche, motion : les créatifs de Baobart proposent leurs services à prix affiché.",
};

export const dynamic = "force-dynamic";

/**
 * L'annuaire des services.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LECTURE PUBLIQUE, ACTION AUTHENTIFIÉE
 *
 * Comme Jobs. Voir ne demande rien ; publier demande le trio du §18.3. Une
 * asymétrie assumée qui permet au référencement de fonctionner.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES BLOCS DE LA MAQUETTE QUI NE SONT PAS ICI
 *
 * La maquette montre un aperçu visuel par service, des avis, un compteur de
 * commandes livrées. Nous n'avons ni aperçus (le portefeuille de médias
 * n'est pas encore rempli), ni avis (le module n'existe pas), ni compteur
 * fiable. Afficher « 0 commande » ferait passer un nouveau créateur pour un
 * amateur sans clients — ce chiffre reviendra quand il aura du sens.
 *
 * Traduit de `Baobart Accueil.dc.html`, section `PAGE SERVICES`.
 */
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat: slug } = await searchParams;

  const [visiteur, categories, categorieActive] = await Promise.all([
    sessionCourante(),
    categoriesPourChoix(),
    slug ? categorieParSlug(slug) : Promise.resolve(null),
  ]);

  // Un slug inconnu ou celui d'une catégorie retirée retombe sur « Tous » —
  // plutôt qu'un 404 sur un lien qu'un moteur de recherche a peut-être déjà
  // indexé.
  const offres = await listerOffres({
    categoryId: categorieActive?.id,
  });

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "44px 32px 0" }}>
          {/* ── En-tête violet, comme la maquette ────────────────────────── */}
          <div
            style={{
              border: CADRE,
              borderRadius: 28,
              background: MAUVE,
              boxShadow: `7px 7px 0 ${ENCRE}`,
              padding: 30,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 22,
            }}
          >
            <div style={{ flex: "1 1 380px", minWidth: 0 }}>
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
                Services
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(32px,4.2vw,54px)",
                  lineHeight: 0.97,
                  letterSpacing: "-2px",
                  margin: "14px 0 0",
                  textTransform: "uppercase",
                }}
              >
                Fais appel aux membres.
              </h1>
              <p
                style={{
                  fontSize: 15.5,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  maxWidth: 520,
                  margin: "12px 0 0",
                  opacity: 0.8,
                }}
              >
                Identité visuelle, illustration, retouche, motion : les
                créatifs de Baobart proposent leurs services à prix affiché.
              </p>
            </div>
            <Link
              href={"/services/deposer" as Route}
              className="sticker-press"
              style={{
                padding: "15px 26px",
                border: CADRE,
                borderRadius: 16,
                background: ENCRE,
                color: BLANC,
                fontSize: 14.5,
                fontWeight: 800,
              }}
            >
              Proposer mon service
            </Link>
          </div>

          {/* ── Le filtre par catégorie ──────────────────────────────────── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, margin: "22px 0 20px" }}>
            <Filtre href={"/services" as Route} actif={!categorieActive}>
              Tous
            </Filtre>
            {categories.map((c) => (
              <Filtre
                key={c.id}
                href={`/services?cat=${c.slug}` as Route}
                actif={categorieActive?.id === c.id}
              >
                {c.name}
              </Filtre>
            ))}
          </div>

          {offres.length === 0 ? (
            <div
              style={{
                border: CADRE,
                borderRadius: 24,
                background: BLANC,
                boxShadow: `6px 6px 0 ${ENCRE}`,
                padding: 28,
                maxWidth: 620,
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                {categorieActive
                  ? "Aucun service dans cette catégorie"
                  : "Aucun service en ligne"}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
                Les services paraissent après relecture. Reviens dans un jour
                ou deux — ou propose le tien.
              </p>
              {/* La phrase invitait à proposer sans y mener (relevé aux tests
                  QA du 09/10 : « pas d'appel à l'action ») : le bouton suit. */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <Link
                  href={"/services/deposer" as Route}
                  className="sticker-press"
                  style={{
                    padding: "11px 18px",
                    border: CADRE,
                    borderRadius: 14,
                    background: JAUNE,
                    boxShadow: `4px 4px 0 ${ENCRE}`,
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: ENCRE,
                  }}
                >
                  Proposer mon service
                </Link>
                {categorieActive ? (
                  <Link
                    href={"/services" as Route}
                    style={{
                      padding: "11px 18px",
                      border: CADRE,
                      borderRadius: 14,
                      background: BLANC,
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: ENCRE,
                    }}
                  >
                    Voir tous les services
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))",
                gap: 18,
              }}
            >
              {offres.map((o) => (
                <Link
                  key={o.id}
                  href={`/services/${o.id}` as Route}
                  className="sticker-press"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    border: CADRE,
                    borderRadius: 22,
                    background: BLANC,
                    boxShadow: `5px 5px 0 ${ENCRE}`,
                    overflow: "hidden",
                    color: ENCRE,
                    padding: 18,
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        padding: "4px 10px",
                        border: `2px solid ${ENCRE}`,
                        borderRadius: 999,
                        background: LAVANDE,
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                      }}
                    >
                      {o.categorie.name}
                    </span>
                    {o.miseEnAvant ? (
                      <span
                        style={{
                          padding: "4px 10px",
                          border: `2px solid ${ENCRE}`,
                          borderRadius: 999,
                          background: JAUNE,
                          fontSize: 10.5,
                          fontWeight: 800,
                        }}
                      >
                        MIS EN AVANT
                      </span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 16.5, fontWeight: 800, lineHeight: 1.25, flex: 1 }}>
                    {o.titre}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 12,
                      borderTop: CADRE,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10.5,
                          opacity: 0.6,
                        }}
                      >
                        à partir de
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 19,
                        }}
                      >
                        {formatMoney(o.prixDeDepart, o.devise as Currency)}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "8px 13px",
                        border: `2px solid ${ENCRE}`,
                        borderRadius: 11,
                        background: JAUNE,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {o.delaiJours} j
                    </div>
                  </div>

                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      opacity: 0.65,
                    }}
                  >
                    par {o.createur}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Filtre({
  href,
  actif,
  children,
}: {
  href: Route;
  actif: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "9px 16px",
        border: CADRE,
        borderRadius: 999,
        background: actif ? ENCRE : BLANC,
        color: actif ? BLANC : ENCRE,
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      {children}
    </Link>
  );
}
