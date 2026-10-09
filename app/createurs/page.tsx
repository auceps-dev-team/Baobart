import Link from "next/link";
import type { Route } from "next";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { BoutonSuivre } from "@/components/social/boutons";
import { sessionCourante } from "@/lib/auth/session";
import { famillesDesCreateurs, listerCreateurs, suivisParmi } from "@/lib/createurs/queries";
import type { ProductFamily } from "@/lib/domain/prisma-types";
import { LIBELLE_PAR_FAMILLE } from "@/lib/feed/types";
import { formatCount } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Les créateurs — Baobart.",
  description:
    "Les créateurs qui publient sur Baobart : illustration, motion, photo, design.",
};

export const dynamic = "force-dynamic";

/** Les aplats de la maquette pour les vignettes sans couverture. */
const TRAMES = ["#EADFF9", "#FFD84A", "#E2622C", "#C9A8F5", "#EADFF9"];

/**
 * L'annuaire des créateurs.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ON N'Y ENTRE QU'EN AYANT PUBLIÉ
 *
 * La liste part des ressources publiées, pas des comptes. Un annuaire construit
 * sur les profils listerait tous les inscrits, acheteurs compris — et
 * ressemblerait à un registre plutôt qu'à une vitrine.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA MAQUETTE, CETTE FOIS EN ENTIER (09/10, après les tests QA)
 *
 * Traduit de « Baobart Accueil.dc.html », section `PAGE CREATEURS`. La page
 * s'en tenait à une grille de pastilles : ni filtre, ni « Suivre », ni la
 * bande de travaux de chaque créateur — la page paraissait vide. Elle reprend
 * la maquette : une carte pleine largeur par créateur, ses deux boutons, et
 * ses cinq dernières ressources.
 *
 * Un écart, assumé : les étiquettes « Populaire » de la maquette mènent à une
 * recherche par mot-clé qu'Explorer ne sait pas faire. Le filtre porte sur la
 * famille de ce que publie le créateur (voir `listerCreateurs`).
 */
export default async function CreateursPage({
  searchParams,
}: {
  searchParams: Promise<{ famille?: string }>;
}) {
  const { famille: demande } = await searchParams;
  const [visiteur, familles] = await Promise.all([sessionCourante(), famillesDesCreateurs()]);
  const famille = (familles as string[]).includes(demande ?? "")
    ? (demande as ProductFamily)
    : undefined;
  const createurs = await listerCreateurs({ famille });
  const suivis = await suivisParmi(
    visiteur?.id ?? null,
    createurs.map((c) => c.id),
  );

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "44px 32px 0" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(32px,4vw,52px)",
                  letterSpacing: "-1.8px",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                Les créateurs
              </h1>
              <p
                style={{
                  fontSize: 15.5,
                  fontWeight: 600,
                  lineHeight: 1.55,
                  margin: "8px 0 0",
                  maxWidth: 620,
                  opacity: 0.75,
                  textWrap: "pretty",
                }}
              >
                Trouve le talent qu&apos;il te faut pour ton prochain projet. Suis
                celles et ceux qui publient pour être averti de leurs nouvelles
                ressources.
              </p>
            </div>

            {familles.length > 0 ? (
              <nav
                aria-label="Filtrer par famille"
                style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    opacity: 0.55,
                  }}
                >
                  Publie
                </span>
                <Filtre href={"/createurs" as Route} actif={famille === undefined}>
                  Tout
                </Filtre>
                {familles.map((f) => (
                  <Filtre key={f} href={`/createurs?famille=${f}` as Route} actif={famille === f}>
                    {LIBELLE_PAR_FAMILLE[f]}
                  </Filtre>
                ))}
              </nav>
            ) : null}
          </div>

          {createurs.length === 0 ? (
            <div
              style={{
                border: CADRE,
                borderRadius: 24,
                background: BLANC,
                boxShadow: `6px 6px 0 ${ENCRE}`,
                padding: 28,
                maxWidth: 620,
                marginTop: 24,
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                {famille ? "Personne ne publie encore dans cette famille" : "Personne n'a encore publié"}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
                L&apos;annuaire se remplit tout seul : on y entre en publiant sa
                première ressource.
              </p>
              <Link
                href="/dashboard/produits/nouveau"
                className="sticker-press"
                style={{
                  display: "inline-block",
                  marginTop: 16,
                  padding: "12px 20px",
                  border: CADRE,
                  borderRadius: 14,
                  background: JAUNE,
                  boxShadow: `4px 4px 0 ${ENCRE}`,
                  fontSize: 14,
                  fontWeight: 800,
                  color: ENCRE,
                }}
              >
                Publier une ressource
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
              {createurs.map((c) => {
                const profil = `/@${c.username}` as Route;
                const detail = [c.specialite, c.ville].filter(Boolean).join(" · ") || `@${c.username}`;
                return (
                  <article
                    key={c.id}
                    data-createur={c.username}
                    style={{
                      border: CADRE,
                      borderRadius: 24,
                      background: BLANC,
                      boxShadow: `5px 5px 0 ${ENCRE}`,
                      padding: 18,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <div
                        aria-hidden
                        style={{
                          width: 52,
                          height: 52,
                          flex: "0 0 auto",
                          border: CADRE,
                          borderRadius: 99,
                          background: c.avatarUrl
                            ? `center / cover no-repeat url(${JSON.stringify(c.avatarUrl)})`
                            : `repeating-linear-gradient(135deg,${MAUVE} 0 6px,${JAUNE} 6px 13px)`,
                        }}
                      />
                      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                        <Link href={profil} style={{ fontSize: 18, fontWeight: 800, color: ENCRE }}>
                          {c.nom}
                        </Link>
                        <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.65 }}>
                          {detail} · {formatCount(c.ressourcesPubliees)} ressource
                          {c.ressourcesPubliees > 1 ? "s" : ""}
                          {c.verifie ? " · vérifié" : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, flex: "0 0 auto", alignItems: "flex-start" }}>
                        <BoutonSuivre
                          createurId={c.id}
                          actifInitial={suivis.has(c.id)}
                          totalInitial={c.abonnes}
                          chezSoi={visiteur?.id === c.id}
                        />
                        <Link
                          href={profil}
                          className="sticker-press"
                          style={{
                            padding: "9px 16px",
                            border: CADRE,
                            borderRadius: 999,
                            background: BLANC,
                            fontSize: 12.5,
                            fontWeight: 800,
                            color: ENCRE,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Voir le profil
                        </Link>
                      </div>
                    </div>

                    {/* Les cinq dernières ressources, chacune vers sa fiche :
                        la bande `c.work` de la maquette, avec de vrais
                        travaux. Un cinquième de la largeur chacune, et non la
                        grille `auto-fit` de la maquette : avec une seule
                        ressource, elle étirait la vignette sur toute la carte
                        (vu le 09/10). En ligne flexible et non en grille : la
                        règle des 900 px de globals.css empilerait une grille
                        en style en ligne, cinq vignettes l'une sous l'autre. */}
                    {c.travaux.length > 0 ? (
                      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                        {c.travaux.map((t, i) => (
                          <Link
                            key={t.slug}
                            href={`/products/${t.slug}` as Route}
                            aria-label={t.titre}
                            title={t.titre}
                            style={{
                              flex: "0 1 calc((100% - 48px) / 5)",
                              minWidth: 0,
                              height: 112,
                              border: CADRE,
                              borderRadius: 14,
                              display: "grid",
                              placeItems: "center",
                              padding: 6,
                              fontFamily: "var(--font-mono)",
                              fontSize: 10.5,
                              textAlign: "center",
                              color: ENCRE,
                              background: t.couverture
                                ? `center / cover no-repeat url(${JSON.stringify(t.couverture)})`
                                : TRAMES[i % TRAMES.length],
                            }}
                          >
                            {t.couverture ? null : t.titre}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Filtre({ href, actif, children }: { href: Route; actif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      style={{
        padding: "7px 14px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 700,
        background: actif ? JAUNE : BLANC,
        color: ENCRE,
      }}
    >
      {children}
    </Link>
  );
}
