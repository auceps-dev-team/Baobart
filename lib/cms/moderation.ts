import "server-only";

import { db } from "@/lib/db";
import type { TypeDeContenu } from "@/lib/cms/droits";

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
 * Jobs et Services alimentent cette file, mélangés à l'écran — un modérateur
 * ne travaille pas par type mais par ancienneté. Blog et événements n'y
 * entreront **jamais** : leur auteur portait déjà le droit de publier
 * (§18.1), et une file où rien n'arrive est un écran qu'on cesse d'ouvrir.
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
export async function fileDeModeration(limite = 50): Promise<ElementAModerer[]> {
  // ── Sélection : on prend deux fois `limite` pour équilibrer la fusion.
  // Après tri par date, on tronque à `limite`. Doubler évite qu'un afflux
  // récent d'un type ne masque tout ce qui attend depuis longtemps sur
  // l'autre.
  const cap = Math.min(limite, 200);

  const [offres, services] = await Promise.all([
    db.jobPosting.findMany({
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
    db.serviceOffer.findMany({
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
export async function combienAttendent(): Promise<number> {
  const [j, s] = await Promise.all([
    db.jobPosting.count({ where: { state: "SOUMIS" } }),
    db.serviceOffer.count({ where: { state: "SOUMIS" } }),
  ]);
  return j + s;
}
