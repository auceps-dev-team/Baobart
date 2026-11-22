import Link from "next/link";
import type { Route } from "next";

import { Vide } from "@/components/dashboard/ecran";
import { Pagination } from "@/components/dashboard/pagination";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE, ORANGE } from "@/lib/systeme/charte";

/**
 * La grille de personnes de la maquette (`Baobart Dashboard.dc.html`, bloc
 * PERSONNES, l. 770-784) : une carte par personne — un rond, un nom, une ligne
 * de présentation, un bouton. Traduite à l'identique : grille `auto-fit` de
 * 280 px au moins, 16 px d'écart, carte de 14 px de marge intérieure, ombre de
 * 4 px, rond de 44 px.
 *
 * Employée par « Abonnés » (`c_abonnes`, lot 5a). « Suivre les détails »
 * (`c_suivre`) et « Abonnements » (`abonnements_suivis`) dessinent la même.
 */

export interface Personne {
  cle: string;
  nom: string;
  presentation: string;
  /** La photo, quand la personne l'a rendue publique ; sinon la trame de la maquette. */
  avatarUrl?: string | null;
  action?: {
    label: string;
    href: string;
    /** Nom accessible complet (« Message à Awa Diallo ») : il contient le libellé visible. */
    nomAccessible: string;
    fond?: string;
  };
}

/**
 * Les six trames des ronds de la maquette (`stripe(base, rayure, 5)`, l. 1767-1772),
 * attribuées par la clé : deux lectures de la même page donnent les mêmes ronds.
 */
const TRAMES: Array<[string, string]> = [
  [ORANGE, JAUNE],
  [MAUVE, BLANC],
  [ENCRE, LAVANDE],
  [JAUNE, ORANGE],
  [BLANC, ENCRE],
  [LAVANDE, ORANGE],
];

function rondDe(cle: string): string {
  let somme = 0;
  for (let i = 0; i < cle.length; i += 1) somme = (somme + cle.charCodeAt(i)) % 997;
  const [fond, rayure] = TRAMES[somme % TRAMES.length]!;
  return `repeating-linear-gradient(135deg, ${rayure} 0 5px, ${fond} 5px 12px)`;
}

export function GrillePersonnes({
  personnes,
  vide,
  pagination,
  etiquette,
}: {
  personnes: Personne[];
  vide: { titre: string; texte: string; action?: { label: string; href: string } };
  pagination?: { page: number; pages: number; adresse: (n: number) => string };
  /** Le nom de la liste pour un lecteur d'écran (« Tes abonnés »). */
  etiquette: string;
}) {
  if (personnes.length === 0) {
    return (
      <div style={{ marginTop: 4 }}>
        <Vide {...vide} />
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <ul
        aria-label={etiquette}
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
          gap: 16,
        }}
      >
        {personnes.map((p) => (
          <li
            key={p.cle}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: CADRE,
              borderRadius: 20,
              background: BLANC,
              boxShadow: `4px 4px 0 ${ENCRE}`,
              padding: 14,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 44,
                height: 44,
                flex: "0 0 auto",
                border: CADRE,
                borderRadius: 99,
                // Une adresse de notre stockage, mise entre guillemets : une parenthèse
                // dans le nom du fichier ne casserait pas la déclaration.
                background: p.avatarUrl ? `center / cover no-repeat url(${JSON.stringify(p.avatarUrl)})` : rondDe(p.cle),
              }}
            />
            <span style={{ flex: "1 1 auto", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 800, overflowWrap: "anywhere" }}>{p.nom}</span>
              <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, opacity: 0.65, overflowWrap: "anywhere" }}>
                {p.presentation}
              </span>
            </span>
            {p.action ? (
              <Link
                href={p.action.href as Route}
                aria-label={p.action.nomAccessible}
                className="sticker-press"
                style={{
                  flex: "0 0 auto",
                  padding: "8px 14px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 11,
                  background: p.action.fond ?? LAVANDE,
                  color: ENCRE,
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                {p.action.label}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
      {pagination ? <Pagination {...pagination} /> : null}
    </div>
  );
}
