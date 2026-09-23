"use client";

import {
  BLANC,
  ENCRE,
  JAUNE,
  LAVANDE_PROFOND,
  ORANGE,
} from "@/components/shell/nav-data";

/**
 * Hero de l'accueil — variante B de « Baobart Accueil.dc.html ».
 *
 * La variante A et son sélecteur ont été retirés après arbitrage : son titre
 * était en anglais alors que tout le projet est en français, et il ne portait
 * pas la baseline. Le rail latéral, que la maquette liait à cette variante,
 * est désormais une navigation permanente — c'est de la navigation, pas une
 * option de mise en page.
 *
 * Les chiffres viennent de la base : afficher une preuve sociale qu'on n'a pas
 * serait un mensonge.
 */

const CADRE = `2.5px solid ${ENCRE}`;

export interface ChiffresCommunaute {
  ressources: number;
  createurs: number;
  /** `null` tant que personne n'a noté : le bloc est alors masqué. */
  note: number | null;
}

export function HeroB({ chiffres }: { chiffres: ChiffresCommunaute }) {
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "34px 32px 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.05fr) minmax(0,.95fr)",
          gap: 34,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: CADRE,
              borderRadius: 999,
              background: JAUNE,
              padding: "7px 16px",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: ".08em",
            }}
          >
            Plateforme collaborative
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(40px,5.8vw,82px)",
              lineHeight: 0.94,
              letterSpacing: "-2.5px",
              margin: "18px 0 0",
              textTransform: "uppercase",
              overflowWrap: "break-word",
              minWidth: 0,
            }}
          >
            Le studio partagé de l&apos;Afrique{" "}
            <span
              style={{
                background: LAVANDE_PROFOND,
                border: `3px solid ${ENCRE}`,
                padding: "0 10px",
                display: "inline-block",
                transform: "rotate(-1.5deg)",
              }}
            >
              créative
            </span>
          </h1>

          <p
            style={{
              maxWidth: 480,
              margin: "22px 0 0",
              fontSize: 17,
              fontWeight: 500,
              lineHeight: 1.5,
              opacity: 0.75,
            }}
          >
            Illustrations, mockups, fonts, photos : tout est là, libre ou à petit
            prix. Enregistre dans tes collections, commente avec ton équipe.
          </p>

          <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
            <a
              href="#grid"
              style={{
                padding: "16px 30px",
                border: CADRE,
                borderRadius: 16,
                background: ENCRE,
                color: BLANC,
                boxShadow: `5px 5px 0 ${ORANGE}`,
                fontSize: 15,
                fontWeight: 800,
              }}
            >
              Commencer gratuitement
            </a>
            <a
              href="#collab"
              style={{
                padding: "16px 30px",
                border: CADRE,
                borderRadius: 16,
                background: BLANC,
                boxShadow: `5px 5px 0 ${ENCRE}`,
                fontSize: 15,
                fontWeight: 800,
              }}
            >
              Créer un espace
            </a>
          </div>

          <div style={{ display: "flex", gap: 28, marginTop: 34 }}>
            {[
              {
                valeur: new Intl.NumberFormat("fr-FR").format(chiffres.ressources),
                libelle: "ressources",
              },
              {
                valeur: new Intl.NumberFormat("fr-FR").format(chiffres.createurs),
                libelle: "créatifs",
              },
              ...(chiffres.note !== null
                ? [
                    {
                      valeur: chiffres.note.toFixed(1),
                      libelle: "satisfaction",
                    },
                  ]
                : []),
            ].map((s) => (
              <div key={s.libelle}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 28,
                  }}
                >
                  {s.valeur}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.7 }}>
                  {s.libelle}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "auto auto",
            gap: 18,
          }}
        >
          <div
            style={{
              gridColumn: "1 / span 2",
              border: CADRE,
              borderRadius: 24,
              background: BLANC,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 16,
            }}
          >
            <div
              style={{
                height: 240,
                border: CADRE,
                borderRadius: 16,
                background:
                  "url('/img/demo/beaute-afro.jpg') center 30% / cover no-repeat",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 14,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                Ankara Editorial · 24 visuels
              </div>
              <a
                href="#grid"
                style={{
                  padding: "10px 16px",
                  border: CADRE,
                  borderRadius: 12,
                  background: JAUNE,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                Ouvrir
              </a>
            </div>
          </div>

          <div
            style={{
              border: CADRE,
              borderRadius: 24,
              background: JAUNE,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 16,
              animation: "floaty 7s ease-in-out infinite",
            }}
          >
            <div
              style={{
                height: 130,
                border: CADRE,
                borderRadius: 14,
                background: "url('/img/demo/neon-01.png') center / cover no-repeat",
              }}
            />
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 800 }}>
              Pack Wax &amp; Motifs
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.75 }}>
              gratuit · 2 340 dl
            </div>
          </div>

          <div
            style={{
              border: CADRE,
              borderRadius: 24,
              background: BLANC,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 16,
            }}
          >
            <div
              style={{
                height: 130,
                border: CADRE,
                borderRadius: 14,
                /*
                  LA MAQUETTE MET ICI UN PACKSHOT CERAVE, ET ON NE LA SUIT PAS

                  « Baobart Accueil.dc.html » ligne 244 pose
                  `img/packshot-soin.png` : une bouteille CeraVe, marque
                  réelle, photographiée de face avec son étiquette lisible.
                  La maquette fait foi pour la mise en page ; elle ne peut pas
                  faire foi pour le droit d'afficher le produit d'autrui sur
                  une page d'accueil.

                  Le catalogue de démonstration écarte déjà trois CeraVe pour
                  cette raison exacte (`prisma/demo-catalogue.ts`, ECARTES).
                  Celui-ci échappait à la règle parce qu'il était commité dans
                  le dépôt au lieu d'être servi depuis MinIO — la liste des
                  écartés ne regardait pas là.

                  À la place, une affiche du jeu de démonstration, qui
                  correspond en plus à ce que la carte annonce. Le fichier
                  d'origine reste dans « Baobart Design/img/ » : ce dossier
                  est la maquette elle-même, on ne le modifie pas.
                */
                background: "url('/img/demo/affiche-rue.jpg') center / cover no-repeat",
              }}
            />
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 800 }}>
              Mockup Affiche Rue
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.75 }}>
              3 000 FCFA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
