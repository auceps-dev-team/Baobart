import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { CarteRessourceLien } from "@/components/createurs/carte-ressource";
import { BoutonSuivre } from "@/components/social/boutons";
import { sessionCourante } from "@/lib/auth/session";
import { profilPublic, suitCeCreateur } from "@/lib/createurs/queries";
import { listerFeed } from "@/lib/feed/queries";
import { formatCount, formatMoney } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE } from "@/lib/systeme/charte";

export const dynamic = "force-dynamic";

/**
 * La vitrine d'un créateur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE RÉPARE UN LIEN MORT
 *
 * On pouvait suivre quelqu'un depuis n'importe quelle fiche, sans pouvoir aller
 * le voir. L'écran « Abonnements » du tableau de bord renvoyait vers
 * l'explorateur faute de mieux.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX CHIFFRES DE LA MAQUETTE N'Y SONT PAS
 *
 * Elle dessine cinq indicateurs, dont « vues de page », et annonce « répond en
 * moyenne en 4 h ». Nous ne mesurons ni l'un ni l'autre : aucune table ne les
 * porte. Les afficher demanderait de les inventer, et un chiffre inventé sur un
 * profil public est un mensonge que l'acheteur prend pour une mesure.
 *
 * Traduit de « Baobart Accueil.dc.html », section `PROFIL CREATEUR`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profil = await profilPublic(username);
  if (!profil) return { title: "Créateur introuvable — Baobart." };

  return {
    title: `${profil.nom} — Baobart.`,
    description:
      profil.bio ??
      `Les ressources de ${profil.nom} sur Baobart, la place de marché des créateurs africains.`,
  };
}

export default async function ProfilCreateurPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profil = await profilPublic(username);

  // 404 couvre trois cas très différents — inconnu, acheteur sans vitrine,
  // compte suspendu — et c'est délibéré. Distinguer « ce compte est suspendu »
  // d'un inconnu apprendrait à un curieux qu'il existe, et pourquoi.
  if (!profil) notFound();

  const visiteur = await sessionCourante();

  const [page, suivi] = await Promise.all([
    listerFeed({ auteurId: profil.userId, limit: 24 }),
    suitCeCreateur(visiteur?.id ?? null, profil.userId),
  ]);

  const soiMeme = visiteur?.id === profil.userId;

  const lieu = [profil.ville, profil.pays].filter(Boolean).join(", ");
  const sousTitre = [profil.specialite, lieu || null, `membre depuis ${profil.membreDepuis.getFullYear()}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "44px 32px 0" }}>
          <section
            style={{
              border: CADRE,
              borderRadius: 28,
              background: BLANC,
              boxShadow: `7px 7px 0 ${ENCRE}`,
              overflow: "hidden",
            }}
          >
            {/*
              La bannière. Sans image, la maquette pose un motif — mieux qu'un
              bloc vide, et cela évite qu'un profil sans photo ait l'air cassé.
            */}
            <div
              style={{
                height: 150,
                borderBottom: CADRE,
                background: profil.bannerUrl
                  ? `center / cover no-repeat url(${profil.bannerUrl})`
                  : `repeating-linear-gradient(135deg,${MAUVE} 0 10px,${BLANC} 10px 22px)`,
              }}
            />

            <div
              style={{
                padding: 20,
                display: "flex",
                flexWrap: "wrap",
                gap: 18,
                alignItems: "flex-end",
              }}
            >
              <div
                style={{
                  width: 104,
                  height: 104,
                  flex: "0 0 auto",
                  marginTop: -70,
                  border: `3px solid ${ENCRE}`,
                  borderRadius: 99,
                  background: profil.avatarUrl
                    ? `center / cover no-repeat url(${profil.avatarUrl})`
                    : `repeating-linear-gradient(135deg,#E2622C 0 7px,${JAUNE} 7px 15px)`,
                }}
              />

              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h1
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 30,
                      letterSpacing: "-1px",
                      margin: 0,
                    }}
                  >
                    {profil.nom}
                  </h1>
                  {profil.verifie ? (
                    <span
                      style={{
                        padding: "5px 11px",
                        border: `2px solid ${ENCRE}`,
                        borderRadius: 999,
                        background: JAUNE,
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      CRÉATEUR VÉRIFIÉ
                    </span>
                  ) : null}
                </div>

                <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.72, marginTop: 4 }}>
                  {sousTitre}
                </div>

                {profil.bio ? (
                  <p
                    style={{
                      fontSize: 14.5,
                      fontWeight: 500,
                      lineHeight: 1.5,
                      maxWidth: 620,
                      margin: "10px 0 0",
                      opacity: 0.85,
                      textWrap: "pretty",
                    }}
                  >
                    {profil.bio}
                  </p>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 10, flex: "0 0 auto", flexWrap: "wrap" }}>
                {/*
                  Pas de bouton « Suivre » sur son propre profil : la maquette
                  ne prévoit pas ce cas, et se suivre soi-même n'a pas de sens.
                */}
                {soiMeme ? (
                  <Lien href="/dashboard/profil" fond={JAUNE}>
                    Modifier mon profil
                  </Lien>
                ) : (
                  <BoutonSuivre
                    createurId={profil.userId}
                    actifInitial={suivi}
                    totalInitial={profil.abonnes}
                    chezSoi={false}
                  />
                )}
                {profil.portfolioUrl ? (
                  <a
                    href={profil.portfolioUrl}
                    target="_blank"
                    // Un lien fourni par le créateur reste un lien externe :
                    // `noopener` empêche la page ouverte de manipuler la nôtre.
                    rel="noopener noreferrer nofollow"
                    className="sticker-press"
                    style={boutonStyle(BLANC)}
                  >
                    Portfolio
                  </a>
                ) : null}
              </div>
            </div>

            {/*
              Trois indicateurs, pas cinq. « Vues de page » et « délai de
              réponse » sont dessinés par la maquette et ne reposent sur aucune
              donnée : les afficher demanderait de les inventer.
            */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                borderTop: CADRE,
              }}
            >
              <Indicateur valeur={formatCount(profil.ressourcesPubliees)} label="ressources" />
              <Indicateur valeur={formatCount(profil.ventes)} label="ventes à vie" />
              <Indicateur valeur={formatCount(profil.abonnes)} label="abonnés" />
              {profil.nombreDAvis > 0 ? (
                <Indicateur
                  valeur={profil.note.toFixed(1)}
                  label={`sur ${formatCount(profil.nombreDAvis)} avis`}
                />
              ) : null}
            </div>

            <div
              style={{
                padding: "12px 18px",
                borderTop: CADRE,
                background: "#F4EEFC",
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                letterSpacing: ".06em",
                textTransform: "uppercase",
              }}
            >
              Créateur depuis le{" "}
              {profil.membreDepuis.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {profil.ouvertAuxCommandes
                ? ` · commandes : ${profil.ouvertAuxCommandes}`
                : ""}
              {profil.tarifJournalier
                ? ` · à partir de ${formatMoney(profil.tarifJournalier, "XOF")} / jour`
                : ""}
            </div>
          </section>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              textTransform: "uppercase",
              letterSpacing: "-.5px",
              margin: "28px 0 18px",
            }}
          >
            {formatCount(profil.ressourcesPubliees)} ressource
            {profil.ressourcesPubliees > 1 ? "s" : ""}
          </h2>

          {/*
            Un seul onglet pour l'instant. La maquette en dessine quatre —
            Ressources, Services, Collections, À propos — mais trois n'ont pas
            de code : les Services attendent leur CMS, les Collections publiques
            n'existent pas. Afficher des onglets vides ferait croire à une page
            cassée plutôt qu'à une page en construction.
          */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
              gap: 18,
            }}
          >
            {page.items.map((r) => (
              <CarteRessourceLien key={r.id} ressource={r} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Indicateur({ valeur, label }: { valeur: string; label: string }) {
  return (
    <div style={{ padding: "16px 18px", borderRight: CADRE }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{valeur}</div>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.65 }}>{label}</div>
    </div>
  );
}

function boutonStyle(fond: string) {
  return {
    padding: "12px 20px",
    border: CADRE,
    borderRadius: 14,
    background: fond,
    boxShadow: `4px 4px 0 ${ENCRE}`,
    fontSize: 13.5,
    fontWeight: 800,
    color: ENCRE,
  } as const;
}

function Lien({
  href,
  children,
  fond,
}: {
  href: Route;
  children: React.ReactNode;
  fond: string;
}) {
  return (
    <Link href={href} className="sticker-press" style={boutonStyle(fond)}>
      {children}
    </Link>
  );
}
