import type { CSSProperties, ReactNode } from "react";

import { GLYPHES } from "@/lib/reseaux/glyphes";
import { fondDuReseau, nomDuReseau, type Reseau } from "@/lib/reseaux/reseaux";

/**
 * Les logos réseaux, dans les usages que dessine le Design System
 * (section « 05 · Logos réseaux », relue le 16/10).
 *
 * Toujours un contour noir de 2,5 px et une ombre dure ; le fond vient de la
 * palette Baobart, jamais des couleurs officielles. Les valeurs — tailles,
 * rayons, ombres, survols — sont celles de la maquette. Le repos et le survol
 * vivent dans `globals.css` (`.reseau-*`) : un style en ligne l'emporterait
 * sur `:hover`, et la tuile ne jaunirait jamais.
 *
 * Aucun de ces composants ne s'exécute dans le navigateur : ce sont des liens.
 */

/** Le glyphe seul, dans la couleur du texte qui l'entoure. */
export function Glyphe({ reseau, taille }: { reseau: Reseau; taille: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", fill: "currentColor", flex: "0 0 auto" }}
    >
      <path d={GLYPHES[reseau]} />
    </svg>
  );
}

/**
 * Un lien proposé par un créateur reste un lien externe : nouvel onglet,
 * `noopener` pour que la page ouverte ne pilote pas la nôtre, `nofollow` parce
 * que Baobart ne se porte pas garant de ce qu'il y a au bout.
 */
const REL_EXTERNE = "noopener noreferrer nofollow";

/**
 * « Pastilles · fond clair » : rond de 56 px, glyphe de 24 px, fond propre à
 * chaque réseau. Sert au partage, où l'on veut reconnaître la marque d'un coup
 * d'œil.
 */
export function Pastille({
  reseau,
  href,
  libelle,
  legende,
}: {
  reseau: Reseau;
  href: string;
  /** Ce qu'annonce un lecteur d'écran : « Partager sur WhatsApp ». */
  libelle: string;
  /** Le nom sous le rond, en Space Mono — facultatif. */
  legende?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={libelle}
      title={libelle}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 72, color: "#121212" }}
    >
      <span className="reseau-pastille" style={{ background: fondDuReseau(reseau) }}>
        <Glyphe reseau={reseau} taille={24} />
      </span>
      {legende ? <span style={legendeStyle}>{legende}</span> : null}
    </a>
  );
}

/**
 * Le même rond, pour une action qui n'est pas un lien (« Copier le lien »).
 * Le contenu est fourni par l'appelant.
 */
export function PastilleAction({
  libelle,
  legende,
  fond,
  onClick,
  children,
}: {
  libelle: string;
  legende?: string;
  fond: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={libelle}
      title={libelle}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        width: 72,
        padding: 0,
        border: "none",
        background: "none",
        color: "#121212",
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      <span className="reseau-pastille" style={{ background: fond }}>
        {children}
      </span>
      {legende ? <span style={legendeStyle}>{legende}</span> : null}
    </button>
  );
}

/**
 * « Tuiles carrées · profils créateurs » : carré de 46 px, blanc au repos,
 * jaune au survol, glyphe de 20 px.
 */
export function Tuile({
  reseau,
  href,
  proprietaire,
}: {
  reseau: Reseau;
  href: string;
  /** « Awa Diallo » — pour annoncer « Instagram d'Awa Diallo ». */
  proprietaire: string;
}) {
  // « d'Awa Diallo », pas « de Awa Diallo ». Les voyelles seules : le h
  // aspiré (« de Hamed ») ne s'élide pas, et on ne saurait pas le deviner.
  const de = /^[aeiouyàâäéèêëîïôöùûü]/i.test(proprietaire) ? "d’" : "de ";
  const libelle = `${nomDuReseau(reseau)} ${de}${proprietaire} (nouvel onglet)`;
  return (
    <a href={href} target="_blank" rel={REL_EXTERNE} className="reseau-tuile" aria-label={libelle} title={nomDuReseau(reseau)}>
      <Glyphe reseau={reseau} taille={20} />
    </a>
  );
}

/**
 * « Liens profil · avec identifiant » : le logo dans un rond de 34 px, le nom
 * du réseau, l'identifiant en Space Mono.
 */
export function LienAvecIdentifiant({
  reseau,
  href,
  identifiant,
}: {
  reseau: Reseau;
  href: string;
  identifiant: string;
}) {
  return (
    <a href={href} target="_blank" rel={REL_EXTERNE} className="reseau-lien">
      <span
        style={{
          width: 34,
          height: 34,
          border: "2px solid #121212",
          borderRadius: 99,
          background: fondDuReseau(reseau),
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        <Glyphe reseau={reseau} taille={16} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>
          {nomDuReseau(reseau)}
        </span>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            opacity: 0.65,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {identifiant}
        </span>
      </span>
    </a>
  );
}

/** Le petit rond du formulaire : la pastille des liens profil, sans lien. */
export function Medaillon({ reseau }: { reseau: Reseau }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 34,
        height: 34,
        border: "2px solid #121212",
        borderRadius: 99,
        background: fondDuReseau(reseau),
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
        color: "#121212",
      }}
    >
      <Glyphe reseau={reseau} taille={16} />
    </span>
  );
}

const legendeStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  textAlign: "center",
};
