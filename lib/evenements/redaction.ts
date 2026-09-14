import "server-only";

import { consigner, ressource } from "@/lib/admin/audit";
import { appliquer, type Geste } from "@/lib/cms/cycle";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { clauseDePortee, gestePermis, type Portee } from "@/lib/evenements/acces";
import { valider, type Refus, type Saisie } from "@/lib/evenements/validation";

/**
 * Écrire un événement — créer, corriger, publier, retirer, annuler.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX CHEMINS, SELON QUI ÉCRIT
 *
 * L'équipe va de `BROUILLON` à `PUBLIE` directement : elle porte déjà le droit
 * de publier, et lui faire traverser une file l'obligerait à s'auto-approuver,
 * c'est-à-dire à faire semblant.
 *
 * Une agence badgée passe par `BROUILLON → SOUMIS → PUBLIE`. Le badge dit que
 * le compte a été vérifié, pas que sa fiche est juste — et une fiche
 * d'événement collecte des noms, des adresses et des présences à une date.
 *
 * Les deux chemins existent déjà dans `lib/cms/cycle.ts` ; ce qui les sépare
 * n'est pas la machine à états mais la **portée**, et c'est
 * `lib/evenements/acces.ts` qui la calcule. `SOUMIS` et `REFUSE`, longtemps
 * inatteignables ici, ne le sont plus depuis v1.51.0 — la preuve qu'un état
 * non emprunté ne coûte rien, tandis qu'un état manquant coûte une réécriture.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA PORTÉE EST DANS LE `WHERE`, PAS DANS UN `IF`
 *
 * Chaque écriture épingle `organizerId` dans sa clause plutôt que de relire
 * l'événement puis de comparer. Deux raisons : la vérification et l'écriture
 * sont alors le même acte — rien ne peut changer entre les deux — et une
 * requête qui oublie la clause se repère à l'œil nu.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'AUTEUR N'EST PAS UN PARAMÈTRE LIBRE
 *
 * Comme pour Jobs et Services : il est lu de la session par l'action qui
 * appelle ce module. Le recevoir ici suffirait à publier au nom de quelqu'un
 * d'autre — et c'est ce nom qui apparaîtrait à l'audit.
 */

export type Echec =
  | { motif: "REFUS"; refus: Refus }
  /** L'événement n'existe pas, ou plus. */
  | { motif: "INTROUVABLE" }
  /** La machine à états n'autorise pas ce geste depuis cet état. */
  | { motif: "TRANSITION_INTERDITE" }
  /** Annuler demande de dire pourquoi. */
  | { motif: "RAISON_REQUISE" }
  /** Refuser aussi — et ce n'est pas la même raison, ni le même public. */
  | { motif: "MOTIF_REQUIS" }
  /** Déjà annulé — rien à faire, et ce n'est pas une erreur. */
  | { motif: "DEJA_ANNULE" }
  /** Le geste existe, mais pas pour cette portée : publier, refuser. */
  | { motif: "GESTE_RESERVE" };

/**
 * `object` et non `void` comme défaut : `{ ok: true } & void` s'effondre en
 * `never`, et le compilateur refuse alors le succès lui-même — une erreur qui
 * se lit comme un défaut de l'appelant alors qu'elle vient d'ici.
 */
export type Suite<T = object> = ({ ok: true } & T) | ({ ok: false } & Echec);

const RAISON_MIN = 8;
const MOTIF_MIN = 8;

export const MESSAGES_ECHEC: Record<Echec["motif"], string> = {
  REFUS: "",
  INTROUVABLE: "Cet événement n'existe plus.",
  TRANSITION_INTERDITE:
    "Quelqu'un vient de changer l'état de cet événement. Rafraîchis la page.",
  RAISON_REQUISE:
    "Écris pourquoi l'événement est annulé : c'est ce que liront les inscrits.",
  MOTIF_REQUIS:
    "Écris pourquoi tu refuses : c'est la seule chose qu'on pourra montrer à l'organisateur.",
  DEJA_ANNULE: "Cet événement est déjà annulé.",
  GESTE_RESERVE:
    "La mise en ligne revient à l'équipe Baobart. Envoie ta fiche en relecture : on te répond sous 48 h.",
};

/** Crée un événement, en brouillon. */
export async function creer(input: {
  auteurId: string;
  saisie: Saisie;
}): Promise<Suite<{ evenementId: string }>> {
  const verdict = valider(input.saisie);
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  const e = verdict.evenement;

  const cree = await db.event.create({
    data: {
      organizerId: input.auteurId,
      title: e.titre,
      description: e.description,
      kind: e.genre,
      startsAt: e.debut,
      endsAt: e.fin,
      location: e.lieu,
      isOnline: e.enLigne,
      capacity: e.capacite,
      ticketPrice: e.prixBillet,
      prizeAmount: e.dotation,
      // Le schéma le pose déjà, on l'écrit quand même : c'est la ligne qu'on
      // relira le jour où quelqu'un se demandera pourquoi rien ne paraît.
      state: "BROUILLON",
    },
    select: { id: true },
  });

  journal.info("événement créé", { evenement: cree.id, genre: e.genre });

  return { ok: true, evenementId: cree.id };
}

/**
 * Corrige un événement, quel que soit son état.
 *
 * On ne verrouille pas l'édition d'un événement publié ni même terminé : une
 * faute dans une adresse se corrige surtout quand la fiche est en ligne, et
 * une date de concours passée peut demander une précision sur les résultats.
 */
export async function modifier(input: {
  evenementId: string;
  saisie: Saisie;
  portee: Portee;
}): Promise<Suite> {
  const verdict = valider(input.saisie);
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  const e = verdict.evenement;

  const ecrit = await db.event.updateMany({
    // La portée est dans le `WHERE` : une agence qui poste l'identifiant d'un
    // autre événement écrit zéro ligne, et repart avec « introuvable ».
    where: { id: input.evenementId, ...clauseDePortee(input.portee) },
    data: {
      title: e.titre,
      description: e.description,
      kind: e.genre,
      startsAt: e.debut,
      endsAt: e.fin,
      location: e.lieu,
      isOnline: e.enLigne,
      capacity: e.capacite,
      ticketPrice: e.prixBillet,
      prizeAmount: e.dotation,
    },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "INTROUVABLE" };

  return { ok: true };
}

/**
 * Publie, refuse, retire, soumet, ou remet en brouillon.
 *
 * La condition d'état vit dans le `WHERE` : deux personnes peuvent avoir
 * ouvert la même fiche, et seule la première doit trancher. La seconde repart
 * sans rien casser, et sa page se rafraîchira.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN REFUS SANS MOTIF EST INDÉFENDABLE
 *
 * C'est la leçon déjà payée sur Jobs et Services, et elle vaut davantage ici :
 * une agence qui voit sa fiche disparaître n'a **aucun autre canal** pour
 * demander pourquoi — il n'y a pas de messagerie dans le produit (§22.6).
 *
 * Le motif est donc exigé, pas par politesse : c'est la seule trace de ce
 * qu'on a vu, et la seule chose qu'on pourra montrer trois mois plus tard.
 *
 * Il est effacé sur toute décision AUTRE qu'un refus. Garder l'ancien ferait
 * afficher « refusée pour X » sur une fiche finalement publiée — le genre de
 * détail qui fait douter de tout l'écran.
 */
export async function trancher(input: {
  evenementId: string;
  geste: Geste;
  acteurId: string;
  portee: Portee;
  /** Exigé sur `refuser`, ignoré partout ailleurs. */
  motif?: string;
}): Promise<Suite<{ vers: string }>> {
  // Le droit AU GESTE d'abord, avant même de savoir si l'événement existe.
  //
  // L'ordre n'est pas indifférent : tester l'existence en premier apprendrait,
  // par la différence entre « introuvable » et « réservé », lesquels des
  // identifiants essayés correspondent à de vrais événements.
  if (!gestePermis(input.portee, input.geste)) {
    return { ok: false, motif: "GESTE_RESERVE" };
  }

  const evenement = await db.event.findFirst({
    where: { id: input.evenementId, ...clauseDePortee(input.portee) },
    select: { id: true, state: true, title: true },
  });

  if (!evenement) return { ok: false, motif: "INTROUVABLE" };

  const transition = appliquer(evenement.state, input.geste);
  if (!transition.ok) return { ok: false, motif: "TRANSITION_INTERDITE" };

  const motif = (input.motif ?? "").trim();
  if (input.geste === "refuser" && motif.length < MOTIF_MIN) {
    return { ok: false, motif: "MOTIF_REQUIS" };
  }

  const ecrit = await db.event.updateMany({
    where: {
      id: evenement.id,
      state: evenement.state,
      ...clauseDePortee(input.portee),
    },
    data: {
      state: transition.vers,
      refusedReason: input.geste === "refuser" ? motif : null,
      // ────────────────────────────────────────────────────────────────────
      // LA TRACE DE RELECTURE NE SE POSE QUE SUR UN VERDICT
      //
      // `publier` et `refuser` sont les deux issues d'une relecture. Les
      // autres gestes n'en sont pas : `soumettre` et `reprendre` sont ceux de
      // l'AUTEUR sur sa propre fiche, et `retirer` est un dépublication que
      // l'audit consigne déjà.
      //
      // Les poser partout, comme la première version le faisait, faisait
      // apparaître « relu le… » à la seconde même où l'organisateur envoyait
      // sa fiche — en le nommant relecteur de son propre travail. C'est un
      // test d'intégration qui l'a montré, pas une relecture de code.
      ...(input.geste === "publier" || input.geste === "refuser"
        ? { moderatedAt: new Date(), moderatorId: input.acteurId }
        : {}),
    },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "TRANSITION_INTERDITE" };

  // Consigné après l'acte, et seulement s'il a eu lieu.
  await consigner({
    acteurId: input.acteurId,
    action:
      input.geste === "publier"
        ? "contenu.publier"
        : input.geste === "refuser"
          ? "contenu.refuser"
          : "contenu.retirer",
    ressource: ressource("evenement", evenement.id),
    details: {
      de: evenement.state,
      vers: transition.vers,
      titre: evenement.title,
      ...(motif ? { motif } : {}),
    },
  });

  journal.info("événement tranché", {
    evenement: evenement.id,
    de: evenement.state,
    vers: transition.vers,
  });

  return { ok: true, vers: transition.vers };
}

/**
 * Annule un événement — sans le faire disparaître.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL RESTE VISIBLE, ET C'EST TOUT L'INTÉRÊT
 *
 * Les inscrits ont noté la date, prévu un déplacement, peut-être payé un
 * billet. Les envoyer sur une page absente les laisserait chercher — et
 * écrire, un par un. La fiche reste donc en ligne, marquée annulée, avec la
 * raison.
 *
 * C'est pourquoi ce n'est pas un `retirer` : `RETIRE` est pour ce qui
 * n'aurait pas dû paraître, `cancelledAt` pour ce qui n'aura pas lieu.
 */
export async function annuler(input: {
  evenementId: string;
  raison: string;
  acteurId: string;
  portee: Portee;
}): Promise<Suite> {
  const raison = input.raison.trim();
  if (raison.length < RAISON_MIN) return { ok: false, motif: "RAISON_REQUISE" };

  // Annuler n'est pas dans `GESTES_ORGANISATEUR` : ce n'est pas une transition
  // de la machine à états, c'est une date posée sur la ligne. Un organisateur
  // annule donc le sien — c'est même le geste pour lequel il a le moins de
  // temps à perdre à demander la permission.
  const evenement = await db.event.findFirst({
    where: { id: input.evenementId, ...clauseDePortee(input.portee) },
    select: { id: true, title: true, cancelledAt: true },
  });

  if (!evenement) return { ok: false, motif: "INTROUVABLE" };
  if (evenement.cancelledAt !== null) return { ok: false, motif: "DEJA_ANNULE" };

  // `cancelledAt: null` dans le WHERE : deux annulations simultanées ne
  // doivent pas écraser la première raison par la seconde.
  const ecrit = await db.event.updateMany({
    where: {
      id: evenement.id,
      cancelledAt: null,
      ...clauseDePortee(input.portee),
    },
    data: { cancelledAt: new Date(), cancelReason: raison },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "DEJA_ANNULE" };

  await consigner({
    acteurId: input.acteurId,
    action: "contenu.retirer",
    ressource: ressource("evenement", evenement.id),
    details: { geste: "annulation", titre: evenement.title, raison },
  });

  journal.info("événement annulé", { evenement: evenement.id });

  return { ok: true };
}

/**
 * Lève une annulation.
 *
 * Une annulation posée par erreur se répare — et la raison s'efface avec elle,
 * sans quoi la fiche afficherait « annulé pour X » sur un événement qui a bien
 * lieu. L'audit garde les deux gestes.
 */
export async function retablir(input: {
  evenementId: string;
  acteurId: string;
  portee: Portee;
}): Promise<Suite> {
  const ecrit = await db.event.updateMany({
    where: {
      id: input.evenementId,
      cancelledAt: { not: null },
      ...clauseDePortee(input.portee),
    },
    data: { cancelledAt: null, cancelReason: null },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "INTROUVABLE" };

  await consigner({
    acteurId: input.acteurId,
    action: "contenu.publier",
    ressource: ressource("evenement", input.evenementId),
    details: { geste: "annulation levée" },
  });

  return { ok: true };
}
