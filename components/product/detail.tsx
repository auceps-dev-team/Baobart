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
import { formatCount, formatPrice } from "@/lib/i18n/money";
import type { FicheProduit } from "@/lib/products/queries";

/**
 * Contenu de la fiche ressource, traduit du bloc « DÉTAIL RESSOURCE » de
 * « Baobart Accueil.dc.html ».
 *
 * Le même contenu sert deux surfaces : la modale ouverte depuis le feed, et la
 * page complète pour un accès direct ou un lien partagé.
 */

const CADRE = `2.5px solid ${ENCRE}`;

function trameDe(id: string): string {
  const teintes = [LAVANDE_PROFOND, JAUNE, ORANGE, LAVANDE, LAVANDE_CLAIR];
  let somme = 0;
  for (let i = 0; i < id.length; i += 1) somme += id.charCodeAt(i);
  const accent = teintes[somme % teintes.length] as string;
  return `repeating-linear-gradient(135deg, ${accent} 0 8px, ${BLANC} 8px 18px)`;
}

function formatPoids(octets: number): string {
  if (octets >= 1024 * 1024) return `${Math.round(octets / (1024 * 1024))} Mo`;
  return `${Math.round(octets / 1024)} Ko`;
}

export function DetailProduit({ produit }: { produit: FicheProduit }) {
  const visuel = produit.coverUrl
    ? `center / cover no-repeat url(${produit.coverUrl})`
    : trameDe(produit.id);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.35fr .65fr",
        gap: 22,
        padding: 22,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            border: CADRE,
            borderRadius: 20,
            boxShadow: `5px 5px 0 ${ENCRE}`,
            height: 440,
            display: "grid",
            placeItems: "center",
            background: visuel,
          }}
        >
          {produit.coverUrl ? null : (
            <span
              style={{
                padding: "8px 16px",
                border: `2px solid ${ENCRE}`,
                borderRadius: 999,
                background: BLANC,
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
              }}
            >
              {produit.titre}
            </span>
          )}
        </div>

        {/*
          L'extrait, quand il existe. Une nappe sonore ou un motion design ne se
          juge pas sur une vignette : sans lui, l'acheteur paierait à l'aveugle.
          `preload="metadata"` — on ne télécharge pas l'extrait de toutes les
          fiches ouvertes, seulement sa durée.
        */}
        {produit.extrait ? (
          <div
            style={{
              border: CADRE,
              borderRadius: 20,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              background: BLANC,
              padding: 14,
            }}
          >
            <div
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                opacity: 0.65,
                marginBottom: 10,
              }}
            >
              Extrait
            </div>

            {produit.extrait.nature === "video" ? (
              <video
                src={produit.extrait.url}
                controls
                preload="metadata"
                style={{ width: "100%", borderRadius: 12, display: "block" }}
              />
            ) : (
              <audio
                src={produit.extrait.url}
                controls
                preload="metadata"
                style={{ width: "100%" }}
              />
            )}
          </div>
        ) : null}

        {produit.duMemeCreateur.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 12,
            }}
          >
            {produit.duMemeCreateur.map((a) => (
              <Link
                key={a.slug}
                href={`/products/${a.slug}`}
                title={a.titre}
                style={{
                  height: 80,
                  border: CADRE,
                  borderRadius: 13,
                  background: a.coverUrl
                    ? `center / cover no-repeat url(${a.coverUrl})`
                    : trameDe(a.slug),
                }}
              />
            ))}
          </div>
        ) : null}

        <div
          style={{
            border: CADRE,
            borderRadius: 20,
            background: BLANC,
            padding: 18,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800 }}>Commentaires (0)</div>
          <p
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              opacity: 0.65,
              margin: "12px 0 0",
            }}
          >
            Personne n&apos;a encore réagi. Les commentaires arrivent avec les
            comptes.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <input
              disabled
              placeholder="Ajouter un commentaire…"
              aria-label="Ajouter un commentaire"
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                fontFamily: "Poppins, sans-serif",
                fontSize: 13.5,
                fontWeight: 500,
                padding: "11px 14px",
                border: CADRE,
                borderRadius: 13,
                outline: "none",
                background: LAVANDE_CLAIR,
                opacity: 0.6,
              }}
            />
            <span
              style={{
                padding: "11px 18px",
                border: CADRE,
                borderRadius: 13,
                background: JAUNE,
                fontSize: 13,
                fontWeight: 800,
                opacity: 0.6,
              }}
            >
              Publier
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            border: CADRE,
            borderRadius: 20,
            background: BLANC,
            boxShadow: `5px 5px 0 ${ENCRE}`,
            padding: 18,
          }}
        >
          {produit.famille ? (
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                border: `2px solid ${ENCRE}`,
                borderRadius: 999,
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
              }}
            >
              {produit.famille}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: 26,
              lineHeight: 1.05,
              letterSpacing: "-.8px",
              marginTop: 12,
            }}
          >
            {produit.titre}
          </div>
          {produit.description ? (
            <p
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                lineHeight: 1.5,
                opacity: 0.75,
                margin: "10px 0 0",
              }}
            >
              {produit.description}
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 14,
              paddingTop: 14,
              borderTop: CADRE,
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                border: CADRE,
                borderRadius: 99,
                background: trameDe(produit.auteur.nom),
              }}
            />
            <span style={{ flex: "1 1 auto" }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>
                {produit.auteur.nom}
                {produit.auteur.verifie ? " ✓" : ""}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 11.5,
                  fontWeight: 600,
                  opacity: 0.65,
                }}
              >
                {produit.auteur.role}
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
                opacity: 0.6,
              }}
            >
              Suivre
            </span>
          </div>
        </div>

        <div
          style={{
            border: CADRE,
            borderRadius: 20,
            background: JAUNE,
            boxShadow: `5px 5px 0 ${ENCRE}`,
            padding: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 30 }}>
              {formatPrice(produit.prix, produit.devise)}
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11 }}>
              licence commerciale
            </div>
          </div>
          <div
            style={{
              padding: 14,
              marginTop: 14,
              border: CADRE,
              borderRadius: 14,
              background: ENCRE,
              color: BLANC,
              textAlign: "center",
              fontSize: 14.5,
              fontWeight: 800,
              opacity: 0.6,
            }}
          >
            Télécharger
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {["♥ J'aime", "⌸ Collection"].map((l) => (
              <span
                key={l}
                style={{
                  flex: "1 1 auto",
                  padding: 11,
                  border: CADRE,
                  borderRadius: 13,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  background: BLANC,
                  opacity: 0.6,
                }}
              >
                {l}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            border: CADRE,
            borderRadius: 20,
            background: BLANC,
            padding: 18,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            Détails
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 9,
              marginTop: 12,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {[
              ["Format", produit.fichier?.format ?? "—"],
              ["Dimensions", produit.fichier?.dimensions ?? "—"],
              [
                "Poids",
                produit.fichier ? formatPoids(produit.fichier.poids) : "—",
              ],
              ["Téléchargements", formatCount(produit.telechargements)],
              [
                "Ajouté le",
                new Intl.DateTimeFormat("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(produit.publieLe),
              ],
            ].map(([cle, valeur]) => (
              <div
                key={cle}
                style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
              >
                <span style={{ opacity: 0.6 }}>{cle}</span>
                <span>{valeur}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bandeau de titre, commun à la modale et à la page. */
export function EnTeteFiche({
  titre,
  action,
}: {
  titre: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "18px 22px",
        borderBottom: `3px solid ${ENCRE}`,
        background: BLANC,
        borderRadius: "25px 25px 0 0",
      }}
    >
      <div
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 11.5,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          opacity: 0.6,
        }}
      >
        Ressource
      </div>
      <div style={{ flex: "1 1 auto", fontSize: 15, fontWeight: 800 }}>{titre}</div>
      {action}
    </div>
  );
}
