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
import type { Filtre } from "@/lib/feed/types";

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
            fontFamily: "'Archivo Black', sans-serif",
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
            fontFamily: "'Space Mono', monospace",
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
                  fontFamily: "'Space Mono', monospace",
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

// ──────────────────────────────────── 170 ressources, triées à la main ──────

/** Contenu éditorial — à remplacer par des collections réelles (CMS, §J). */
const COLLECTIONS = [
  { nom: "Wax", compte: "18 pièces", fond: trame(BLANC, ORANGE, 6) },
  { nom: "Portraits", compte: "24 pièces", fond: trame(LAVANDE, ENCRE, 6) },
  { nom: "Typo", compte: "9 pièces", fond: trame(JAUNE, ENCRE, 6) },
  { nom: "Affiches", compte: "31 pièces", fond: trame(BLANC, LAVANDE_PROFOND, 6) },
  { nom: "Mockups", compte: "12 pièces", fond: trame(ORANGE, JAUNE, 6) },
  { nom: "Textures", compte: "22 pièces", fond: trame(ENCRE, LAVANDE, 6) },
  { nom: "Icônes", compte: "27 pièces", fond: trame(BLANC, JAUNE, 6) },
  { nom: "Motifs", compte: "40 pièces", fond: trame(LAVANDE_PROFOND, BLANC, 6) },
];

export function CollectionsTrieesMain() {
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
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: 40,
              lineHeight: 0.98,
              letterSpacing: "-1.5px",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Plus de 170 ressources, triées à la main
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
            Motifs, portraits, typos, mockups, icônes : des collections pensées
            pour les projets d&apos;ici. Pas de banque d&apos;images générique,
            du vrai matériel local.
          </p>
          <Link
            href="/explore"
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
            Voir les collections
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 14,
          }}
        >
          {COLLECTIONS.map((k) => (
            <div
              key={k.nom}
              style={{
                border: CADRE,
                borderRadius: 16,
                background: BLANC,
                padding: 10,
              }}
            >
              <div
                style={{
                  height: 74,
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 10,
                  background: k.fond,
                }}
              />
              <div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 8 }}>
                {k.nom}
              </div>
              <div
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 10.5,
                  opacity: 0.6,
                }}
              >
                {k.compte}
              </div>
            </div>
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
          fontFamily: "'Archivo Black', sans-serif",
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
                fontFamily: "'Archivo Black', sans-serif",
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
                fontFamily: "'Archivo Black', sans-serif",
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
                      fontFamily: "'Space Mono', monospace",
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
              fontFamily: "'Archivo Black', sans-serif",
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
              fontFamily: "'Space Mono', monospace",
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

/** Contenu éditorial repris de la maquette — à remplacer par de vrais avis. */
const TEMOIGNAGES = [
  {
    texte:
      "Enfin des visuels qui ressemblent à nos clients. On a gagné deux jours de recherche par projet.",
    nom: "Mariam Sow",
    role: "DA, Studio Kaay",
    fond: BLANC,
    avatar: trame(ORANGE, JAUNE, 5),
  },
  {
    texte:
      "J'ai vendu mes premiers packs en trois semaines. Le paiement mobile change tout.",
    nom: "Yao Kouadio",
    role: "Type designer",
    fond: JAUNE,
    avatar: trame(ENCRE, LAVANDE, 5),
  },
  {
    texte: "Les espaces partagés remplacent nos dossiers Drive éparpillés.",
    nom: "Serge Nkosi",
    role: "Lead design, Kivu",
    fond: BLANC,
    avatar: trame(LAVANDE_PROFOND, BLANC, 5),
  },
  {
    texte: "En école, mes étudiants ont enfin une banque de références locales.",
    nom: "Aïcha Barry",
    role: "Enseignante",
    fond: LAVANDE_PROFOND,
    avatar: trame(JAUNE, ENCRE, 5),
  },
];

export function Temoignages() {
  return (
    <div style={CONTENEUR}>
      <h2
        style={{
          fontFamily: "'Archivo Black', sans-serif",
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
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
          gap: 18,
        }}
      >
        {TEMOIGNAGES.map((t) => (
          <div
            key={t.nom}
            style={{
              border: CADRE,
              borderRadius: 22,
              background: t.fond,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 34,
                lineHeight: 0.6,
              }}
            >
              &ldquo;
            </div>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                lineHeight: 1.5,
                flex: "1 1 auto",
              }}
            >
              {t.texte}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                paddingTop: 12,
                borderTop: CADRE,
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  border: CADRE,
                  borderRadius: 99,
                  background: t.avatar,
                }}
              />
              <span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>
                  {t.nom}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    fontWeight: 600,
                    opacity: 0.65,
                  }}
                >
                  {t.role}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────── Blog ─────

/** Contenu éditorial repris de la maquette — à remplacer par le CMS Blog (§J). */
const ARTICLES = [
  {
    date: "24 juil. 2026",
    titre: "Comment fixer le prix d'un pack de ressources",
    extrait: "Trois grilles tarifaires testées par nos vendeurs les plus actifs.",
    fond: "url('/img/demo/studio-01.png') center 20% / cover no-repeat",
  },
  {
    date: "17 juil. 2026",
    titre: "Les motifs wax expliqués aux designers",
    extrait: "Origines, symboliques et pièges à éviter quand on les remixe.",
    fond: "url('/img/demo/collage-lunettes.jpg') center / cover no-repeat",
  },
  {
    date: "9 juil. 2026",
    titre: "Nouveau : les espaces d'équipe",
    extrait: "Collections partagées, commentaires ancrés, invitations en un lien.",
    fond: "url('/img/demo/mode-blanc-01.png') center 20% / cover no-repeat",
  },
];

export function Blog() {
  return (
    <div id="blog" style={CONTENEUR}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 22,
        }}
      >
        <h2
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: 36,
            letterSpacing: "-1.2px",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          Quoi de neuf
        </h2>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            borderBottom: CADRE,
            opacity: 0.55,
          }}
        >
          Tous les articles
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 18,
        }}
      >
        {ARTICLES.map((p) => (
          <div
            key={p.titre}
            className="sticker-press"
            style={{
              border: CADRE,
              borderRadius: 22,
              background: BLANC,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              overflow: "hidden",
            }}
          >
            <div style={{ height: 150, borderBottom: CADRE, background: p.fond }} />
            <div style={{ padding: 16 }}>
              <div
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11,
                  opacity: 0.6,
                }}
              >
                {p.date}
              </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
