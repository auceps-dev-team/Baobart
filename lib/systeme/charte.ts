import type { NomIcone } from "@/lib/icones/donnees";
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
/** Le SEUL orange autorisé en texte (globals.css, charte §4.2) : 5,36:1 sur blanc. */
// Q-30, élargi le 22/11/2026 : #B34A1F passait sur le blanc (5,36:1) mais pas
// sur la lavande (4,19:1). Calculé ce jour-là : #A1411B tient sur tous les
// fonds clairs, en texte (blanc 6,39:1, lavande 5,00:1) comme en fond sous du
// blanc (6,39:1). L'orange de marque reste ORANGE : décor, grands titres.
export const ORANGE_SOMBRE = "#A1411B";
/**
 * Le texte secondaire — dates, étiquettes, mentions. Il était écrit en ENCRE
 * à `opacity: 0.55` ou `0.6`, recopié dans une dizaine de composants : sur
 * un texte de 10 px, l'opacité faisait tomber le contraste à 3,99:1 sur la
 * lavande, 4,11:1 sur le blanc (relevé axe du 22/11/2026, Q-30 : 810 des
 * 1 048 textes en défaut venaient d'UN de ces styles). Une couleur pleine ne
 * dépend plus du fond : 4,91:1 sur le mauve, son pire cas, 9,90:1 sur le blanc.
 */
export const ENCRE_DOUCE = "#46414C";
/** Son pendant sur fond ENCRE : 10,96:1 (calculé le 22/11/2026). ENCRE_DOUCE y tombait à 1,89:1. */
export const BLANC_DOUX = "#C9C4CF";
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
    pastilleFond: ORANGE_SOMBRE,
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
  /** Une icône Halo ; à défaut (✕, un nombre), le texte de `glyphe`. */
  icone?: NomIcone;
  glyphe?: string;
  surtitre: string;
  texte: string;
}

export const BANDEAU: Record<Gravite, Bandeau> = {
  ok: {
    fond: BLANC,
    encre: ENCRE,
    medaillon: BLANC,
    icone: "check",
    surtitre: "Gravité globale · OK",
    texte: "Tout ce qui est livré fonctionne.",
  },
  attention: {
    fond: JAUNE,
    encre: ENCRE,
    medaillon: BLANC,
    icone: "alert",
    surtitre: "Gravité globale · À VOIR",
    texte: "La plateforme sert, mais quelque chose mérite un regard.",
  },
  panne: {
    fond: ORANGE_SOMBRE,
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
  casse: { fond: ORANGE_SOMBRE, encre: BLANC },
  gele: { fond: ENCRE, encre: BLANC },
  neutre: { fond: BLANC, encre: ENCRE },
};
