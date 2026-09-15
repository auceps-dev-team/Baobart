import "server-only";

import { db } from "@/lib/db";
import { notifier } from "@/lib/notifications/aiguilleur";
import { journal } from "@/lib/observabilite/journal";
import { peutSInscrire, type RefusInscription } from "@/lib/evenements/phases";

/**
 * S'inscrire à un événement, et s'en retirer.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA DERNIÈRE PLACE NE SE DONNE PAS DEUX FOIS
 *
 * C'est tout le problème de ce fichier, et il ne se voit pas en lisant le
 * code naïf. Deux personnes ouvrent la fiche au même instant, il reste une
 * place, les deux cliquent :
 *
 *     A lit participantsCount = 49, capacity = 50  → il reste une place
 *     B lit participantsCount = 49, capacity = 50  → il reste une place
 *     A écrit 50, B écrit 50
 *
 * Deux inscrits pour une place, et le compteur affiche 50 au lieu de 51 : on
 * ne s'en aperçoit même pas. Vérifier avant d'écrire ne suffit **jamais** —
 * entre la lecture et l'écriture, le monde a changé.
 *
 * La réservation se fait donc en **une seule instruction**, où la condition et
 * l'incrément sont indissociables :
 *
 *     UPDATE event SET participantsCount = participantsCount + 1
 *     WHERE id = … AND (capacity IS NULL OR participantsCount < capacity)
 *
 * PostgreSQL sérialise les écritures sur une même ligne : le second `UPDATE`
 * attend le premier, relit la valeur à jour, et sa condition devient fausse.
 * Le nombre de lignes touchées dit alors si la place a été prise — zéro
 * signifie « complet », et c'est une réponse, pas une supposition.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON COMPENSE PLUTÔT QU'ON N'ENVELOPPE
 *
 * La réservation ci-dessus est déjà sûre **à elle seule** : c'est une
 * instruction unique, et PostgreSQL ne la coupe pas en deux. Reste le cas où
 * la ligne d'inscription échoue après coup — un double-clic que l'unicité
 * refuse — et où la place doit repartir au pot commun.
 *
 * On aurait pu envelopper les deux écritures dans `$transaction`. On ne le
 * fait pas, pour une raison qui s'est vue à l'usage : une transaction
 * interactive **retient une connexion** du pool pendant toute sa durée, et le
 * seul moyen de l'annuler est d'y lever une exception. Utiliser une exception
 * pour dire « c'est complet » — un cas parfaitement normal — faisait tenir des
 * connexions pour un flux ordinaire, jusqu'à épuiser le pool sous
 * concurrence.
 *
 * La place se rend donc par une écriture de compensation explicite, en clair
 * dans le code. Le prix : si le processus meurt **entre** la réservation et
 * l'inscription, une place reste retenue sans occupant. C'est rare, sans
 * gravité — une place de trop sur un atelier — et cela se corrige en
 * recomptant les lignes. Une connexion épuisée, elle, bloque tout le monde.
 */

export type Suite =
  | { ok: true }
  | { ok: false; motif: RefusInscription };

/** Les faits nécessaires pour décider, lus en une fois. */
async function etatPour(evenementId: string, userId: string) {
  const [evenement, dejaInscrit] = await Promise.all([
    db.event.findUnique({
      where: { id: evenementId },
      select: {
        id: true,
        state: true,
        cancelledAt: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        participantsCount: true,
        ticketPrice: true,
        // Pour prévenir celui qui organise, une fois l'inscription écrite.
        organizerId: true,
        title: true,
      },
    }),
    db.eventRegistration.findUnique({
      where: { eventId_userId: { eventId: evenementId, userId } },
      select: { id: true },
    }),
  ]);

  return { evenement, dejaInscrit: dejaInscrit !== null };
}

/**
 * Inscrit quelqu'un, si la porte est ouverte.
 *
 * Les règles vivent dans `peutSInscrire` — pur, éprouvé sans base. Ce module
 * ne fait que les appliquer, puis écrire de façon sûre.
 */
export async function inscrire(input: {
  evenementId: string;
  userId: string;
  maintenant?: Date;
}): Promise<Suite> {
  const maintenant = input.maintenant ?? new Date();
  const { evenement, dejaInscrit } = await etatPour(input.evenementId, input.userId);

  if (!evenement) return { ok: false, motif: "INTROUVABLE" };

  const verdict = peutSInscrire(
    {
      etat: evenement.state,
      annuleLe: evenement.cancelledAt,
      debut: evenement.startsAt,
      fin: evenement.endsAt,
      capacite: evenement.capacity,
      inscrits: evenement.participantsCount,
      dejaInscrit,
    },
    maintenant,
  );

  if (!verdict.ok) return verdict;

  // Un billet payant reste fermé tant que l'encaissement n'est pas branché.
  // Donner des places sans les faire payer serait pire que ne pas en donner —
  // et l'écran d'administration l'annonce depuis E2.
  if (evenement.ticketPrice !== null && evenement.ticketPrice > 0) {
    return { ok: false, motif: "INTROUVABLE" };
  }

  // 1. Réserver. La condition et l'incrément sont indissociables — voir
  //    l'en-tête. Zéro ligne touchée veut dire « complet », et c'est une
  //    réponse, pas une supposition.
  const places = await db.$executeRaw`
    UPDATE "Event"
    SET "participantsCount" = "participantsCount" + 1
    WHERE "id" = ${evenement.id}
      AND "state" = 'PUBLIE'
      AND "cancelledAt" IS NULL
      AND ("capacity" IS NULL OR "participantsCount" < "capacity")
  `;

  if (places !== 1) return { ok: false, motif: "COMPLET" };

  // 2. Écrire l'inscription. À partir d'ici, une place est retenue : tout
  //    chemin qui n'aboutit pas doit la rendre.
  try {
    await db.eventRegistration.create({
      data: { eventId: evenement.id, userId: input.userId },
    });
  } catch (cause) {
    await rendreLaPlace(evenement.id);

    // L'unicité a parlé : quelqu'un a cliqué deux fois entre notre lecture et
    // maintenant. La place vient d'être rendue.
    if (estCollisionUnique(cause)) return { ok: false, motif: "DEJA_INSCRIT" };

    throw cause;
  }

  journal.info("inscription à un événement", {
    evenement: evenement.id,
    capacite: evenement.capacity,
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PRÉVENIR L'ORGANISATEUR — EN IN-APP SEULEMENT, PAR DÉFAUT
  //
  // C'est l'événement le plus fréquent du catalogue : un atelier de cent
  // places, ce sont cent avis. Son défaut courriel est donc à `false` — cent
  // courriels en un après-midi font marquer l'expéditeur comme indésirable, et
  // ce qu'on perd ensuite, ce sont les reçus d'achat.
  //
  // Qui veut quand même le courriel peut l'allumer : c'est tout l'intérêt
  // d'une préférence par couple plutôt que d'un interrupteur global.
  //
  // HORS TRANSACTION, et volontairement : l'inscription n'en a pas. Elle
  // tient par un verrou de capacité atomique suivi d'une compensation
  // explicite (voir l'en-tête). Un avis qui échoue ne doit surtout pas
  // déclencher cette compensation — la place est bien prise.
  await notifier({
    destinataireId: evenement.organizerId,
    evenement: "INSCRIPTION_EVENEMENT",
    cle: `inscription-${evenement.id}-${input.userId}`,
    titre: `Nouvelle inscription — ${evenement.title}`,
    corps:
      evenement.capacity === null
        ? "Quelqu'un vient de s'inscrire."
        : `Quelqu'un vient de s'inscrire. Il reste ${Math.max(0, evenement.capacity - evenement.participantsCount - 1)} place(s).`,
    lien: `/dashboard/evenements/${evenement.id}/inscrits`,
    charge: { titre: evenement.title },
  });

  return { ok: true };
}

/**
 * Retire une inscription, et rend la place.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA LIGNE EST EFFACÉE, PAS MARQUÉE
 *
 * §24.6 : une colonne d'état aurait buté sur l'unicité `(eventId, userId)` et
 * empêché de se réinscrire après s'être désisté. La présence de la ligne fait
 * foi.
 */
export async function desinscrire(input: {
  evenementId: string;
  userId: string;
}): Promise<Suite> {
  // La suppression d'abord : c'est elle qui dit s'il y avait quelque chose à
  // rendre. Décrémenter en premier ferait perdre une place à chaque clic sur
  // un bouton qu'on a déjà utilisé.
  const efface = await db.eventRegistration.deleteMany({
    where: { eventId: input.evenementId, userId: input.userId },
  });

  if (efface.count !== 1) return { ok: false, motif: "INTROUVABLE" };

  await rendreLaPlace(input.evenementId);

  return { ok: true };
}

/**
 * Rend une place au pot commun.
 *
 * `GREATEST(0, …)` : un compteur désynchronisé — reprise de données, écriture
 * manuelle — rendrait sinon un nombre négatif que la fiche afficherait tel
 * quel. On préfère un compteur faux vers le haut qu'un « -1 inscrit ».
 */
async function rendreLaPlace(evenementId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "Event"
    SET "participantsCount" = GREATEST(0, "participantsCount" - 1)
    WHERE "id" = ${evenementId}
  `;
}

/** Cette personne est-elle inscrite ? Pour l'affichage de la fiche. */
export async function estInscrit(
  evenementId: string,
  userId: string,
): Promise<boolean> {
  const ligne = await db.eventRegistration.findUnique({
    where: { eventId_userId: { eventId: evenementId, userId } },
    select: { id: true },
  });
  return ligne !== null;
}

function estCollisionUnique(erreur: unknown): boolean {
  return (
    typeof erreur === "object" &&
    erreur !== null &&
    "code" in erreur &&
    (erreur as { code?: string }).code === "P2002"
  );
}
