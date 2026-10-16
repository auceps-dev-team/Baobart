import Link from "next/link";
import type { Route } from "next";

import { LienAvecIdentifiant } from "@/components/reseaux/logos";
import type { CollectionEnVitrine, ProfilPublic } from "@/lib/createurs/queries";
import { numerosAMontrer } from "@/lib/createurs/pagination";
import { formatMoney } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE, JAUNE } from "@/lib/systeme/charte";
import { vignetteDe } from "@/lib/upload/vignette";

/**
 * Les pièces de la vitrine sous l'en-tête : onglets, pagination, « À propos »,
 * collections. Traduites de `Baobart Accueil.dc.html`, section
 * `PROFIL CREATEUR` (`profilTabs`, `profilPages`). Aucune ne s'exécute dans le
 * navigateur : ce sont des liens, l'état vit dans l'adresse.
 */

export type Onglet = "ressources" | "services" | "collections" | "a-propos";

export const LIBELLES_ONGLETS: Record<Onglet, string> = {
  ressources: "Ressources",
  services: "Services",
  collections: "Collections",
  "a-propos": "À propos",
};

/** « Ressources » est l'adresse nue : c'est l'onglet qu'on partage. */
export function adresseOnglet(base: string, onglet: Onglet): string {
  return onglet === "ressources" ? base : `${base}?onglet=${onglet}`;
}

export function Onglets({
  base,
  actif,
  visibles,
}: {
  base: string;
  actif: Onglet;
  visibles: Onglet[];
}) {
  return (
    <nav aria-label="Sections du profil" style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "22px 0 20px" }}>
      {visibles.map((o) => (
        <Link
          key={o}
          href={adresseOnglet(base, o) as Route}
          aria-current={o === actif ? "page" : undefined}
          style={{
            padding: "10px 18px",
            border: CADRE,
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 800,
            background: o === actif ? ENCRE : BLANC,
            color: o === actif ? BLANC : ENCRE,
          }}
        >
          {LIBELLES_ONGLETS[o]}
        </Link>
      ))}
    </nav>
  );
}

/** « 1 2 3 … 6 Suivant → » — et « ← Précédent » dès la deuxième page. */
export function Pagination({
  page,
  pages,
  adresse,
}: {
  page: number;
  pages: number;
  /** L'adresse d'une page, filtres compris. */
  adresse: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const pastille = (actif: boolean) => ({
    minWidth: 44,
    textAlign: "center" as const,
    padding: "10px 14px",
    border: CADRE,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
    background: actif ? ENCRE : BLANC,
    color: actif ? BLANC : ENCRE,
  });
  return (
    <nav aria-label="Pages" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
      {page > 1 ? (
        <Link href={adresse(page - 1) as Route} rel="prev" style={pastille(false)}>
          ← Précédent
        </Link>
      ) : null}
      {numerosAMontrer(page, pages).map((m, i) =>
        m === "…" ? (
          <span key={`trou-${i}`} aria-hidden="true" style={{ ...pastille(false), borderColor: "transparent", background: "transparent" }}>
            …
          </span>
        ) : (
          <Link key={m} href={adresse(m) as Route} aria-current={m === page ? "page" : undefined} style={pastille(m === page)}>
            {m}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={adresse(page + 1) as Route} rel="next" style={pastille(false)}>
          Suivant →
        </Link>
      ) : null}
    </nav>
  );
}

/**
 * L'onglet « À propos » : la présentation entière, les réseaux avec leur
 * identifiant (« Liens profil · avec identifiant » du Design System), et ce
 * qu'un client veut savoir avant d'écrire.
 */
export function APropos({ profil, lieu }: { profil: ProfilPublic; lieu: string }) {
  const details: Array<[string, string]> = [
    ...(profil.specialite ? [["Spécialité", profil.specialite] as [string, string]] : []),
    ...(lieu ? [["Basé à", lieu] as [string, string]] : []),
    ...(profil.ouvertAuxCommandes ? [["Commandes", profil.ouvertAuxCommandes] as [string, string]] : []),
    ...(profil.tarifJournalier
      ? [["Tarif indicatif", `à partir de ${formatMoney(profil.tarifJournalier, "XOF")} / jour`] as [string, string]]
      : []),
    [
      "Membre depuis",
      profil.membreDepuis.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    ],
  ];

  return (
    <section
      data-a-propos
      style={{ border: CADRE, borderRadius: 24, background: BLANC, boxShadow: `6px 6px 0 ${ENCRE}`, padding: 22 }}
    >
      {profil.bio ? (
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.6, maxWidth: 720, whiteSpace: "pre-line", textWrap: "pretty" }}>
          {profil.bio}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, opacity: 0.65 }}>
          {profil.nom} n&apos;a pas encore écrit de présentation.
        </p>
      )}

      {profil.liens.length > 0 || profil.portfolioUrl ? (
        <div style={{ marginTop: 22 }}>
          <div style={intertitre}>Où le trouver</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {profil.liens.map((l) => (
              <LienAvecIdentifiant key={l.reseau} reseau={l.reseau} href={l.url} identifiant={l.identifiant} />
            ))}
            {profil.portfolioUrl ? (
              <a href={profil.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow" className="reseau-lien">
                <span
                  aria-hidden="true"
                  style={{ width: 34, height: 34, border: `2px solid ${ENCRE}`, borderRadius: 99, background: JAUNE, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 800 }}
                >
                  ↗
                </span>
                <span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>Portfolio</span>
                  <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.65 }}>
                    {new URL(profil.portfolioUrl).hostname.replace(/^www\./, "")}
                  </span>
                </span>
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <dl style={{ margin: "22px 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
        {details.map(([terme, valeur]) => (
          <div key={terme} style={{ padding: "12px 14px", border: CADRE, borderRadius: 16, background: "#F4EEFC" }}>
            <dt style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", opacity: 0.65 }}>
              {terme}
            </dt>
            <dd style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 800 }}>{valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Une collection publique. Elle se consulte en étant connecté — c'est la
 * règle des collections (`peutVoir`, `lib/collections/regles.ts`) ; la carte
 * mène donc à la connexion pour un visiteur anonyme.
 */
export function CarteCollection({ collection: c, connecte }: { collection: CollectionEnVitrine; connecte: boolean }) {
  const cible = `/dashboard/collections/${c.id}`;
  const href = connecte ? cible : `/connexion?suite=${encodeURIComponent(cible)}`;
  return (
    <Link
      href={href as Route}
      className="sticker-press"
      style={{ display: "block", border: CADRE, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, overflow: "hidden", color: ENCRE }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gridTemplateRows: "1fr 1fr", height: 170, borderBottom: CADRE }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              gridRow: i === 0 ? "1 / span 2" : undefined,
              borderLeft: i > 0 ? CADRE : undefined,
              borderTop: i === 2 ? CADRE : undefined,
              background: c.couvertures[i]
                ? `center / cover no-repeat url(${vignetteDe(c.couvertures[i]!)})`
                : "repeating-linear-gradient(135deg,#EADFF9 0 9px,#FFFFFF 9px 18px)",
            }}
          />
        ))}
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.25 }}>{c.titre}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.65, marginTop: 2 }}>
          {c.ressources} ressource{c.ressources > 1 ? "s" : ""}
        </div>
      </div>
    </Link>
  );
}

const intertitre = {
  fontSize: 13,
  fontWeight: 800,
  textTransform: "uppercase" as const,
  letterSpacing: ".08em",
  marginBottom: 12,
};
