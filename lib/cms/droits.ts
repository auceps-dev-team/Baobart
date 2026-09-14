import type { Pouvoir, RolePlateforme } from "@/lib/auth/administration";
import { peut } from "@/lib/auth/administration";

/**
 * Qui a le droit de publier quoi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES QUATRE CMS N'ONT PAS LE MÊME RÉGIME
 *
 * C'est le point qui décide de toute leur construction, et la pente naturelle
 * est de l'oublier : ce sont quatre listes avec un éditeur, on les traite
 * uniformément, et l'on obtient soit un blog que n'importe qui écrit, soit un
 * annuaire d'offres que personne ne peut remplir.
 *
 *   BLOG               l'administration seule
 *   ÉVÉNEMENTS         l'administration, ou une agence badgée et abonnée
 *   JOBS               tout inscrit — lecture publique, action authentifiée
 *   SERVICES           vendeur, abonné, badgé Freelance ou Agence
 *
 * Voir `SPEC_ADMIN_CMS_BAOBART.md` §18, qui arbitre et prime sur les §§4 à 7.
 *
 * Les événements ont changé de régime en v1.51.0 : ils étaient rangés avec le
 * blog, ils ne le sont plus. Le raisonnement est écrit sur leur `case`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE DROIT SE CALCULE, IL NE SE RANGE PAS
 *
 * Une colonne `peutPublierDesServices` serait plus rapide à lire et fausse au
 * premier renouvellement manqué. Les conditions se relisent à chaque fois,
 * depuis ce qui fait autorité : la progression du compte, l'état Ndank de son
 * abonnement, ses badges.
 *
 * C'est la même leçon qu'ailleurs dans ce projet — `lib/auth/roles.ts` déduit
 * l'étape d'un compte de son activité, Ndank déduit l'état d'un abonnement de
 * ses dates. Un statut rangé se désynchronise dès qu'un passage rate son tour.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MODULE EST PUR
 *
 * Il reçoit des faits, il rend une décision. Aucune requête, aucune session :
 * c'est ce qui permet d'éprouver « un abonnement suspendu ferme la publication
 * sans fermer les prestations en cours » sans rien monter.
 */

export type TypeDeContenu = "job" | "service" | "evenement" | "article";

/**
 * Ce qu'on sait de la personne au moment de décider.
 *
 * Rien n'est optionnel : un champ absent serait lu comme « faux », et un droit
 * refusé par oubli est aussi difficile à diagnostiquer qu'un droit accordé par
 * erreur.
 */
export interface Demandeur {
  role: RolePlateforme;
  /** A publié au moins une ressource — au sens de `lib/auth/roles.ts`. */
  estVendeur: boolean;
  /** Abonnement `ACTIVE` ou dans la grâce — au sens de Ndank. */
  abonnementOuvert: boolean;
  /** Porte le badge Freelance ou Agence, accordé par l'administration. */
  badgeProfessionnel: boolean;
}

export type Refus =
  /** Il faut un compte. Rien de plus. */
  | "CONNEXION_REQUISE"
  /** Réservé à l'administration. */
  | "RESERVE_A_L_ADMINISTRATION"
  /** Il faut avoir publié quelque chose pour être vendeur. */
  | "PAS_ENCORE_VENDEUR"
  /** Le badge Freelance ou Agence manque, et il s'accorde. */
  | "BADGE_MANQUANT"
  /** L'abonnement n'est plus ouvert. */
  | "ABONNEMENT_A_RENOUVELER";

export type Verdict = { ok: true } | { ok: false; motif: Refus };

export const MESSAGES: Record<Refus, string> = {
  CONNEXION_REQUISE: "Connecte-toi pour publier.",
  RESERVE_A_L_ADMINISTRATION:
    "Ce contenu est publié par l'équipe Baobart. Écris-nous si tu as quelque chose à proposer.",
  PAS_ENCORE_VENDEUR:
    "Publie d'abord une ressource : on devient vendeur en publiant, pas en le déclarant.",
  // Le message parle de « publier », pas de « services » : il sert aussi aux
  // événements depuis v1.51.0, et deux messages jumeaux auraient divergé.
  BADGE_MANQUANT:
    "Publier ici demande un compte Freelance ou Agence. Le badge s'accorde après vérification — écris-nous.",
  ABONNEMENT_A_RENOUVELER:
    "Ton abonnement doit être à jour pour publier du nouveau. Tes services et tes événements en ligne ne bougent pas.",
};

/**
 * Cette personne peut-elle publier ce type de contenu ?
 *
 * `null` veut dire « personne » : un visiteur non connecté. C'est un cas à part
 * entière, pas une absence — sur Jobs, il a le droit de LIRE, et c'est
 * `peutLire` qui le dit.
 */
export function peutPublier(
  qui: Demandeur | null,
  type: TypeDeContenu,
): Verdict {
  if (qui === null) return { ok: false, motif: "CONNEXION_REQUISE" };

  switch (type) {
    // ── Blog : l'administration, et personne d'autre ───────────────────────
    //
    // Un article signé du site engage le site. C'est la voix de Baobart, pas
    // une tribune.
    case "article":
      return peut(qui.role, "publier_du_contenu")
        ? { ok: true }
        : { ok: false, motif: "RESERVE_A_L_ADMINISTRATION" };

    // ── Événements : l'administration, ou une agence badgée ────────────────
    //
    // ═══════════════════════════════════════════════════════════════════════
    // CE CAS S'EST OUVERT, ET LA RAISON MÉRITE D'ÊTRE ÉCRITE
    //
    // §18.1 réservait les événements à l'administration, au même titre que le
    // blog. C'était juste tant qu'un événement portait la voix du site — une
    // édition de concours, une conférence Baobart.
    //
    // Ça ne l'est plus depuis qu'on veut que les agences organisent leurs
    // propres ateliers. Leur demander de passer par l'équipe pour publier une
    // date, puis pour la corriger, puis pour lire leurs inscrits, transforme
    // l'administration en secrétariat — et la fonction ne serait pas utilisée.
    //
    // ═══════════════════════════════════════════════════════════════════════
    // ON N'AJOUTE PAS DE RÔLE, ON RELIT UN BADGE
    //
    // La tentation serait un `PlatformRole` « ORGANISATEUR ». Ce serait la
    // faute que §18.3 a déjà écartée pour les services : `PlatformRole` décrit
    // ce qu'on fait **dans le back-office**, et un rôle unique par personne
    // ferait qu'être organisateur remplacerait MEMBER.
    //
    // Le badge Freelance ou Agence existe, il vit sur le profil, et il
    // s'accorde — il ne se déclare pas. C'est exactement la garantie qu'on
    // veut ici : personne ne s'auto-proclame organisateur.
    //
    // ═══════════════════════════════════════════════════════════════════════
    // POURQUOI PAS « ÊTRE VENDEUR », CONTRAIREMENT AUX SERVICES
    //
    // Un service **est** une vente : exiger d'avoir déjà publié une ressource
    // y a du sens. Organiser un atelier n'en est pas une — une agence peut
    // n'avoir jamais rien mis en vente et tenir un atelier sérieux. La
    // condition serait un obstacle sans rapport avec le risque.
    //
    // L'abonnement reste exigé : publier sous son nom sur la plateforme est
    // un privilège continu, et un badge accordé une fois ne doit pas ouvrir
    // la porte indéfiniment à un compte qui a cessé de payer.
    case "evenement": {
      if (peut(qui.role, "publier_du_contenu")) return { ok: true };

      if (!qui.badgeProfessionnel) return { ok: false, motif: "BADGE_MANQUANT" };
      if (!qui.abonnementOuvert) {
        return { ok: false, motif: "ABONNEMENT_A_RENOUVELER" };
      }
      return { ok: true };
    }

    // ── Jobs : tout inscrit ────────────────────────────────────────────────
    //
    // Aucune condition au-delà du compte. Ce qui protège n'est pas le droit
    // d'entrée — un compte se crée en deux minutes — mais la modération : rien
    // ne paraît avant relecture.
    case "job":
      return { ok: true };

    // ── Services : trois conditions cumulatives ────────────────────────────
    //
    // L'ordre des refus n'est pas indifférent. On annonce d'abord ce qui
    // demande le plus de travail : quelqu'un qui n'est pas encore vendeur n'a
    // que faire d'apprendre qu'il lui manque aussi un badge.
    case "service": {
      // L'administration passe outre : elle publie pour dépanner un créateur,
      // et son geste est tracé à l'audit.
      if (peut(qui.role, "publier_du_contenu")) return { ok: true };

      if (!qui.estVendeur) return { ok: false, motif: "PAS_ENCORE_VENDEUR" };
      if (!qui.badgeProfessionnel) return { ok: false, motif: "BADGE_MANQUANT" };
      if (!qui.abonnementOuvert) {
        return { ok: false, motif: "ABONNEMENT_A_RENOUVELER" };
      }
      return { ok: true };
    }
  }
}

/**
 * Qui peut lire ce type de contenu, une fois publié ?
 *
 * Tout le monde, sans exception, y compris sans compte. C'est écrit ici plutôt
 * que sous-entendu : une fonction qui rend toujours vrai a l'air inutile, mais
 * elle est l'endroit où l'on viendra le changer si un CMS devient réservé — et
 * sans elle, ce changement serait éparpillé dans quatre écrans.
 */
export function peutLire(): boolean {
  return true;
}

/**
 * Qui peut agir sur un contenu publié — postuler, s'inscrire, commander ?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * VOIR EST PUBLIC, AGIR NE L'EST PAS
 *
 * C'est le resserrement du 2 septembre 2026, et il fait disparaître la surface
 * d'attaque la plus large du projet : un formulaire public qui écrit en base.
 *
 * Il ne filtre pas les arnaques — un compte gratuit se crée en deux minutes —
 * mais il donne quelqu'un à qui les imputer. On peut suspendre un compte ; on
 * ne peut pas suspendre un visiteur.
 */
export function peutAgir(qui: Demandeur | null): Verdict {
  return qui === null ? { ok: false, motif: "CONNEXION_REQUISE" } : { ok: true };
}

/** Le pouvoir d'administration qui modère ce type de contenu. */
export function pouvoirDeModeration(type: TypeDeContenu): Pouvoir {
  // Le blog n'a pas de file : son auteur portait déjà le droit de publier, et
  // le pouvoir rendu ici ne sert qu'au retrait.
  //
  // Les événements en ont une depuis que les agences y écrivent, et c'est
  // encore `publier_du_contenu` qui la tient — non `moderer_le_contenu`. Qui
  // relit un événement est qui le met en ligne : séparer les deux créerait un
  // relecteur incapable de conclure sa propre lecture.
  return type === "article" || type === "evenement"
    ? "publier_du_contenu"
    : "moderer_le_contenu";
}

/**
 * Les types de contenu qu'un rôle a le droit de relire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA FILE DE MODÉRATION N'EST PAS LA MÊME POUR TOUT LE MONDE
 *
 * Jobs et Services demandent `moderer_le_contenu` ; les événements
 * `publier_du_contenu`, parce que qui relit un événement est qui le met en
 * ligne. Un modérateur verrait donc des fiches sur lesquelles ses boutons
 * échoueraient, et un éditorial des offres qui ne le regardent pas.
 *
 * La correspondance n'est pas rangée ici une seconde fois : elle se relit
 * depuis `pouvoirDeModeration`. Le jour où un CMS change de pouvoir, la file
 * suit toute seule.
 *
 * `article` en est absent volontairement. Le blog n'a pas d'écran, rien n'y
 * sera jamais soumis, et compter un type sans dépôt ferait afficher une file
 * qui promet ce qui n'arrive pas.
 */
export function typesRelusPar(role: RolePlateforme): TypeDeContenu[] {
  const candidats: TypeDeContenu[] = ["job", "service", "evenement"];
  return candidats.filter((t) => peut(role, pouvoirDeModeration(t)));
}

/**
 * Ce contenu passe-t-il par une relecture avant de paraître ?
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX RAISONS DE PASSER PAR LA FILE, ET UNE SEULE SUFFIT
 *
 * **Le CMS a une file.** Jobs et Services sont ouverts à des gens dont on ne
 * répond pas : tout ce qui y entre est lu, même écrit par l'équipe. Un
 * administrateur qui dépanne un créateur publie sous le nom de ce créateur —
 * sa signature ne vaut pas relecture.
 *
 * **Ou l'auteur ne porte pas `publier_du_contenu`.** C'est la seconde raison,
 * et elle est arrivée avec les agences : depuis qu'un compte badgé peut écrire
 * un événement, « événement » ne veut plus dire « écrit par l'équipe ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI L'AUTEUR EST DEVENU UN PARAMÈTRE
 *
 * La fonction ne prenait que le type, et c'était exact tant que le type
 * déterminait l'auteur. Ouvrir les événements a cassé ce lien — et le test
 * « aucun contenu ouvert ne paraît sans relecture » l'a signalé avant qu'un
 * seul écran ne soit touché.
 *
 * C'est l'intérêt d'un invariant écrit comme test plutôt que comme commentaire :
 * il ne se relit pas, il se casse.
 */
export function exigeUneRelecture(type: TypeDeContenu, qui: Demandeur): boolean {
  if (type === "job" || type === "service") return true;
  return !peut(qui.role, "publier_du_contenu");
}
