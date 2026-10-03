/**
 * Les médias déposés puis abandonnés : les retrouver, et les retirer.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA DETTE QUE CE MODULE SOLDE
 *
 * Les images du blog et les médias des bannières partent au stockage dès qu'on
 * les choisit, avant l'enregistrement : c'est ce qui évite de renvoyer une
 * vidéo à chaque correction de virgule. Le revers, écrit dans les deux
 * formulaires depuis le début : un fichier remplacé, ou envoyé puis abandonné,
 * restait au stockage pour toujours. Relevé de nouveau le 03/10 ; ce passage
 * quotidien le retire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS GARDES, PARCE QU'UNE SUPPRESSION NE SE DÉFAIT PAS
 *
 *   — un DÉLAI : un fichier de moins de vingt-quatre heures n'est jamais
 *     retiré. C'est le temps de finir un formulaire commencé avant le passage ;
 *   — un PLAFOND : cinq cents suppressions par passage au plus. Si la lecture
 *     des références déraille, le dégât est borné et le bilan le montre ;
 *   — une VÉRIFICATION : chaque média rangé dans une colonne qui en porte un
 *     à coup sûr (l'image d'une bannière, la couverture d'un article) doit se
 *     retrouver parmi les références extraites. S'il en manque un, c'est que
 *     l'extraction ne reconnaît plus les adresses — un changement de CDN, un
 *     nouveau format —, et le passage s'arrête sans rien retirer. Sans cette
 *     garde, une extraction qui ne trouve rien réussirait… en vidant tout.
 *
 * Un fichier est « cité » si son nom paraît dans N'IMPORTE QUEL texte qui peut
 * porter une adresse d'image — pas seulement le blog et les bannières : une
 * image d'article recopiée dans la description d'un événement doit survivre à
 * la suppression de l'article.
 *
 * Pur : le stockage et la base sont passés en paramètres.
 */

/** Les dossiers balayés. Les fichiers vendus et leurs aperçus n'en sont pas. */
export const DOSSIERS_BALAYES = ["public/pubs/", "public/blog/"] as const;

/** Vingt-quatre heures de répit après le dépôt. */
export const DELAI_MS = 24 * 60 * 60 * 1000;
/** Cinq cents suppressions par passage, au plus. */
export const PLAFOND_PAR_PASSAGE = 500;

/** Un nom tiré au sort au dépôt : un UUID et une extension. */
const NOM = /(?:^|\/)(?:pubs|blog)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5})/gi;

/** Les noms de fichiers cités dans ces textes, en minuscules. */
export function nomsCites(textes: readonly (string | null | undefined)[]): Set<string> {
  const noms = new Set<string>();
  for (const t of textes) {
    if (!t) continue;
    for (const m of t.matchAll(NOM)) noms.add(m[1]!.toLowerCase());
  }
  return noms;
}

/** Le nom d'un fichier, depuis sa clé ou son adresse publique. */
export function nomDuFichier(cleOuAdresse: string): string {
  const chemin = cleOuAdresse.split(/[?#]/)[0]!;
  return chemin.slice(chemin.lastIndexOf("/") + 1).toLowerCase();
}

export interface Objet {
  cle: string;
  modifieLe: Date;
}

/** Ce qu'on retirerait : non cité, plus vieux que le délai, dans la limite du plafond. */
export function aRetirer(input: {
  objets: readonly Objet[];
  cites: ReadonlySet<string>;
  maintenant: Date;
  delaiMs?: number;
  plafond?: number;
}): { retirer: string[]; recents: number; cites: number } {
  const delai = input.delaiMs ?? DELAI_MS;
  const plafond = input.plafond ?? PLAFOND_PAR_PASSAGE;
  const retirer: string[] = [];
  let recents = 0;
  let cites = 0;

  for (const o of input.objets) {
    if (input.cites.has(nomDuFichier(o.cle))) {
      cites += 1;
      continue;
    }
    if (input.maintenant.getTime() - o.modifieLe.getTime() < delai) {
      recents += 1;
      continue;
    }
    if (retirer.length < plafond) retirer.push(o.cle);
  }

  return { retirer, recents, cites };
}

export interface Bilan {
  examines: number;
  cites: number;
  recents: number;
  retires: number;
  /** Ce qui serait retiré, quand on demande un essai sans suppression. */
  aRetirer?: string[];
  /** Le passage s'est arrêté avant de rien retirer — et pourquoi. */
  arret?: string;
}

/**
 * Le passage entier. `essai` rend la liste sans rien supprimer : c'est ce
 * qu'on lance la première fois sur un stockage qu'on ne connaît pas.
 */
export async function balayerLesMedias(input: {
  lister: (prefixe: string) => Promise<Objet[]>;
  supprimer: (cle: string) => Promise<void>;
  /** Tous les textes qui peuvent citer une adresse de média. */
  textes: () => Promise<(string | null)[]>;
  /** Les adresses qui désignent un média à coup sûr — la vérification. */
  attendues: () => Promise<string[]>;
  maintenant: Date;
  essai?: boolean;
}): Promise<Bilan> {
  const [textes, attendues] = await Promise.all([input.textes(), input.attendues()]);
  const cites = nomsCites(textes);

  const manquant = attendues.find((a) => !cites.has(nomDuFichier(a)));
  if (manquant !== undefined) {
    return {
      examines: 0,
      cites: cites.size,
      recents: 0,
      retires: 0,
      arret: `une adresse rangée n'est pas reconnue par l'extraction (${nomDuFichier(manquant)}) : rien n'est retiré`,
    };
  }

  const objets = (await Promise.all(DOSSIERS_BALAYES.map((d) => input.lister(d)))).flat();
  const decision = aRetirer({ objets, cites, maintenant: input.maintenant });

  if (input.essai) {
    return { examines: objets.length, cites: decision.cites, recents: decision.recents, retires: 0, aRetirer: decision.retirer };
  }

  // L'un après l'autre : un stockage qui refuse s'arrête au premier refus
  // plutôt que de recevoir cinq cents requêtes d'un coup.
  for (const cle of decision.retirer) await input.supprimer(cle);

  return { examines: objets.length, cites: decision.cites, recents: decision.recents, retires: decision.retirer.length };
}
