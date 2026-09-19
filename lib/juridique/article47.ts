/**
 * Ce que l'article 47 exige d'une notification.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA SOURCE, ET COMMENT ELLE A ÉTÉ TROUVÉE
 *
 * Loi ivoirienne n° 2013-451 du 19 juin 2013 relative à la lutte contre la
 * cybercriminalité, **chapitre 6 — « Responsabilité des prestataires
 * techniques de service en ligne »**, articles 46 à 54. Lue le 19 septembre
 * 2026 dans le Journal officiel publié par tresor.gouv.ci.
 *
 * Elle n'est pas là où on l'attendrait. La loi n° 2013-546 sur les
 * transactions électroniques — celle qui transpose l'acte additionnel CEDEAO
 * A/SA.2/01/10 — ne contient **aucun** régime de responsabilité des
 * hébergeurs : elle traite du commerce électronique, de la publicité, du
 * contrat et de la signature. Le régime est dans la loi pénale.
 *
 * Article 47, verbatim :
 *
 *   « La connaissance des faits litigieux est présumée acquise par les
 *   personnes mentionnées à l'article précédent, lorsqu'il leur est notifié
 *   par la victime ou par une personne intéressée, les activités illicites ou
 *   les faits et circonstances faisant apparaître ce caractère. Pour être
 *   prise en compte la notification doit comporter les éléments suivants :
 *     — si l'auteur de la notification est une personne physique : ses nom,
 *       prénoms, profession, domicile, nationalité, date et lieu de naissance ;
 *     — si l'auteur de la notification est une personne morale : sa
 *       dénomination et son siège social ;
 *     — les nom, prénoms et domicile du destinataire du service en cause ou
 *       s'il s'agit d'une personne morale, sa dénomination et son siège
 *       social ;
 *     — la description des faits litigieux et leur localisation précise sur le
 *       réseau ;
 *     — les droits et les motifs pour lesquels le retrait du contenu litigieux
 *       est demandé ;
 *     — la copie de la correspondance adressée à l'auteur ou à défaut à
 *       l'éditeur des informations ou activités litigieuses demandant leur
 *       interruption, leur retrait ou leur modification, ou la justification
 *       de ce que l'auteur ou l'éditeur n'a pu être contacté. »
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SIX ÉLÉMENTS, PAS SEPT — ET PAS CEUX DU DMCA
 *
 * Une première version de ce module suivait la loi **sénégalaise** n° 2008-08,
 * parce que la maquette porte « © 2026 Baobart — Dakar, Sénégal » en pied de
 * page. Baobart est ivoirienne : le texte applicable est celui-ci.
 *
 * Les deux lois se ressemblent — elles descendent de la même matrice — mais
 * pas au point qu'on puisse prendre l'une pour l'autre :
 *
 *   — la liste sénégalaise compte SEPT éléments et commence par « la date de
 *     la notification » ; la liste ivoirienne en compte six et ne la demande
 *     pas ;
 *   — pour une personne morale, le Sénégal exige forme, dénomination, siège
 *     ET organe représentant ; la Côte d'Ivoire n'exige que **dénomination et
 *     siège social** ;
 *   — pour le destinataire, la Côte d'Ivoire demande **nom, prénoms ET
 *     domicile**, le Sénégal « nom et domicile ».
 *
 * Exiger ce que la loi ne demande pas n'est pas une prudence : c'est un
 * obstacle de plus devant quelqu'un à qui l'on a pris son travail.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ÉLÉMENT QUE LE DMCA N'A PAS
 *
 * Le dernier : la copie de la correspondance adressée à l'auteur, ou la
 * justification de ce qu'il n'a pu être contacté. Il oblige à **parler à la
 * personne avant de s'adresser à la plateforme**. Le DMCA américain permet
 * l'inverse, et c'est ce qui en a fait un outil de retrait de masse.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ARTICLE 49 : NOTIFIER DE MAUVAISE FOI EST UN DÉLIT
 *
 *   « Est puni d'une peine d'emprisonnement de un à cinq ans et d'une amende
 *   de 1.000.000 à 5.000.000 de francs CFA, le fait, pour toute personne de
 *   présenter de mauvaise foi […] un contenu ou une activité comme étant
 *   illicite dans le but d'en obtenir le retrait ou d'en faire cesser la
 *   diffusion. »
 *
 * Ce n'est pas une garde technique, et pourtant c'est la meilleure protection
 * du créateur dans tout ce dispositif. L'écran de dépôt l'affiche — non pour
 * intimider, mais parce qu'une personne qui hésite entre « il m'a copié » et
 * « son travail ressemble au mien » a le droit de savoir ce qu'elle signe.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MODULE EST PUR
 *
 * Aucune requête, aucune session, aucune date « maintenant ». C'est ce qui
 * permet d'éprouver les six exigences sans monter une base, et de les relire à
 * côté du texte de loi.
 */

/**
 * Les six exigences, nommées.
 *
 * La loi ivoirienne ne les numérote pas — elle les liste par tirets. On leur
 * donne des noms plutôt que des lettres inventées : « il manque `b` » ne veut
 * rien dire pour qui n'a pas le texte sous les yeux.
 */
export type Exigence =
  | "notifiant"
  | "destinataire"
  | "faits"
  | "localisation"
  | "motifs"
  | "correspondance";

export type Qualite = "PERSONNE_PHYSIQUE" | "PERSONNE_MORALE";

/** Ce que le formulaire recueille. Tout en chaînes : rien n'est encore validé. */
export interface Saisie {
  qualite: Qualite;
  courriel: string;

  /** Personne physique : nom. Personne morale : dénomination. */
  nom: string;
  /** Personne physique : domicile. Personne morale : siège social. */
  adresse: string;

  // Personne physique seulement
  prenoms: string;
  profession: string;
  nationalite: string;
  naissanceDate: string;
  naissanceLieu: string;

  // Le destinataire du service en cause
  destinataireNom: string;
  destinatairePrenoms: string;
  destinataireAdresse: string;

  faits: string;
  adressesVisees: string;

  motifs: string;

  contactPrealable: string;
  contactImpossible: boolean;
}

export interface Manque {
  exigence: Exigence;
  champ: keyof Saisie;
  message: string;
}

export interface NotificationValide {
  qualite: Qualite;
  courriel: string;
  nom: string;
  adresse: string;
  prenoms: string | null;
  profession: string | null;
  nationalite: string | null;
  naissanceDate: Date | null;
  naissanceLieu: string | null;
  destinataireNom: string;
  destinatairePrenoms: string | null;
  destinataireAdresse: string | null;
  faits: string;
  adressesVisees: string[];
  motifs: string;
  contactPrealable: string;
  contactImpossible: boolean;
}

export type Verdict =
  | { complete: true; valeur: NotificationValide }
  | { complete: false; manques: Manque[] };

/**
 * Les seuils.
 *
 * Bas, et c'est voulu : ce formulaire est rempli par quelqu'un qui estime
 * qu'on lui a pris son travail, souvent en colère et rarement juriste. Un
 * seuil haut ne produit pas de meilleurs dossiers — il produit du remplissage
 * pour passer la barre, et décourage ceux qui ont raison.
 *
 * Ce qu'on exige, c'est la **présence** de chaque élément, parce que c'est ce
 * que la loi exige. La qualité, c'est l'examen humain qui la juge.
 */
const COURT = 2;
const PHRASE = 12;

export function validerNotification(saisie: Saisie): Verdict {
  const manques: Manque[] = [];
  const t = (v: string) => v.trim().replace(/\s+/g, " ");

  // ── L'auteur de la notification ───────────────────────────────────────────
  const nom = t(saisie.nom);
  const adresse = t(saisie.adresse);
  const physique = saisie.qualite === "PERSONNE_PHYSIQUE";

  if (nom.length < COURT) {
    manques.push(
      m(
        "notifiant",
        "nom",
        physique ? "Ton nom." : "La dénomination de l'organisation.",
      ),
    );
  }

  if (adresse.length < PHRASE) {
    manques.push(
      m(
        "notifiant",
        "adresse",
        physique ? "Ton domicile, complet." : "Le siège social, complet.",
      ),
    );
  }

  const courriel = t(saisie.courriel);
  if (!courriel.includes("@") || courriel.length < 5) {
    // Hors de la liste de l'article 47, et pourtant exigé : sans adresse de
    // retour, on ne peut ni accuser réception, ni réclamer ce qui manque, ni
    // annoncer la décision. La loi décrit le minimum de la présomption de
    // connaissance, pas une procédure utilisable.
    manques.push(
      m("notifiant", "courriel", "Une adresse électronique pour te répondre."),
    );
  }

  if (physique) {
    // La loi ivoirienne demande les six, pour une personne physique.
    if (t(saisie.prenoms).length < COURT) {
      manques.push(m("notifiant", "prenoms", "Tes prénoms."));
    }
    if (t(saisie.profession).length < COURT) {
      manques.push(m("notifiant", "profession", "Ta profession."));
    }
    if (t(saisie.nationalite).length < COURT) {
      manques.push(m("notifiant", "nationalite", "Ta nationalité."));
    }
    if (!dateDeNaissanceValide(saisie.naissanceDate)) {
      manques.push(m("notifiant", "naissanceDate", "Ta date de naissance."));
    }
    if (t(saisie.naissanceLieu).length < COURT) {
      manques.push(m("notifiant", "naissanceLieu", "Ton lieu de naissance."));
    }
  }
  // Pour une personne morale, la loi ivoirienne ne demande QUE dénomination et
  // siège social — déjà vérifiés ci-dessus. Ni forme juridique, ni organe
  // représentant : ce sont les exigences sénégalaises, et les ajouter ferait
  // refuser des notifications que la loi d'ici tient pour complètes.

  // ── Le destinataire du service en cause ───────────────────────────────────
  const destinataireNom = t(saisie.destinataireNom);
  if (destinataireNom.length < COURT) {
    manques.push(
      m(
        "destinataire",
        "destinataireNom",
        "Le nom de la personne dont le contenu est visé, ou sa dénomination.",
      ),
    );
  }

  // ── Les faits ─────────────────────────────────────────────────────────────
  const faits = saisie.faits.trim();
  if (faits.length < PHRASE) {
    manques.push(m("faits", "faits", "Décris ce qui est litigieux."));
  }

  // ── Leur localisation précise sur le réseau ───────────────────────────────
  const adressesVisees = lignes(saisie.adressesVisees).filter(estUneAdresse);
  if (adressesVisees.length === 0) {
    // « Localisation précise sur le réseau » est le mot de la loi. « Tout son
    // profil » ne localise rien, et conduirait à retirer des pages que
    // personne n'a regardées.
    manques.push(
      m(
        "localisation",
        "adressesVisees",
        "L'adresse exacte de chaque contenu visé, une par ligne. « Tout le profil » ne localise rien.",
      ),
    );
  }

  // ── Les droits et les motifs ──────────────────────────────────────────────
  const motifs = saisie.motifs.trim();
  if (motifs.length < PHRASE) {
    manques.push(
      m(
        "motifs",
        "motifs",
        "Le droit que tu invoques — droit d'auteur, marque, vie privée… — et pourquoi il s'applique ici.",
      ),
    );
  }

  // ── La correspondance préalable ───────────────────────────────────────────
  const contactPrealable = saisie.contactPrealable.trim();
  if (contactPrealable.length < PHRASE) {
    manques.push(
      m(
        "correspondance",
        "contactPrealable",
        saisie.contactImpossible
          ? "Explique pourquoi tu n'as pas pu joindre l'auteur."
          : "Colle ici le message que tu as adressé à l'auteur pour lui demander le retrait.",
      ),
    );
  }

  if (manques.length > 0) return { complete: false, manques };

  return {
    complete: true,
    valeur: {
      qualite: saisie.qualite,
      courriel,
      nom,
      adresse,
      prenoms: physique ? t(saisie.prenoms) : null,
      profession: physique ? t(saisie.profession) : null,
      nationalite: physique ? t(saisie.nationalite) : null,
      naissanceDate: physique ? new Date(saisie.naissanceDate) : null,
      naissanceLieu: physique ? t(saisie.naissanceLieu) : null,
      destinataireNom,
      destinatairePrenoms: t(saisie.destinatairePrenoms) || null,
      destinataireAdresse: t(saisie.destinataireAdresse) || null,
      faits,
      adressesVisees,
      motifs,
      contactPrealable,
      contactImpossible: saisie.contactImpossible,
    },
  };
}

/** Les exigences qui manquent, dédoublonnées et dans l'ordre du texte. */
const ORDRE: Exigence[] = [
  "notifiant",
  "destinataire",
  "faits",
  "localisation",
  "motifs",
  "correspondance",
];

export function exigencesManquantes(manques: Manque[]): Exigence[] {
  const vues = new Set(manques.map((x) => x.exigence));
  return ORDRE.filter((e) => vues.has(e));
}

/** Ce qu'on écrit à quelqu'un dont le dossier est incomplet. */
export const LIBELLE_EXIGENCE: Record<Exigence, string> = {
  notifiant: "qui tu es",
  destinataire: "qui est visé",
  faits: "ce qui est litigieux",
  localisation: "où ça se trouve, précisément",
  motifs: "le droit invoqué et pourquoi",
  correspondance: "ce que tu as écrit à l'auteur avant",
};

// ════════════════════════════════════════════════════════════════════ outils ══

function m(exigence: Exigence, champ: keyof Saisie, message: string): Manque {
  return { exigence, champ, message };
}

function lignes(valeur: string): string[] {
  return valeur
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Une adresse acceptable.
 *
 * `http` et `https` seulement. Pas de `javascript:`, pas de `data:` — cette
 * chaîne sera affichée à un modérateur qui cliquera dessus, et une adresse
 * hostile dans un dossier juridique viserait exactement la personne qui a le
 * plus de pouvoir sur le compte visé.
 */
function estUneAdresse(valeur: string): boolean {
  try {
    const u = new URL(valeur);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function dateDeNaissanceValide(valeur: string): boolean {
  if (valeur.trim().length === 0) return false;
  const d = new Date(valeur);
  // Une date dans le futur n'est pas une date de naissance. On ne vérifie pas
  // la majorité : la loi n'en fait pas une condition, et un mineur peut être
  // l'auteur d'une œuvre qu'on lui a prise.
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}
