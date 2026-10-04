import Link from "next/link";

import {
  BLANC,
  ENCRE,
  JAUNE,
  LAVANDE,
  LAVANDE_CLAIR,
  LAVANDE_PROFOND,
  ORANGE,
} from "@/components/shell/nav-data";
import { CarteTemoignage } from "@/components/temoignages/carte";
import type { Filtre } from "@/lib/feed/types";
import type { TemoignagePublic } from "@/lib/temoignages/service";

/**
 * Sections de l'accueil, traduites de « Baobart Accueil.dc.html ».
 *
 * Ce qui peut venir de la base en vient (compteurs par famille, créateurs).
 * Le reste — témoignages, articles, collections éditoriales — est du contenu
 * qui n'a pas encore de modèle : il est repris tel quel de la maquette et
 * marqué comme tel, pour qu'on sache quoi remplacer quand le CMS arrivera.
 */

const CADRE = `2.5px solid ${ENCRE}`;

function trame(a: string, b: string, pas = 7): string {
  return `repeating-linear-gradient(135deg,${a} 0 ${pas}px,${b} ${pas}px ${pas * 2 + 2}px)`;
}

const CONTENEUR = {
  maxWidth: 1400,
  margin: "0 auto",
  padding: "72px 32px 0",
} as const;

// ─────────────────────────────────────────────── Gratuit, tout de suite ─────

const TRAMES_FAMILLE: Record<string, string> = {
  Mockup: trame(BLANC, ORANGE),
  Logo: trame(LAVANDE, ENCRE),
  Pack: trame(BLANC, JAUNE),
  Photo: trame(ORANGE, LAVANDE),
  Illustration: trame(BLANC, LAVANDE_PROFOND),
  Vidéo: trame(ENCRE, JAUNE),
  Font: trame(JAUNE, ENCRE),
  Icône: trame(LAVANDE_PROFOND, BLANC),
  Art: trame(ORANGE, JAUNE),
  Audio: trame(ENCRE, LAVANDE_PROFOND),
};

export function Categories({
  familles,
}: {
  familles: Array<{ famille: Filtre; total: number }>;
}) {
  return (
    <div style={{ ...CONTENEUR, padding: "64px 32px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 34,
            letterSpacing: "-1px",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          Gratuit, tout de suite
        </h2>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            opacity: 0.6,
          }}
        >
          {familles.length} familles de ressources
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
          gap: 16,
        }}
      >
        {familles.map((f) => (
          <Link
            key={f.famille}
            href={`/explore?filtre=${encodeURIComponent(f.famille)}`}
            className="sticker-press"
            style={{
              border: CADRE,
              borderRadius: 20,
              background: BLANC,
              boxShadow: `4px 4px 0 ${ENCRE}`,
              padding: 14,
              display: "flex",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
            }}
          >
            <span style={{ flex: "1 1 auto" }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 800 }}>
                {f.famille}
              </span>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  opacity: 0.6,
                }}
              >
                {f.total} fichier{f.total > 1 ? "s" : ""}
              </span>
            </span>
            <span
              style={{
                width: 58,
                height: 58,
                border: CADRE,
                borderRadius: 14,
                flex: "0 0 auto",
                background: TRAMES_FAMILLE[f.famille] ?? trame(BLANC, LAVANDE_PROFOND),
              }}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────── La bibliothèque, par famille ──────

const TRAMES_RAYON = [
  trame(BLANC, ORANGE, 6),
  trame(LAVANDE, ENCRE, 6),
  trame(JAUNE, ENCRE, 6),
  trame(BLANC, LAVANDE_PROFOND, 6),
  trame(ORANGE, JAUNE, 6),
  trame(ENCRE, LAVANDE, 6),
  trame(BLANC, JAUNE, 6),
  trame(LAVANDE_PROFOND, BLANC, 6),
];

/**
 * La bibliothèque, rayon par rayon.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TOUT CE QUI EST ÉCRIT ICI EST COMPTÉ
 *
 * La maquette annonçait « Plus de 170 ressources, triées à la main » et huit
 * collections (« Wax 18 pièces », « Portraits 24 pièces »…). Aucune n'existait,
 * et rien n'est trié à la main : relevé le 04/10, la base ne contient aucune
 * collection éditoriale. Les huit tuiles sont désormais les familles les plus
 * fournies, chacune avec son compte réel, la couverture de sa ressource la
 * plus récente, et un lien vers Explorer filtré.
 *
 * La forme de la maquette est gardée : un bandeau lavande, un titre, huit
 * tuiles. Le jour où des collections éditoriales existeront, elles prendront
 * la place des familles.
 */
export function CollectionsTrieesMain({
  total,
  rayons,
}: {
  total: number;
  rayons: Array<{ famille: Filtre; total: number; couverture: string | null }>;
}) {
  if (total === 0 || rayons.length === 0) return null;

  return (
    <div style={CONTENEUR}>
      <div
        style={{
          border: CADRE,
          borderRadius: 28,
          background: LAVANDE_PROFOND,
          boxShadow: `7px 7px 0 ${ENCRE}`,
          padding: 32,
          display: "grid",
          gridTemplateColumns: ".85fr 1.15fr",
          gap: 32,
          alignItems: "center",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 40,
              lineHeight: 0.98,
              letterSpacing: "-1.5px",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            {new Intl.NumberFormat("fr-FR").format(total)} ressource{total > 1 ? "s" : ""}, rangées
            par famille
          </h2>
          <p
            style={{
              fontSize: 15.5,
              fontWeight: 500,
              lineHeight: 1.55,
              margin: "16px 0 0",
              opacity: 0.8,
            }}
          >
            Illustrations, photos, mockups, polices, icônes : publiées par les créateurs de
            Baobart. Pas de banque d&apos;images générique, du vrai matériel local.
          </p>
          <Link
            href="/explore"
            className="sticker-press"
            style={{
              display: "inline-block",
              marginTop: 22,
              padding: "14px 26px",
              border: CADRE,
              borderRadius: 16,
              background: BLANC,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              fontSize: 14.5,
              fontWeight: 800,
            }}
          >
            Voir toutes les ressources
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 14,
          }}
        >
          {rayons.map((r, i) => (
            <Link
              key={r.famille}
              href={`/explore?filtre=${encodeURIComponent(r.famille)}`}
              className="sticker-press"
              data-rayon={r.famille}
              style={{
                display: "block",
                border: CADRE,
                borderRadius: 16,
                background: BLANC,
                padding: 10,
                color: ENCRE,
              }}
            >
              <div
                style={{
                  height: 74,
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 10,
                  // Une couverture réelle quand la famille en a une ; sinon la
                  // trame de la maquette, qui ne prétend rien montrer.
                  background: r.couverture
                    ? `url(${JSON.stringify(r.couverture)}) center / cover no-repeat`
                    : TRAMES_RAYON[i % TRAMES_RAYON.length],
                }}
              />
              <div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 8 }}>{r.famille}</div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  opacity: 0.6,
                }}
              >
                {r.total} pièce{r.total > 1 ? "s" : ""}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────── Vos espaces d'équipe ─────

const TUILES = [
  trame(LAVANDE, ORANGE, 8),
  trame(BLANC, ENCRE, 8),
  trame(JAUNE, LAVANDE_PROFOND, 8),
  trame(ORANGE, BLANC, 8),
];

const COMMENTAIRES = [
  {
    qui: "Awa",
    quand: "il y a 1 h",
    texte: "Le motif 3 marche mieux sur fond clair, non ?",
    fond: trame(ORANGE, JAUNE, 5),
  },
  {
    qui: "Kofi",
    quand: "il y a 4 h",
    texte: "J'ai ajouté deux variantes dans la collection.",
    fond: trame(LAVANDE_PROFOND, BLANC, 5),
  },
];

const MES_COLLECTIONS = [
  { nom: "Inspiration wax", compte: "18", fond: trame(ORANGE, BLANC, 5) },
  { nom: "Refonte site club", compte: "7", fond: trame(LAVANDE_PROFOND, BLANC, 5) },
  { nom: "Typos à tester", compte: "12", fond: trame(JAUNE, ENCRE, 5) },
];

export function EspacesEquipe({
  createurs,
}: {
  createurs: Array<{ username: string; nom: string; lieu: string | null }>;
}) {
  return (
    <div id="collab" style={CONTENEUR}>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 44,
          letterSpacing: "-1.5px",
          margin: "0 0 6px",
          textTransform: "uppercase",
        }}
      >
        Vos espaces d&apos;équipe
      </h2>
      <p
        style={{
          fontSize: 16,
          fontWeight: 500,
          opacity: 0.75,
          margin: "0 0 26px",
          maxWidth: 620,
        }}
      >
        Likes, collections partagées, commentaires au bon endroit. Fini les
        captures d&apos;écran par WhatsApp.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr .85fr",
          gap: 20,
        }}
      >
        <div
          style={{
            border: CADRE,
            borderRadius: 24,
            background: BLANC,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingBottom: 16,
              borderBottom: CADRE,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                border: CADRE,
                borderRadius: 13,
                background: JAUNE,
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-display)",
                fontSize: 16,
              }}
            >
              AD
            </div>
            <div style={{ flex: "1 1 auto" }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                Collection · Campagne Dakar 2026
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.65 }}>
                4 membres · 38 ressources · mise à jour il y a 2 h
              </div>
            </div>
            <div
              style={{
                padding: "9px 14px",
                border: CADRE,
                borderRadius: 12,
                background: LAVANDE,
                fontSize: 12.5,
                fontWeight: 800,
              }}
            >
              Inviter
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 12,
              padding: "16px 0",
            }}
          >
            {TUILES.map((fond, i) => (
              <div
                key={i}
                style={{
                  height: 96,
                  border: CADRE,
                  borderRadius: 14,
                  background: fond,
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {COMMENTAIRES.map((c) => (
              <div
                key={c.qui}
                style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    flex: "0 0 auto",
                    border: CADRE,
                    borderRadius: 99,
                    background: c.fond,
                  }}
                />
                <div
                  style={{
                    border: CADRE,
                    borderRadius: 14,
                    borderTopLeftRadius: 4,
                    background: LAVANDE_CLAIR,
                    padding: "10px 13px",
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 800 }}>
                    {c.qui}{" "}
                    <span style={{ fontWeight: 600, opacity: 0.55 }}>
                      {c.quand}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      lineHeight: 1.4,
                      marginTop: 3,
                    }}
                  >
                    {c.texte}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              border: CADRE,
              borderRadius: 24,
              background: JAUNE,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 20,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                textTransform: "uppercase",
                lineHeight: 1.05,
              }}
            >
              Mes collections
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 16,
              }}
            >
              {MES_COLLECTIONS.map((m) => (
                <div
                  key={m.nom}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    border: CADRE,
                    borderRadius: 14,
                    background: BLANC,
                    padding: "10px 12px",
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      border: `2px solid ${ENCRE}`,
                      borderRadius: 9,
                      background: m.fond,
                    }}
                  />
                  <span style={{ flex: "1 1 auto", fontSize: 13.5, fontWeight: 800 }}>
                    {m.nom}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      opacity: 0.6,
                    }}
                  >
                    {m.compte}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              border: CADRE,
              borderRadius: 24,
              background: BLANC,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 20,
              flex: "1 1 auto",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800 }}>Créatifs à suivre</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 14,
              }}
            >
              {createurs.map((p, i) => (
                <div
                  key={p.username}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      border: CADRE,
                      borderRadius: 99,
                      background: TUILES[i % TUILES.length],
                    }}
                  />
                  <span style={{ flex: "1 1 auto" }}>
                    <span
                      style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}
                    >
                      {p.nom}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11.5,
                        fontWeight: 600,
                        opacity: 0.65,
                      }}
                    >
                      {p.lieu ?? "Afrique"}
                    </span>
                  </span>
                  <span
                    style={{
                      padding: "7px 13px",
                      border: `2px solid ${ENCRE}`,
                      borderRadius: 10,
                      background: LAVANDE,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    Suivre
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Contribuer ─────

export function AppelAuxCreatifs({ partCreateur }: { partCreateur: string }) {
  return (
    <div id="contrib" style={CONTENEUR}>
      <div
        style={{
          border: CADRE,
          borderRadius: 28,
          background: ENCRE,
          color: BLANC,
          boxShadow: `7px 7px 0 ${ORANGE}`,
          padding: 34,
          display: "grid",
          gridTemplateColumns: "1fr .8fr",
          gap: 34,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-block",
              border: `2.5px solid ${BLANC}`,
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 11.5,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: ".1em",
            }}
          >
            Appel aux créatifs
          </div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 46,
              lineHeight: 0.96,
              letterSpacing: "-2px",
              margin: "16px 0 0",
              textTransform: "uppercase",
            }}
          >
            Publie tes ressources. Fais-toi payer
            <span style={{ color: JAUNE }}>.</span>
          </h2>
          <p
            style={{
              fontSize: 15.5,
              fontWeight: 500,
              lineHeight: 1.55,
              opacity: 0.8,
              maxWidth: 520,
            }}
          >
            Dépose tes fichiers, fixe ton prix (ou offre-les), garde{" "}
            {partCreateur} de chaque vente. On s&apos;occupe du reste.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 24, flexWrap: "wrap" }}>
            <span
              style={{
                padding: "15px 26px",
                border: `2.5px solid ${BLANC}`,
                borderRadius: 16,
                background: JAUNE,
                color: ENCRE,
                fontSize: 14.5,
                fontWeight: 800,
              }}
            >
              Déposer un fichier
            </span>
            <span
              style={{
                padding: "15px 26px",
                border: `2.5px solid ${BLANC}`,
                borderRadius: 16,
                fontSize: 14.5,
                fontWeight: 800,
              }}
            >
              Comment ça marche
            </span>
          </div>
        </div>

        <div
          style={{
            border: `2.5px dashed ${BLANC}`,
            borderRadius: 20,
            padding: 26,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            glisse tes fichiers ici
          </div>
          <div
            style={{
              height: 120,
              marginTop: 16,
              border: `2.5px solid ${BLANC}`,
              borderRadius: 14,
              background: trame(BLANC, ENCRE, 8),
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 14 }}>
            PNG · JPG · AI · PSD · TTF · ZIP — 200 Mo max
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────── Témoignages ─────

/**
 * « Ils nous font confiance » : les témoignages publiés.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * QUATRE TÉMOIGNAGES INVENTÉS, RETIRÉS LE 04/10
 *
 * La section reprenait ceux de la maquette — « Mariam Sow, DA, Studio Kaay »,
 * « Yao Kouadio, Type designer »… —, signés de personnes qui n'existent pas.
 * Elle montre désormais ceux que des membres ont proposés et que l'équipe a
 * publiés (`lib/temoignages`), et disparaît tant qu'il n'y en a aucun.
 */
export function Temoignages({ temoignages }: { temoignages: TemoignagePublic[] }) {
  if (temoignages.length === 0) return null;

  return (
    <div style={CONTENEUR}>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 36,
          letterSpacing: "-1.2px",
          margin: "0 0 22px",
          textTransform: "uppercase",
        }}
      >
        Ils nous font confiance
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(260px,100%),1fr))",
          gap: 18,
        }}
      >
        {temoignages.map((t, i) => (
          <CarteTemoignage
            key={t.id}
            texte={t.texte}
            nom={t.nom}
            presentation={t.presentation}
            avatarUrl={t.avatarUrl}
            rang={i}
          />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────── Blog ─────

const TRAMES_ARTICLE = [trame(ORANGE, JAUNE, 9), trame(LAVANDE_PROFOND, BLANC, 9), trame(JAUNE, ENCRE, 9)];

const DATE_ARTICLE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * « Quoi de neuf » : les trois derniers articles publiés.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DES ARTICLES QUI EXISTENT, OU RIEN
 *
 * Jusqu'au 04/10, les trois cartes étaient celles de la maquette — « Comment
 * fixer le prix d'un pack », daté du 24 juillet —, et ni elles ni « Tous les
 * articles » ne menaient nulle part. Elles viennent désormais du blog
 * (`listerPublics`), chacune vers son article, et la section disparaît tant
 * qu'aucun n'est publié : trois cartes inventées valent moins qu'aucune.
 */
export function Blog({
  articles,
}: {
  articles: Array<{ slug: string; titre: string; extrait: string; couvertureUrl: string | null; publieLe: Date | null }>;
}) {
  if (articles.length === 0) return null;

  return (
    <div id="blog" style={CONTENEUR}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 36,
            letterSpacing: "-1.2px",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          Quoi de neuf
        </h2>
        <Link
          href="/blog"
          style={{
            fontSize: 13,
            fontWeight: 800,
            borderBottom: CADRE,
            opacity: 0.75,
            color: ENCRE,
          }}
        >
          Tous les articles
        </Link>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(300px,100%),1fr))",
          gap: 18,
        }}
      >
        {articles.map((p, i) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="sticker-press"
            style={{
              display: "block",
              border: CADRE,
              borderRadius: 22,
              background: BLANC,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              overflow: "hidden",
              color: ENCRE,
            }}
          >
            <div
              style={{
                height: 150,
                borderBottom: CADRE,
                background: p.couvertureUrl
                  ? `url(${JSON.stringify(p.couvertureUrl)}) center / cover no-repeat`
                  : TRAMES_ARTICLE[i % TRAMES_ARTICLE.length],
              }}
            />
            <div style={{ padding: 16 }}>
              {p.publieLe ? (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    opacity: 0.6,
                  }}
                >
                  {DATE_ARTICLE.format(p.publieLe)}
                </div>
              ) : null}
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  lineHeight: 1.25,
                  marginTop: 6,
                }}
              >
                {p.titre}
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  opacity: 0.75,
                  lineHeight: 1.45,
                  marginTop: 8,
                }}
              >
                {p.extrait}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
