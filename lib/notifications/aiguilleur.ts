import "server-only";

import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { journal } from "@/lib/observabilite/journal";

import {
  CATALOGUE,
  canauxPour,
  type Canal,
  type EvenementNotifiable,
} from "@/lib/notifications/catalogue";
import { lirePreferences } from "@/lib/notifications/preferences";

/**
 * Ce dont l'aiguilleur a besoin, et rien de plus.
 *
 * Un `Pick` plutôt que `typeof db` : la signature dit exactement quelles
 * tables sont touchées, et un client de transaction — qui n'expose pas
 * `$transaction` — la satisfait.
 */
export type ClientNotifications = Pick<
  typeof db,
  "user" | "notification" | "notificationPreference" | "emailOutbox"
>;

/**
 * La porte unique par où passe tout ce qu'on annonce à quelqu'un.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI UNE PORTE UNIQUE
 *
 * Avant, chaque module décidait seul d'envoyer un courriel. Ce n'était pas une
 * politique de notification, c'était une collection d'oublis : le reçu d'achat
 * partait, la fiche refusée ne disait rien, la vente ne se savait qu'en ouvrant
 * son tableau de bord.
 *
 * Un appelant dit désormais **ce qui s'est passé**, pas comment le livrer.
 * L'aiguilleur lit les préférences, consulte le catalogue, et écrit sur chaque
 * canal ouvert. Ajouter un canal ne demande de retoucher aucun appelant.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL NE LÈVE JAMAIS
 *
 * C'est la propriété la plus importante du fichier, et elle est facile à
 * perdre. Prévenir quelqu'un d'une vente est une conséquence de la vente, pas
 * une condition : si la notification échoue, la vente reste faite.
 *
 * Faire remonter l'erreur ferait échouer l'acte lui-même — un webhook de
 * paiement qui répond 500 parce que la cloche n'a pas sonné est un paiement
 * que l'opérateur rejouera, encore et encore.
 *
 * Tout échec se journalise et s'arrête là. C'est la même règle que
 * `lib/admin/audit.ts`, et pour la même raison.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'IDEMPOTENCE VIENT DE L'APPELANT
 *
 * `cle` est dérivée du fait — « vente-<orderItemId> », « refus-<eventId> » — et
 * jamais d'un hasard. Un webhook rejoué par l'opérateur retombe sur la même
 * clé et se fait refuser, plutôt que de poser une seconde ligne dans la cloche
 * de quelqu'un.
 *
 * Les deux canaux la portent : `Notification.cle` est unique, et `EmailOutbox`
 * l'exigeait déjà. On la suffixe par canal pour que le courriel et l'in-app ne
 * se marchent pas dessus.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL SAIT ENTRER DANS UNE TRANSACTION
 *
 * C'est ce qui manquait à la première version, et cela l'empêchait de servir
 * là où elle est le plus utile.
 *
 * Un reçu d'achat s'écrit **dans la transaction du paiement** — c'est la règle
 * posée sur `EmailOutbox` : « un message part après la transaction qui le
 * justifie. S'il partait pendant, une commande annulée aurait déjà envoyé son
 * reçu ; s'il partait avant, une panne d'expéditeur ferait échouer la
 * commande. »
 *
 * Un aiguilleur qui ouvre ses propres connexions casse cette garantie : entre
 * le `COMMIT` du paiement et l'écriture de l'avis, le processus peut mourir, et
 * l'acheteur ne reçoit jamais son reçu d'un paiement bien encaissé.
 *
 * `notifier(avis, tx)` écrit donc les deux canaux avec le client qu'on lui
 * donne. Sans second argument, il prend le client global — le cas des avis qui
 * suivent un fait déjà écrit, comme un refus de publication.
 */

export interface Avis {
  /** Qui est prévenu. */
  destinataireId: string;
  evenement: EvenementNotifiable;
  /**
   * Dérivée du fait qui justifie l'avis, jamais tirée au sort.
   * Par exemple `vente-<orderItemId>` ou `refus-evenement-<id>`.
   */
  cle: string;
  /** Une ligne, lisible telle quelle dans la cloche. */
  titre: string;
  /** Deux ou trois phrases. C'est ce qu'on lira si le courriel se perd. */
  corps: string;
  /** Où ça mène, quand il y a quelque chose à ouvrir. */
  lien?: string;
  /**
   * Les variables du modèle de courriel, quand l'événement en a un.
   *
   * Rangée telle quelle dans `Notification.payload` également — jamais
   * affichée directement : elle peut porter un lien de téléchargement.
   */
  charge?: Record<string, unknown>;
  /**
   * Ne livrer que sur ces canaux-là.
   *
   * ════════════════════════════════════════════════════════════════════════
   * POUR LE CAS OÙ QUELQU'UN D'AUTRE A DÉJÀ ENVOYÉ
   *
   * La relance d'abonnement est le seul exemple aujourd'hui, et il suffit à
   * justifier ce champ. Elle part par le moteur Ndank, qui **choisit
   * lui-même** son canal et escalade courriel → SMS → push jusqu'à ce que
   * l'un accepte. Quand il a réussi, il reste à en garder une trace dans
   * l'application — et seulement ça : repasser par le courriel enverrait le
   * même message deux fois.
   *
   * C'est une RESTRICTION, jamais une autorisation : la liste est croisée
   * avec ce que les préférences permettent. On ne peut donc pas s'en servir
   * pour forcer un canal que la personne a fermé.
   */
  canaux?: readonly Canal[];
}

export interface Livraison {
  /** Ce qui a effectivement été écrit. */
  canaux: Canal[];
  /** Ce qui a été refusé parce que déjà livré — un rejeu, et c'est normal. */
  doublons: Canal[];
  /**
   * Ce qui était ouvert et n'est pas parti.
   *
   * ════════════════════════════════════════════════════════════════════════
   * POURQUOI CE TROISIÈME CHAMP EXISTE
   *
   * La première version n'en avait que deux, et confondait donc deux choses
   * très différentes : « ce canal était fermé » et « ce canal était ouvert,
   * et la livraison a échoué ». Dans les deux cas, `canaux` ne le contenait
   * pas — donc rien ne distinguait un choix de l'utilisateur d'une charge de
   * courriel malformée.
   *
   * Un test d'intégration l'a montré : trois charges incomplètes étaient
   * refusées au dépôt, journalisées, et l'appelant recevait exactement la
   * même réponse que si la personne avait coupé son courriel.
   *
   * Un avis qui ne part jamais et que personne ne remarque est pire qu'un
   * avis absent : on croit prévenir.
   */
  echecs: Canal[];
}

/**
 * Prévenir quelqu'un.
 *
 * L'adresse n'est pas un paramètre : elle se lit du compte. La recevoir
 * permettrait d'envoyer le reçu de quelqu'un à l'adresse d'un autre, et c'est
 * exactement le genre de paramètre qu'un appelant finit par remplir avec ce
 * qu'il a sous la main.
 */
export async function notifier(
  avis: Avis,
  client: ClientNotifications = db,
): Promise<Livraison> {
  const vide: Livraison = { canaux: [], doublons: [], echecs: [] };

  try {
    const destinataire = await client.user.findUnique({
      where: { id: avis.destinataireId },
      // Le nom d'affichage en plus : voir `charge` plus bas.
      select: {
        id: true,
        email: true,
        profile: { select: { displayName: true } },
      },
    });

    if (!destinataire) {
      // Un compte supprimé entre le fait et l'avis. Rien à prévenir, rien à
      // réparer — mais on le note : si cela devient fréquent, c'est que
      // l'appelant garde un identifiant trop longtemps.
      journal.info("avis sans destinataire", {
        evenement: avis.evenement,
        cle: avis.cle,
      });
      return vide;
    }

    const preferences = await lirePreferences(destinataire.id, client);

    // L'intersection, dans cet ordre : ce que les préférences ouvrent, puis ce
    // que l'appelant restreint. Jamais l'inverse — une restriction ne doit pas
    // pouvoir ouvrir.
    const ouverts = canauxPour(avis.evenement, preferences);
    const canaux = avis.canaux
      ? ouverts.filter((c) => avis.canaux?.includes(c))
      : ouverts;

    const livraison: Livraison = { canaux: [], doublons: [], echecs: [] };

    for (const canal of canaux) {
      const pose =
        canal === "IN_APP"
          ? await ecrireDansLaCloche(destinataire.id, avis, client)
          : await deposerLeCourriel(
              destinataire.email,
              avis,
              client,
              destinataire.profile?.displayName ?? null,
            );

      if (pose === "pose") livraison.canaux.push(canal);
      else if (pose === "doublon") livraison.doublons.push(canal);
      else if (pose === "echec") livraison.echecs.push(canal);
      // `sans_modele` ne compte pas comme un échec : le catalogue dit que
      // cet événement n'a pas de courriel, et l'écran de réglages l'affiche.
    }

    if (livraison.echecs.length > 0) {
      journal.erreur("avis partiellement livré", {
        evenement: avis.evenement,
        cle: avis.cle,
        echecs: livraison.echecs,
      });
    }

    return livraison;
  } catch (cause) {
    // ════════════════════════════════════════════════════════════════════════
    // ON NE RELANCE JAMAIS — SAUF DANS UNE TRANSACTION
    //
    // Prévenir est une conséquence de l'acte, pas une condition : avaler
    // l'erreur est ce qui empêche un webhook de paiement de répondre 500
    // parce que la cloche n'a pas sonné.
    //
    // Mais à l'intérieur d'une transaction, une requête qui a échoué a déjà
    // mis celle-ci en erreur : PostgreSQL refuse tout le reste jusqu'au
    // `ROLLBACK`. Avaler l'exception laisserait l'appelant continuer d'écrire
    // dans une transaction morte, et croire que ça passe — le vrai échec
    // n'apparaîtrait qu'au `COMMIT`, sans rapport avec sa cause.
    //
    // On relance donc, et c'est l'appelant qui décide : la transaction du
    // paiement doit échouer franchement plutôt que de s'encaisser à moitié.
    journal.erreur("avis non livré", {
      evenement: avis.evenement,
      cle: avis.cle,
      cause: cause instanceof Error ? cause.message : String(cause),
    });

    if (client !== db) throw cause;
    return vide;
  }
}

type Issue =
  /** Écrit. */
  | "pose"
  /** Déjà livré — un rejeu, et c'est ce que la clé sert à arrêter. */
  | "doublon"
  /** Rien à envoyer sur ce canal : le catalogue ne prévoit pas de courriel. */
  | "sans_modele"
  /** Il devait partir et n'est pas parti. À remonter. */
  | "echec";

async function ecrireDansLaCloche(
  utilisateurId: string,
  avis: Avis,
  client: ClientNotifications,
): Promise<Issue> {
  try {
    await client.notification.create({
      data: {
        userId: utilisateurId,
        type: avis.evenement,
        cle: `in-app:${avis.cle}`,
        titre: avis.titre,
        corps: avis.corps,
        lien: avis.lien ?? null,
        payload: (avis.charge ?? {}) as object,
      },
    });
    return "pose";
  } catch (cause) {
    // P2002 : la clé existe déjà. C'est un rejeu, et c'est précisément ce
    // qu'elle sert à arrêter — pas une erreur.
    if (estCollisionUnique(cause)) return "doublon";
    throw cause;
  }
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LE NOM EST AJOUTÉ ICI, PAS PAR L'APPELANT
 *
 * Tous les modèles de courriel commencent par « Bonjour <nom> ». Le faire
 * passer par chaque appel voudrait dire l'écrire à une dizaine d'endroits, et
 * en oublier un ferait échouer le rendu **au dépôt** — c'est-à-dire loin de
 * l'endroit où l'oubli a eu lieu.
 *
 * L'aiguilleur a déjà lu le compte pour trouver l'adresse ; il en tire le nom
 * sans requête de plus.
 *
 * Ce que l'appelant passe l'emporte : un modèle qui veut nommer quelqu'un
 * d'AUTRE que son destinataire — « <nom> vient de s'inscrire » — écrit son
 * propre `nom` et il est conservé.
 *
 * Zod retire les clés qu'un schéma ne déclare pas : ajouter `nom` à un modèle
 * qui n'en veut pas ne casse rien.
 */
async function deposerLeCourriel(
  adresse: string,
  avis: Avis,
  client: ClientNotifications,
  nom: string | null,
): Promise<Issue> {
  const modele = CATALOGUE[avis.evenement].modele;

  // Pas encore de modèle pour cet événement : il n'est livré qu'en in-app.
  // C'est écrit dans le catalogue, et ce n'est pas un échec — un courriel sans
  // texte serait pire que pas de courriel.
  if (modele === null) return "sans_modele";

  const suite = await deposer(
    {
      cle: `courriel:${avis.cle}`,
      destinataire: adresse,
      modele,
      charge: { nom: nom ?? adresse, ...avis.charge },
    },
    client,
  );

  if (suite.depose) return "pose";

  // `adresse_invalide` et `charge_invalide` sont de vrais échecs : quelqu'un
  // devait être prévenu et ne l'a pas été. La file les a déjà journalisés ;
  // on les remonte pour qu'ils ne se confondent pas avec un canal fermé.
  return suite.motif === "doublon" ? "doublon" : "echec";
}

/** Violation de contrainte unique, au sens de Prisma. */
function estCollisionUnique(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === "P2002"
  );
}
