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

export const MAUVE = "#C9A8F5";
export const GRIS = "#DCDCDC";
export const VERT = "#B9E8C0";

/**
 * Les couleurs des états d'opération, reprises de la maquette.
 *
 * Le code de l'œil est stable d'un écran à l'autre : le gris pour ce qui dort
 * ou s'est arrêté sans dommage, le jaune pour ce qui attend un geste, le mauve
 * pour ce qui est parti et qu'on attend, le vert pour la fin heureuse, l'orange
 * pour ce qui a mal tourné, le noir pour ce qui est gelé par une décision.
 */
export interface TonEtat {
  fond: string;
  encre: string;
}

export const TON_ETAT: Record<string, TonEtat> = {
  dort: { fond: GRIS, encre: ENCRE },
  attend: { fond: JAUNE, encre: ENCRE },
  enRoute: { fond: MAUVE, encre: ENCRE },
  arrive: { fond: VERT, encre: ENCRE },
  casse: { fond: ORANGE, encre: BLANC },
  gele: { fond: ENCRE, encre: BLANC },
  neutre: { fond: BLANC, encre: ENCRE },
};
