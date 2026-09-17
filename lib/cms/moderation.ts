import "server-only";

import type { RolePlateforme } from "@/lib/auth/administration";
import { typesRelusPar, type TypeDeContenu } from "@/lib/cms/droits";
import { db } from "@/lib/db";
import { LIBELLE_GENRE, type EventKind } from "@/lib/evenements/enums";

/**
 * La file de relecture, tous contenus confondus.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE FILE, PAS QUATRE
 *
 * La tentation est d'écrire un écran par CMS : ce sont quatre listes avec deux
 * boutons. Quatre écrans jumeaux divergent — et le jour où l'un oublie d'écrire
 * le motif de refus, ce sera celui qu'on relit le moins.
 *
 * Surtout, un modérateur ne travaille pas par type. Il ouvre sa file le matin
 * et la vide. Lui demander de visiter quatre pages pour savoir s'il lui reste
 * quelque chose garantit qu'il en oubliera une.
 *
 * Jobs, Services et Événements l'alimentent, mélangés à l'écran — un
 * modérateur ne travaille pas par type mais par ancienneté.
 *
 * Les événements y sont entrés en v1.51.1. Ce commentaire disait qu'ils n'y
 * entreraient « jamais », et c'était exact tant que leur auteur portait déjà
 * le droit de publier (§18.1). Depuis que les agences badgées en écrivent
 * (§25), une fiche d'événement attend une relecture comme une offre d'emploi.
 *
 * Le blog les a rejoints en v1.53.0. Sa relecture n'est pas obligatoire —
 * §18.1 dit que son auteur porte déjà le droit de publier — mais elle est
 * **offerte** : un rédacteur qui veut un second regard soumet son article, et
 * il doit alors atterrir quelque part.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE NE MONTRE QUE CE QU'ON PEUT TRANCHER
 *
 * Les trois types n'exigent pas le même pouvoir : Jobs et Services demandent
 * `moderer_le_contenu`, les événements `publier_du_contenu` — parce que qui
 * relit un événement est qui le met en ligne.
 *
 * Un modérateur verrait donc des fiches sur lesquelles ses boutons
 * échoueraient ; un éditorial, des offres qui ne le regardent pas. La file
 * filtre donc **par pouvoir**, en relisant `pouvoirDeModeration` plutôt qu'en
 * rangeant la correspondance une seconde fois.
 *
 * C'est la même règle qu'en v1.48.8 pour le menu : ne jamais promettre un
 * écran — ici un bouton — qui répondra non.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE NE DÉCIDE RIEN
 *
 * Elle lit. Trancher vit dans le module de chaque contenu, parce que chacun a
 * ses conséquences propres — une offre refusée prévient son auteur, un service
 * refusé ne fait pas la même chose.
 */

export interface ElementAModerer {
  type: TypeDeContenu;
  id: string;
  titre: string;
  /** Un aperçu, pas le texte entier : la file se parcourt, elle ne se lit pas. */
  extrait: string;
  auteur: string;
  auteurId: string;
  /** Depuis quand il attend. C'est ce qui décide de l'ordre. */
  soumisLe: Date;
  /**
   * L'adresse externe, quand il y en a une (Jobs uniquement).
   *
   * ⚠️ Elle est rendue **entière**. Une URL tronquée dans une file de
   * modération est une URL qu'on approuve sans l'avoir lue — et c'est
   * exactement le vecteur d'arnaque qu'on cherche à arrêter.
   */
  urlExterne: string | null;
  /**
   * Déjà marqué « vérifié » ? Le badge se pose et se retire (Jobs uniquement).
   * Toujours `false` pour un service — il n'y a pas de badge de fiche.
   */
  verifie: boolean;
  /**
   * Ce qu'on montre en plus de l'extrait, propre au type. Pour un service :
   * la catégorie, le prix, le délai — ce dont on ne peut pas juger sans.
   */
  meta?: string;
}

/**
 * Ce qui attend une décision, du plus ancien au plus récent.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE PLUS ANCIEN D'ABORD, ET C'EST L'INVERSE DE PARTOUT AILLEURS
 *
 * Un journal se lit du plus récent ; une file d'attente se vide du plus ancien.
 * Trier à l'envers ferait vieillir indéfiniment les offres du bas pendant que
 * les nouvelles passent devant — et l'annonceur le plus patient serait le plus
 * mal servi.
 */
export async function fileDeModeration(
  role: RolePlateforme,
  limite = 50,
): Promise<ElementAModerer[]> {
  const types = new Set(typesRelusPar(role));
  // ── Sélection : on prend deux fois `limite` pour équilibrer la fusion.
  // Après tri par date, on tronque à `limite`. Doubler évite qu'un afflux
  // récent d'un type ne masque tout ce qui attend depuis longtemps sur
  // l'autre.
  const cap = Math.min(limite, 200);

  const [offres, services, articles, evenements] = await Promise.all([
    !types.has("job") ? [] : db.jobPosting.findMany({
      where: { state: "SOUMIS" },
      orderBy: { createdAt: "asc" },
      take: cap,
      select: {
        id: true,
        title: true,
        description: true,
        applyUrl: true,
        isVerified: true,
        createdAt: true,
        recruiterId: true,
        recruiter: {
          select: { email: true, profile: { select: { displayName: true } } },
        },
      },
    }),
    !types.has("service") ? [] : db.serviceOffer.findMany({
      where: { state: "SOUMIS" },
      orderBy: { createdAt: "asc" },
      take: cap,
      select: {
        id: true,
        title: true,
        description: true,
        startingPrice: true,
        currency: true,
        deliveryDays: true,
        createdAt: true,
        creatorId: true,
        category: { select: { name: true } },
        creator: {
          select: { email: true, profile: { select: { displayName: true } } },
        },
      },
    }),
    !types.has("article") ? [] : db.blogPost.findMany({
      where: { state: "SOUMIS" },
      orderBy: { createdAt: "asc" },
      take: cap,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        authorId: true,
        category: { select: { name: true } },
        author: {
          select: { email: true, profile: { select: { displayName: true } } },
        },
      },
    }),
    !types.has("evenement") ? [] : db.event.findMany({
      where: { state: "SOUMIS" },
      orderBy: { createdAt: "asc" },
      take: cap,
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        startsAt: true,
        location: true,
        isOnline: true,
        capacity: true,
        createdAt: true,
        organizerId: true,
        organizer: {
          select: { email: true, profile: { select: { displayName: true } } },
        },
      },
    }),
  ]);

  const elements: ElementAModerer[] = [
    ...offres.map((o) => ({
      type: "job" as const,
      id: o.id,
      titre: o.title,
      extrait: o.description.slice(0, 280),
      auteur: o.recruiter.profile?.displayName ?? o.recruiter.email,
      auteurId: o.recruiterId,
      soumisLe: o.createdAt,
      urlExterne: o.applyUrl,
      verifie: o.isVerified,
    })),
    ...services.map((s) => ({
      type: "service" as const,
      id: s.id,
      titre: s.title,
      extrait: s.description.slice(0, 280),
      auteur: s.creator.profile?.displayName ?? s.creator.email,
      auteurId: s.creatorId,
      soumisLe: s.createdAt,
      // Un service ne porte pas d'URL externe : la commande passe par un
      // `mailto:` sur l'adresse publique du créateur.
      urlExterne: null,
      verifie: false,
      // Ce qui aide à trancher sur un service : catégorie, prix, délai.
      // Le modérateur ne peut pas juger d'un prix « aberrant » sans le voir.
      meta: `${s.category.name} · ${s.startingPrice.toLocaleString("fr-FR")} ${s.currency} · ${s.deliveryDays} j`,
    })),
    ...articles.map((a) => ({
      type: "article" as const,
      id: a.id,
      titre: a.title,
      extrait: a.body.slice(0, 280),
      auteur: a.author.profile?.displayName ?? a.author.email,
      auteurId: a.authorId,
      soumisLe: a.createdAt,
      // Un article ne renvoie nulle part : il se lit sur Baobart.
      urlExterne: null,
      verifie: false,
      meta: a.category
        ? `${a.category.name} · ${a.body.length} signes`
        : `${a.body.length} signes`,
    })),
    ...evenements.map((e) => ({
      type: "evenement" as const,
      id: e.id,
      titre: e.title,
      extrait: e.description.slice(0, 280),
      auteur: e.organizer.profile?.displayName ?? e.organizer.email,
      auteurId: e.organizerId,
      soumisLe: e.createdAt,
      // Pas d'adresse externe : on s'inscrit sur Baobart, pas ailleurs.
      urlExterne: null,
      verifie: false,
      // Ce dont on ne peut pas juger sans : quand, où, combien de places. Une
      // date passée ou un lieu absent se voient d'un coup d'œil, et ce sont
      // les deux motifs de refus les plus fréquents.
      meta: [
        LIBELLE_GENRE[e.kind as EventKind],
        e.startsAt.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
        e.isOnline ? "en ligne" : (e.location ?? "lieu non précisé"),
        e.capacity === null ? "sans plafond" : `${e.capacity} places`,
      ].join(" · "),
    })),
  ];

  // Le plus ancien d'abord — l'invariant partagé de la file.
  elements.sort((a, b) => a.soumisLe.getTime() - b.soumisLe.getTime());
  return elements.slice(0, cap);
}

/**
 * Combien attendent, pour la pastille du menu.
 *
 * Séparé de la lecture : afficher un compteur ne doit pas charger cinquante
 * descriptions sur chaque page du tableau de bord.
 */
export async function combienAttendent(role: RolePlateforme): Promise<number> {
  const types = new Set(typesRelusPar(role));

  const [j, s, a, e] = await Promise.all([
    !types.has("job") ? 0 : db.jobPosting.count({ where: { state: "SOUMIS" } }),
    !types.has("service")
      ? 0
      : db.serviceOffer.count({ where: { state: "SOUMIS" } }),
    !types.has("article")
      ? 0
      : db.blogPost.count({ where: { state: "SOUMIS" } }),
    !types.has("evenement")
      ? 0
      : db.event.count({ where: { state: "SOUMIS" } }),
  ]);
  return j + s + a + e;
}
