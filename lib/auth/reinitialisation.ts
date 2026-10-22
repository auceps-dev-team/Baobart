import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { hacherMotDePasse } from "@/lib/auth/password";
import { fermerToutesLesSessions } from "@/lib/auth/session";
import { manqueAuMotDePasse } from "@/lib/auth/strength";
import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { journal } from "@/lib/observabilite/journal";

/**
 * Réinitialisation du mot de passe par courriel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'EST VRAIMENT UN LIEN DE RÉINITIALISATION
 *
 * C'est un mot de passe temporaire qui traîne dans une boîte mail. Tout le
 * dessin de ce module découle de là :
 *
 *   — la table ne garde qu'une **empreinte** du jeton, comme pour les sessions.
 *     Une fuite de la base ne donne alors la main sur aucun compte ;
 *   — la validité est **courte** — une heure. Un courriel relu six mois plus
 *     tard, sur un poste revendu, ne doit plus rien ouvrir ;
 *   — le jeton est **à usage unique**, et la consommation est atomique : deux
 *     envois simultanés du formulaire n'en valident qu'un ;
 *   — demander un nouveau lien **périme les précédents**. Sinon chaque demande
 *     laisse une clé de plus en circulation ;
 *   — réussir **ferme toutes les sessions**. Le cas qu'on traite est souvent
 *     « quelqu'un d'autre est entré chez moi » : lui laisser sa session ouverte
 *     viderait le geste de son sens.
 *
 * SHA-256 suffit ici, là où les mots de passe exigent scrypt. Un mot de passe
 * est court et choisi par un humain — on ralentit qui le devine. Trente-deux
 * octets tirés au hasard ne se devinent pas : il n'y a rien à ralentir.
 */

/** Une heure. Assez pour aller chercher le courriel, pas pour l'oublier. */
export const VALIDITE_HEURES = 1;

/** Au-delà, on cesse d'envoyer : une boîte mail n'est pas une arme. */
const DEMANDES_MAX = 3;
const FENETRE_MS = 15 * 60_000;

const OCTETS = 32;

function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}

function expiration(): Date {
  return new Date(Date.now() + VALIDITE_HEURES * 3_600_000);
}

/**
 * Crée un jeton pour ce compte et périme les précédents.
 *
 * Rend le jeton **en clair** — la seule fois où il existe sous cette forme.
 * Ce module est `server-only` : il n'est pas joignable depuis un navigateur.
 */
export async function creerJeton(userId: string): Promise<string> {
  const jeton = randomBytes(OCTETS).toString("base64url");

  await db.$transaction(async (tx) => {
    await tx.passwordReset.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    await tx.passwordReset.create({
      data: { userId, token: empreinte(jeton), expiresAt: expiration() },
    });
  });

  return jeton;
}

export type ResultatDemande =
  /** Traité. Ne dit **pas** si le compte existe — voir plus bas. */
  | { fait: true }
  /** Rien ne peut partir : `APP_URL` manque. Une panne d'exploitation. */
  | { fait: false; motif: "site_non_configure" };

/**
 * Traite une demande venue du formulaire d'oubli.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE SILENCE EST LA FONCTIONNALITÉ
 *
 * Cette fonction rend la même chose pour une adresse inscrite et pour une
 * adresse inconnue. Répondre « aucun compte à cette adresse » transformerait le
 * formulaire en annuaire : on y essaie une liste d'adresses et on repart avec
 * celles qui sont chez nous — matière à hameçonnage ciblé, et information que
 * l'intéressé n'a jamais accepté de rendre publique.
 *
 * Le plafond de demandes est silencieux pour la même raison, et sert aussi à
 * éviter qu'on se serve de nous pour inonder la boîte de quelqu'un.
 */
export async function demanderReinitialisation(
  email: string,
): Promise<ResultatDemande> {
  const base = urlDuSite();
  if (!base) {
    // Distinguer ce cas n'apprend rien sur les comptes : c'est une panne de
    // configuration, la même pour tout le monde. La taire afficherait
    // « vérifie ta boîte » sur un courriel qui ne partira jamais.
    journal.erreur("réinitialisation impossible : APP_URL absente", {});
    return { fait: false, motif: "site_non_configure" };
  }

  const utilisateur = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, profile: { select: { displayName: true } } },
  });

  if (!utilisateur) {
    journal.info("réinitialisation demandée pour une adresse inconnue", {});
    return { fait: true };
  }

  const recentes = await db.passwordReset.count({
    where: {
      userId: utilisateur.id,
      createdAt: { gte: new Date(Date.now() - FENETRE_MS) },
    },
  });

  if (recentes >= DEMANDES_MAX) {
    journal.avertissement("plafond de demandes de réinitialisation atteint", {
      userId: utilisateur.id,
    });
    return { fait: true };
  }

  const jeton = await creerJeton(utilisateur.id);

  await deposer({
    // Une clé par jeton : deux demandes légitimes doivent produire deux
    // courriels, sinon la seconde — celle qu'on attend — n'arrive jamais.
    cle: `reinitialisation-${empreinte(jeton).slice(0, 32)}`,
    destinataire: utilisateur.email,
    modele: "REINITIALISATION_MOT_DE_PASSE",
    charge: {
      nom: utilisateur.profile?.displayName ?? utilisateur.email,
      lien: `${base}/reinitialiser/${jeton}`,
      heures: VALIDITE_HEURES,
    },
  });

  journal.info("lien de réinitialisation déposé", { userId: utilisateur.id });
  return { fait: true };
}

export type Verification =
  | { valide: true; userId: string; demandeId: string }
  | { valide: false; motif: "inconnu" | "expire" };

/**
 * Dit si un jeton ouvre encore quelque chose.
 *
 * Distinguer « expiré » d'« inconnu » ne révèle rien : le jeton n'est pas
 * devinable, donc en tenir un signifie déjà l'avoir reçu. En revanche, savoir
 * qu'il a simplement vieilli évite de croire qu'on s'est trompé de lien.
 */
export async function verifierJeton(jeton: string): Promise<Verification> {
  if (jeton.length < 16 || jeton.length > 256) {
    return { valide: false, motif: "inconnu" };
  }

  const demande = await db.passwordReset.findUnique({
    where: { token: empreinte(jeton) },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });

  if (!demande) return { valide: false, motif: "inconnu" };

  // Un jeton déjà consommé est présenté comme expiré : c'est vrai du point de
  // vue de celui qui le tient, et la nuance ne lui sert à rien.
  if (demande.usedAt !== null || demande.expiresAt <= new Date()) {
    return { valide: false, motif: "expire" };
  }

  return { valide: true, userId: demande.userId, demandeId: demande.id };
}

export type ResultatChangement =
  | { fait: true }
  | { fait: false; motif: "expire" | "inconnu" | "faible"; detail?: string };

/**
 * Consomme le jeton et pose le nouveau mot de passe.
 *
 * La consommation passe par un `updateMany` dont la condition est **dans le
 * `WHERE`** : c'est la base qui arbitre. Lire puis écrire laisserait deux
 * envois simultanés passer tous les deux — sans conséquence grave ici, mais le
 * jour où le geste consomme une ressource comptée, l'habitude aura été prise.
 */
export async function changerMotDePasse(
  jeton: string,
  nouveau: string,
): Promise<ResultatChangement> {
  const manque = manqueAuMotDePasse(nouveau);
  if (manque) return { fait: false, motif: "faible", detail: manque };

  const verif = await verifierJeton(jeton);
  if (!verif.valide) return { fait: false, motif: verif.motif };

  const hache = await hacherMotDePasse(nouveau);

  const consomme = await db.$transaction(async (tx) => {
    const marque = await tx.passwordReset.updateMany({
      where: { id: verif.demandeId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    // Zéro ligne : un autre envoi a consommé le jeton entre-temps, ou l'heure
    // est passée pendant la saisie. On ne touche pas au mot de passe.
    if (marque.count === 0) return false;

    await tx.user.update({
      where: { id: verif.userId },
      data: { passwordHash: hache },
    });

    // Les autres liens en circulation deviennent caducs.
    await tx.passwordReset.updateMany({
      where: { userId: verif.userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    return true;
  });

  if (!consomme) return { fait: false, motif: "expire" };

  // Hors transaction : fermer les sessions n'a pas à retenir le verrou, et si
  // cela échouait, mieux vaut un mot de passe changé qu'un compte inchangé.
  await fermerToutesLesSessions(verif.userId);

  journal.info("mot de passe réinitialisé", { userId: verif.userId });
  return { fait: true };
}
