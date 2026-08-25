import type { Gravite } from "@/lib/systeme/diagnostic";

/**
 * La traduction visuelle des trois gravités, telle que la maquette la fixe
 * (`Baobart Design/Baobart Dashboard.dc.html`, constantes `SEV` et `BANNERS`).
 *
 * Rassemblée ici plutôt que recopiée dans chaque écran : les trois pages de
 * l'espace système partagent ces couleurs, et trois copies divergeraient à la
 * première retouche.
 */

export const ENCRE = "#121212";
export const BLANC = "#FFFFFF";
export const JAUNE = "#FFD84A";
export const ORANGE = "#E2622C";
export const LAVANDE = "#EADFF9";
export const CADRE = `2.5px solid ${ENCRE}`;

export interface TonGravite {
  /** Fond de la pastille d'état. */
  pastilleFond: string;
  pastilleEncre: string;
  /** Teinte de la ligne, très pâle : elle situe sans crier. */
  ligneFond: string;
  /** Le mot affiché dans la pastille. */
  mot: string;
}

export const TON: Record<Gravite, TonGravite> = {
  ok: {
    pastilleFond: BLANC,
    pastilleEncre: ENCRE,
    ligneFond: "#F4EEFC",
    mot: "OK",
  },
  attention: {
    pastilleFond: JAUNE,
    pastilleEncre: ENCRE,
    ligneFond: "#FFFBEB",
    mot: "À VOIR",
  },
  panne: {
    pastilleFond: ORANGE,
    pastilleEncre: BLANC,
    ligneFond: "#FFF1EA",
    mot: "PANNE",
  },
};

export interface Bandeau {
  fond: string;
  encre: string;
  /** Fond du médaillon — contrasté avec le bandeau, jamais confondu avec lui. */
  medaillon: string;
  glyphe: string;
  surtitre: string;
  texte: string;
}

export const BANDEAU: Record<Gravite, Bandeau> = {
  ok: {
    fond: BLANC,
    encre: ENCRE,
    medaillon: BLANC,
    glyphe: "✓",
    surtitre: "Gravité globale · OK",
    texte: "Tout ce qui est livré fonctionne.",
  },
  attention: {
    fond: JAUNE,
    encre: ENCRE,
    medaillon: BLANC,
    glyphe: "!",
    surtitre: "Gravité globale · À VOIR",
    texte: "La plateforme sert, mais quelque chose mérite un regard.",
  },
  panne: {
    fond: ORANGE,
    encre: BLANC,
    medaillon: JAUNE,
    glyphe: "✕",
    surtitre: "Gravité globale · PANNE",
    texte: "Quelque chose d'essentiel ne fonctionne pas.",
  },
};
