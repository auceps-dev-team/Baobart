import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { MenuPartage } from "@/components/anime/menu-partage";
import { CarteRessourceLien } from "@/components/createurs/carte-ressource";
import { FiltresPortfolio } from "@/components/createurs/filtres-portfolio";
import {
  APropos,
  CarteCollection,
  Onglets,
  Pagination,
  type Onglet,
} from "@/components/createurs/vitrine";
import { Tuile } from "@/components/reseaux/logos";
import { CarteOffre } from "@/components/services/carte-offre";
import { BoutonSuivre } from "@/components/social/boutons";
import { sessionCourante } from "@/lib/auth/session";
import { urlDuSite } from "@/lib/config/site";
import { absolue } from "@/lib/reseaux/partage";
import { collectionsPubliquesDe, profilPublic, suitCeCreateur } from "@/lib/createurs/queries";
import {
  TRIS_VITRINE,
  famillesDuCreateur,
  pageDeLaVitrine,
  type TriVitrine,
} from "@/lib/feed/queries";
import { listerOffres } from "@/lib/services/queries";
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

  const description =
    profil.bio ??
    `Les ressources de ${profil.nom} sur Baobart, la place de marché des créateurs africains.`;
  const base = urlDuSite();
  const visuel = profil.bannerUrl ?? profil.avatarUrl;
  const image = visuel && base ? absolue(visuel, base) : visuel;

  return {
    title: `${profil.nom} — Baobart.`,
    description,
    // Avec son propre titre, pour la raison dite dans `app/layout.tsx`. Sans
    // bannière ni photo, l'image du site reste celle de l'aperçu.
    ...(image
      ? { openGraph: { type: "profile", title: profil.nom, description, images: [image] } }
      : {}),
  };
}

export default async function ProfilCreateurPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ onglet?: string; q?: string; famille?: string; tri?: string; page?: string }>;
}) {
  const { username } = await params;
  const demande = await searchParams;
  const profil = await profilPublic(username);

  // 404 couvre trois cas très différents — inconnu, acheteur sans vitrine,
  // compte suspendu — et c'est délibéré. Distinguer « ce compte est suspendu »
  // d'un inconnu apprendrait à un curieux qu'il existe, et pourquoi.
  if (!profil) notFound();

  const visiteur = await sessionCourante();

  // Ce que l'adresse demande, ramené à ce qui existe : une valeur inconnue
  // retombe sur le défaut au lieu de casser la page.
  const recherche = (demande.q ?? "").trim().slice(0, 80);
  const tri: TriVitrine = TRIS_VITRINE.some((t) => t.valeur === demande.tri)
    ? (demande.tri as TriVitrine)
    : "recent";
  const numero = Number.parseInt(demande.page ?? "1", 10);

  const [suivi, familles, services, collections] = await Promise.all([
    suitCeCreateur(visiteur?.id ?? null, profil.userId),
    famillesDuCreateur(profil.userId),
    listerOffres({ createurId: profil.userId, limite: 24 }),
    collectionsPubliquesDe(profil.userId),
  ]);
  const famille = familles.find((f) => f.famille === demande.famille)?.famille ?? null;

  // Les onglets de la maquette, sauf ceux qui n'auraient rien à montrer :
  // un onglet vide ferait croire à une page cassée (MAQUETTES_A_FAIRE §F.3).
  const visibles: Onglet[] = [
    "ressources",
    ...(services.length > 0 ? (["services"] as const) : []),
    ...(collections.length > 0 ? (["collections"] as const) : []),
    "a-propos",
  ];
  const onglet: Onglet = visibles.find((o) => o === demande.onglet) ?? "ressources";

  const page =
    onglet === "ressources"
      ? await pageDeLaVitrine({ auteurId: profil.userId, recherche, famille, tri, page: Number.isFinite(numero) ? numero : 1 })
      : null;

  const base = `/createurs/${profil.username}`;
  const adressePage = (n: number) => {
    const p = new URLSearchParams();
    if (recherche) p.set("q", recherche);
    if (famille) p.set("famille", famille);
    if (tri !== "recent") p.set("tri", tri);
    if (n > 1) p.set("page", String(n));
    const chaine = p.toString();
    return chaine ? `${base}?${chaine}` : base;
  };

  const soiMeme = visiteur?.id === profil.userId;

  // « Dakar, Sénégal », comme la maquette — pas le code « SN » que range la base.
  const lieu = [profil.ville, nomDuPays(profil.pays)].filter(Boolean).join(", ");
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

                {/*
                  « Tuiles carrées · profils créateurs » du Design System :
                  blanches au repos, jaunes au survol. Rien quand le créateur
                  n'a donné aucun réseau — une rangée vide n'apprend rien.
                */}
                {profil.liens.length > 0 ? (
                  <div
                    data-reseaux
                    style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14 }}
                  >
                    {profil.liens.map((l) => (
                      <Tuile key={l.reseau} reseau={l.reseau} href={l.url} proprietaire={profil.nom} />
                    ))}
                  </div>
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
                {/*
                  « Partager » de la maquette : blanc, sans ombre. L'adresse
                  partagée est l'adresse courte, `/@nom` — celle qu'on cite.
                */}
                <MenuPartage
                  chemin={`/@${profil.username}`}
                  titre={`${profil.nom} sur Baobart`}
                  image={profil.bannerUrl ?? profil.avatarUrl}
                  cle={`profil-${profil.username}`}
                  bouton="profil"
                />
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

          {/*
            Les quatre onglets de la maquette (`profilTabs`). Jusqu'au 16/10,
            un seul existait : les Services n'avaient pas de CMS, les
            Collections publiques pas de code. Les deux existent désormais ;
            un onglet ne paraît que s'il a quelque chose à montrer.
          */}
          <Onglets base={base} actif={onglet} visibles={visibles} />

          {onglet === "ressources" && page ? (
            <>
              <FiltresPortfolio
                action={base}
                recherche={recherche}
                famille={famille ?? ""}
                tri={tri}
                familles={familles.map((f) => ({ valeur: f.famille, libelle: f.libelle }))}
                tris={TRIS_VITRINE}
              />
              {page.items.length > 0 ? (
                // La mosaïque de la maquette (`data-masonry`, colonnes de
                // 250 px) : chaque carte garde la hauteur de son visuel.
                <div data-masonry="1" style={{ columns: "250px", columnGap: 20 }}>
                  {page.items.map((r) => (
                    <CarteRessourceLien key={r.id} ressource={r} />
                  ))}
                </div>
              ) : (
                <Vide>
                  Aucune ressource ne correspond
                  {recherche ? ` à « ${recherche} »` : " à ce filtre"}.{" "}
                  <Link href={base as Route} style={{ textDecoration: "underline" }}>
                    Tout afficher
                  </Link>
                </Vide>
              )}
              <Pagination page={page.page} pages={page.pages} adresse={adressePage} />
            </>
          ) : null}

          {onglet === "services" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 18 }}>
              {services.map((o) => (
                <CarteOffre key={o.id} offre={o} />
              ))}
            </div>
          ) : null}

          {onglet === "collections" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 20 }}>
              {collections.map((c) => (
                <CarteCollection key={c.id} collection={c} connecte={visiteur !== null} />
              ))}
            </div>
          ) : null}

          {onglet === "a-propos" ? <APropos profil={profil} lieu={lieu} /> : null}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Vide({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 22,
        border: "2.5px dashed #121212",
        borderRadius: 20,
        background: "#F4EEFC",
        fontSize: 14,
        fontWeight: 700,
        textAlign: "center",
        marginBottom: 20,
      }}
    >
      {children}
    </div>
  );
}

/** Le nom du pays en français, depuis son code ISO 3166-1 (« SN »). */
function nomDuPays(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code;
  } catch {
    // Un code que l'ICU ne connaît pas : mieux vaut le code que rien.
    return code;
  }
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
