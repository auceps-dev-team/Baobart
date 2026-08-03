"use server";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import {
  LONGUEUR_MOT_DE_PASSE_MIN,
  hacherMotDePasse,
  verifierMotDePasse,
} from "@/lib/auth/password";
import { fermerSession, ouvrirSession } from "@/lib/auth/session";

/**
 * Actions d'authentification.
 *
 * Règle qui gouverne les messages d'erreur : on ne dit **jamais** si c'est
 * l'adresse ou le mot de passe qui est faux. Le dire transformerait le
 * formulaire de connexion en outil pour savoir qui a un compte ici.
 */

export interface EtatFormulaire {
  erreur?: string;
  champ?: "email" | "motDePasse" | "username" | "nom" | "conditions";
}

const MESSAGE_IDENTIFIANTS = "Adresse ou mot de passe incorrect.";

function normaliserEmail(valeur: string): string {
  return valeur.trim().toLowerCase();
}

function normaliserUsername(valeur: string): string {
  return valeur
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function connecter(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const email = normaliserEmail(String(donnees.get("email") ?? ""));
  const motDePasse = String(donnees.get("motDePasse") ?? "");

  if (!email || !motDePasse) {
    return { erreur: "Renseigne ton adresse et ton mot de passe." };
  }

  const compte = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, suspendedAt: true },
  });

  // On vérifie même quand le compte n'existe pas : sans ça, une réponse
  // immédiate trahirait les adresses inconnues par le simple temps de réponse.
  const valide = await verifierMotDePasse(
    motDePasse,
    compte?.passwordHash ?? null,
  );

  if (!compte || !valide) return { erreur: MESSAGE_IDENTIFIANTS };

  if (compte.suspendedAt) {
    return { erreur: "Ce compte est suspendu. Écris-nous pour en savoir plus." };
  }

  await ouvrirSession(compte.id);
  redirect("/dashboard");
}

export async function inscrire(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const prenom = String(donnees.get("prenom") ?? "").trim();
  const nom = String(donnees.get("nom") ?? "").trim();
  const username = normaliserUsername(String(donnees.get("username") ?? ""));
  const email = normaliserEmail(String(donnees.get("email") ?? ""));
  const motDePasse = String(donnees.get("motDePasse") ?? "");
  const conditions = donnees.get("conditions") === "on";

  if (!prenom || !nom) {
    return { erreur: "Indique ton prénom et ton nom.", champ: "nom" };
  }
  if (username.length < 3) {
    return {
      erreur: "Le nom d'utilisateur doit faire au moins 3 caractères.",
      champ: "username",
    };
  }
  if (!email.includes("@")) {
    return { erreur: "Cette adresse ne ressemble pas à un e-mail.", champ: "email" };
  }
  if (motDePasse.length < LONGUEUR_MOT_DE_PASSE_MIN) {
    return {
      erreur: `Le mot de passe doit faire au moins ${LONGUEUR_MOT_DE_PASSE_MIN} caractères.`,
      champ: "motDePasse",
    };
  }
  if (!conditions) {
    return {
      erreur: "Il faut accepter les conditions pour créer un compte.",
      champ: "conditions",
    };
  }

  const [emailPris, usernamePris] = await Promise.all([
    db.user.findUnique({ where: { email }, select: { id: true } }),
    db.profile.findUnique({ where: { username }, select: { id: true } }),
  ]);

  if (emailPris) {
    return {
      erreur: "Un compte existe déjà avec cette adresse.",
      champ: "email",
    };
  }
  if (usernamePris) {
    return { erreur: "Ce nom d'utilisateur est déjà pris.", champ: "username" };
  }

  const passwordHash = await hacherMotDePasse(motDePasse);

  const compte = await db.user.create({
    data: {
      email,
      passwordHash,
      profile: {
        create: { username, displayName: `${prenom} ${nom}`.trim() },
      },
    },
    select: { id: true },
  });

  await ouvrirSession(compte.id);
  redirect("/dashboard");
}

export async function deconnecter(): Promise<void> {
  await fermerSession();
  redirect("/");
}

/**
 * Demande de réinitialisation.
 *
 * L'envoi réel attend le service d'e-mail (`lib/email`, cf. SPEC_DEPLOIEMENT).
 * On le dit franchement plutôt que d'afficher « lien envoyé » sur un message qui
 * ne partira jamais — c'est le genre de mensonge dont on se souvient.
 */
export async function demanderReinitialisation(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const email = normaliserEmail(String(donnees.get("email") ?? ""));

  if (!email.includes("@")) {
    return { erreur: "Cette adresse ne ressemble pas à un e-mail.", champ: "email" };
  }

  return {
    erreur:
      "La réinitialisation par e-mail arrive avec le service d'envoi. En attendant, écris-nous.",
  };
}
