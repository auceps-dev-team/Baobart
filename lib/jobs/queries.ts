import "server-only";

import { estExpire, estPublic } from "@/lib/cms/cycle";
import { db } from "@/lib/db";
import type { JobMode, JobType } from "@/lib/jobs/enums";

/**
 * Ce que le public voit des offres d'emploi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE SEULE CLAUSE DE VISIBILITÉ, ET ELLE VIT ICI
 *
 * Voir une offre ne demande rien : ni compte, ni abonnement. Agir en demande un
 * (§18.2 de la spec admin). C'est la seule asymétrie de Jobs, et elle rend ce
 * module d'autant plus sensible : tout ce qui en sort est lu par n'importe qui.
 *
 * Deux conditions, jamais séparées :
 *
 *   — l'état vaut `PUBLIE`. Une offre en relecture ne doit pas fuir ;
 *   — l'échéance n'est pas passée. Une offre périmée n'aide personne, et un
 *     annuaire de fantômes se vide de ses lecteurs plus vite qu'il ne se
 *     remplit.
 *
 * Elles sont écrites **ensemble**, dans `clausePublique`. Les recopier à la
 * main dans chaque requête est exactement ce qui, un jour, laissera passer
 * l'une sans l'autre.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE LA MAQUETTE DESSINE ET QUE LE MODÈLE NE PORTE PAS
 *
 * `Baobart Accueil.dc.html` montre, sur la fiche : un nombre de propositions
 * avec sa jauge, « le client répond en moyenne sous 6 h », une liste de
 * livrables et une liste de compétences.
 *
 *   — **les propositions** arrivent avec J5. Tant qu'aucune candidature ne peut
 *     exister, afficher « 12 propositions » serait inventer un chiffre sur
 *     lequel un candidat décide de postuler ou non ;
 *   — **le délai de réponse** ne se mesure nulle part, et vient d'être
 *     abandonné sur le profil créateur pour la même raison. Le garder ici
 *     serait rétablir par la fenêtre ce qu'on a retiré par la porte ;
 *   — **livrables et compétences** ne sont pas des champs. La description les
 *     porte en prose. Les structurer demande de les collecter au dépôt, ce qui
 *     appartient à J2, pas à la lecture publique.
 *
 * Le relevé est dans `Doc/MAQUETTES_A_FAIRE.md`.
 */

/** Nouvelle depuis moins de trois jours. La maquette pose une pastille dessus. */
const NOUVEAUTE_MS = 3 * 86_400_000;

export interface OffreEnListe {
  id: string;
  titre: string;
  type: JobType;
  mode: JobMode;
  ville: string | null;
  pays: string | null;
  salaireMin: number | null;
  salaireMax: number | null;
  devise: string;
  /** Les premières lignes, pas le texte entier : une liste se parcourt. */
  extrait: string;
  publieeLe: Date;
  echeance: Date | null;
  nouvelle: boolean;
  verifiee: boolean;
  miseEnAvant: boolean;
}

/**
 * La clause que toute lecture publique doit porter.
 *
 * Elle prend `maintenant` en paramètre pour que la même seconde serve à la
 * requête et à l'affichage : sans cela, une offre pourrait passer le filtre puis
 * s'afficher « expirée » deux millisecondes plus tard.
 */
function clausePublique(maintenant: Date) {
  return {
    state: "PUBLIE" as const,
    OR: [{ deadline: null }, { deadline: { gt: maintenant } }],
  };
}

/**
 * Les offres visibles.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LES MISES EN AVANT D'ABORD, PUIS LES PLUS RÉCENTES
 *
 * `isFeatured` est une place payante (§2.9 de la spec). Elle passe devant, et
 * c'est assumé — mais elle ne remplace pas le tri : à égalité, c'est la
 * fraîcheur qui décide. Un annuaire où l'argent seul ordonne cesse d'être
 * consulté, et la place payante ne vaut alors plus rien.
 */
export async function listerOffres(input: {
  type?: JobType;
  limite?: number;
  maintenant?: Date;
} = {}): Promise<OffreEnListe[]> {
  const maintenant = input.maintenant ?? new Date();

  const lignes = await db.jobPosting.findMany({
    where: {
      ...clausePublique(maintenant),
      ...(input.type ? { type: input.type } : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: Math.min(input.limite ?? 40, 100),
    select: {
      id: true,
      title: true,
      type: true,
      mode: true,
      city: true,
      country: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
      description: true,
      createdAt: true,
      deadline: true,
      isVerified: true,
      isFeatured: true,
    },
  });

  return lignes.map((o) => ({
    id: o.id,
    titre: o.title,
    type: o.type as JobType,
    mode: o.mode as JobMode,
    ville: o.city,
    pays: o.country,
    salaireMin: o.salaryMin,
    salaireMax: o.salaryMax,
    devise: o.currency,
    extrait: o.description.slice(0, 220),
    publieeLe: o.createdAt,
    echeance: o.deadline,
    nouvelle: maintenant.getTime() - o.createdAt.getTime() < NOUVEAUTE_MS,
    verifiee: o.isVerified,
    miseEnAvant: o.isFeatured,
  }));
}

export interface OffreComplete extends OffreEnListe {
  description: string;
  /** « BAOBART » ou « EXTERNE ». Décide de ce que fait le bouton. */
  commentPostuler: string;
  /** L'adresse externe, quand il y en a une. */
  urlExterne: string | null;
  recruteur: string;
  recruteurUsername: string | null;
}

/**
 * Une offre, si elle est visible.
 *
 * Rend `null` pour tout le reste — en relecture, refusée, retirée, expirée. Un
 * identifiant se devine mal, mais il se partage : un lien envoyé avant le
 * refus ne doit pas continuer de montrer l'offre.
 */
export async function offrePublique(
  id: string,
  maintenant = new Date(),
): Promise<OffreComplete | null> {
  const o = await db.jobPosting.findFirst({
    where: { id, ...clausePublique(maintenant) },
    select: {
      id: true,
      title: true,
      type: true,
      mode: true,
      city: true,
      country: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
      description: true,
      createdAt: true,
      deadline: true,
      isVerified: true,
      isFeatured: true,
      // Relu alors que la clause l'a déjà filtré : c'est ce qui permet la
      // vérification ci-dessous, et une colonne de plus coûte moins qu'une
      // offre en relecture affichée au public.
      state: true,
      applyMode: true,
      applyUrl: true,
      recruiter: {
        select: {
          email: true,
          profile: { select: { displayName: true, username: true } },
        },
      },
    },
  });

  if (!o) return null;

  // Ceinture et bretelles. La clause a déjà filtré ; cette ligne rejoue la
  // même règle depuis la seule fonction qui en fait autorité. Le jour où
  // quelqu'un modifiera la clause SQL sans y penser, c'est elle qui tiendra.
  if (!estPublic(o.state, o.deadline, maintenant)) return null;

  return {
    id: o.id,
    titre: o.title,
    type: o.type as JobType,
    mode: o.mode as JobMode,
    ville: o.city,
    pays: o.country,
    salaireMin: o.salaryMin,
    salaireMax: o.salaryMax,
    devise: o.currency,
    extrait: o.description.slice(0, 220),
    description: o.description,
    publieeLe: o.createdAt,
    echeance: o.deadline,
    nouvelle: maintenant.getTime() - o.createdAt.getTime() < NOUVEAUTE_MS,
    verifiee: o.isVerified,
    miseEnAvant: o.isFeatured,
    commentPostuler: o.applyMode,
    urlExterne: o.applyUrl,
    recruteur: o.recruiter.profile?.displayName ?? o.recruiter.email,
    recruteurUsername: o.recruiter.profile?.username ?? null,
  };
}

/** Combien de jours avant la clôture. `null` quand il n'y a pas d'échéance. */
export function joursAvantCloture(
  echeance: Date | null,
  maintenant = new Date(),
): number | null {
  if (!echeance || estExpire(echeance, maintenant)) return null;
  return Math.ceil((echeance.getTime() - maintenant.getTime()) / 86_400_000);
}
