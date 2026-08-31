import "server-only";

import { journal } from "@/lib/observabilite/journal";
import { sujetAnonyme } from "@/lib/securite/adresse";
import {
  REGLES,
  cleDe,
  juger,
  seauDe,
  type NomRegle,
  type Verdict,
} from "@/lib/securite/limites";
import { piloteLimite } from "@/lib/securite/pilotes";

/**
 * La garde que les routes appellent.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'ELLE PROTÈGE, ET CE QU'ELLE NE PROTÈGE PAS
 *
 * Elle ralentit. Elle n'authentifie pas, elle ne remplace aucune vérification,
 * et elle ne doit jamais être la seule chose entre un inconnu et une écriture.
 * La signature du webhook, le mot de passe, le secret du cron : tout cela reste
 * en place et fait le vrai travail. La limitation évite seulement qu'on puisse
 * essayer un million de fois.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELLE LAISSE PASSER DANS LE DOUTE
 *
 * Deux cas où l'on autorise sans compter :
 *
 *   — **pas d'adresse identifiable.** En développement, derrière un tunnel, ou
 *     dans un test. Se rabattre sur une valeur commune serait pire : tous les
 *     visiteurs sans adresse partageraient un compteur, et le premier robot
 *     fermerait la porte à tous les autres ;
 *   — **compteur en panne.** Un limiteur indisponible ne doit pas fermer la
 *     connexion à tout le monde. L'incident est journalisé en erreur, pas
 *     avalé.
 *
 * Ces deux cas se voient à l'écran Système, et c'est là qu'ils doivent se voir
 * — pas dans un refus opposé à un acheteur.
 */

export interface Passage {
  autorise: boolean;
  /** Ce qu'il reste avant refus. `null` quand rien n'a été compté. */
  restant: number | null;
  /** Combien de temps attendre. `0` quand le geste passe. */
  dansSecondes: number;
}

const LIBRE: Passage = { autorise: true, restant: null, dansSecondes: 0 };

/**
 * Compte un geste et dit s'il passe.
 *
 * Le sujet est ce qui identifie l'auteur : une adresse pour l'anonyme, un
 * identifiant de compte pour qui est connecté. Deux règles différentes ne
 * partagent jamais de compteur — le nom de la règle est dans la clé.
 */
export async function verifierLimite(
  regleNom: NomRegle,
  sujet: string | null,
): Promise<Passage> {
  if (!sujet) return LIBRE;

  const regle = REGLES[regleNom];
  const pilote = piloteLimite();
  const maintenant = Date.now();

  const { seau, ecouleMs } = seauDe(maintenant, regle);

  // Le seau courant est incrémenté ; le précédent est seulement lu. On garde
  // les deux le temps de deux fenêtres, pour que le précédent existe encore
  // quand on le consulte.
  const courant = await pilote.compter(
    cleDe(regleNom, sujet, seau),
    regle.fenetreMs * 2,
  );

  if (courant === null) return LIBRE;

  const precedent = (await pilote.lire(cleDe(regleNom, sujet, seau - 1))) ?? 0;

  const verdict: Verdict = juger({
    precedent,
    courant,
    regle,
    ecouleMs,
  });

  if (!verdict.autorise) {
    // Le sujet n'est PAS journalisé : c'est une adresse, donc une donnée
    // personnelle, et un journal d'agrégation en garderait la trace bien plus
    // longtemps que nécessaire. Le nom de la règle suffit à voir qu'on est
    // attaqué et sur quoi.
    journal.avertissement("limite atteinte", {
      regle: regleNom,
      dansSecondes: verdict.dansSecondes,
    });
  }

  return {
    autorise: verdict.autorise,
    restant: verdict.restant,
    dansSecondes: verdict.autorise ? 0 : verdict.dansSecondes,
  };
}

/** La même chose, à partir d'une requête HTTP anonyme. */
export async function verifierLimiteHttp(
  regleNom: NomRegle,
  requete: Request,
): Promise<Passage> {
  return verifierLimite(regleNom, sujetAnonyme(requete));
}

/**
 * La même chose depuis une action serveur, qui n'a pas de `Request` sous la
 * main.
 *
 * Les actions serveur sont les points d'entrée les plus exposés du projet : un
 * module « use server » offre chacun de ses exports au navigateur. Connexion,
 * inscription et oubli de mot de passe en sont, et ce sont précisément les
 * trois portes qu'on force.
 */
export async function verifierLimiteAction(
  regleNom: NomRegle,
): Promise<Passage> {
  const { headers } = await import("next/headers");
  const entetes = await headers();

  // `headers()` rend un objet compatible ; on le présente en `Request` pour
  // réutiliser la même extraction d'adresse, avec ses précautions.
  const factice = new Request("https://baobart.local/action", {
    headers: new Headers(Object.fromEntries(entetes.entries())),
  });

  return verifierLimite(regleNom, sujetAnonyme(factice));
}

/**
 * La réponse à opposer quand la limite est atteinte.
 *
 * `Retry-After` n'est pas décoratif : c'est ce qu'un client correct lit pour
 * savoir quand revenir. Sans lui, il réessaie aussitôt et aggrave ce que la
 * limite prévenait.
 */
export function reponseTropDeGestes(passage: Passage): Response {
  return new Response(
    JSON.stringify({ erreur: "trop_de_gestes", dansSecondes: passage.dansSecondes }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(passage.dansSecondes),
      },
    },
  );
}
