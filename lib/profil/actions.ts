"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { valider, type Saisie } from "@/lib/profil/validation";

/**
 * Enregistrer son profil public.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE NOM D'UTILISATEUR PEUT CHANGER, ET C'EST UN CHOIX
 *
 * Il faut le dire, parce qu'on a tranché l'inverse pour le slug d'un produit
 * quelques jours plus tôt : là, le titre change et l'adresse reste.
 *
 * La différence tient à ce que l'adresse désigne. Le slug d'un produit est
 * l'adresse d'une **chose** — la renommer n'oblige pas à déménager. Le nom
 * d'utilisateur est l'adresse d'une **personne**, et une personne mal nommée
 * à l'inscription — faute de frappe, nom de scène abandonné — vit avec cette
 * adresse partout où on la cite. Le lui refuser serait la punir d'une minute
 * d'inattention.
 *
 * Le prix est réel : les anciens liens `/@ancien-nom` tombent. L'écran le dit
 * avant qu'on enregistre, plutôt que de le découvrir après.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'UNICITÉ NE SE DÉCIDE PAS DANS UN MODULE PUR
 *
 * `lib/profil/validation.ts` borne les formes ; savoir si « awa-diallo » est
 * libre demande de lire la base. La vérification vit donc ici — et la
 * contrainte unique de Prisma reste le dernier mot, parce que deux personnes
 * peuvent choisir le même nom entre la lecture et l'écriture.
 */

export type EtatProfil =
  | { ok: true }
  | { ok: false; message: string; champ?: string; saisie: Saisie };

export async function enregistrerProfil(
  _precedent: EtatProfil | null,
  donnees: FormData,
): Promise<EtatProfil> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/dashboard/profil");

  const saisie = lireSaisie(donnees);

  const verdict = valider(saisie);
  if (!verdict.ok) {
    return {
      ok: false,
      saisie,
      champ: verdict.refus.champ,
      message: verdict.refus.message,
    };
  }

  const p = verdict.profil;

  // Libre, ou déjà le sien ? Les deux cas passent — le second est celui de
  // quelqu'un qui enregistre son profil sans toucher à son nom.
  const pris = await db.profile.findUnique({
    where: { username: p.username },
    select: { userId: true },
  });

  if (pris && pris.userId !== utilisateur.id) {
    return {
      ok: false,
      saisie,
      champ: "username",
      message: "Ce nom d'utilisateur est déjà pris.",
    };
  }

  const donneesProfil = {
    displayName: p.nomAffiche,
    username: p.username,
    bio: p.bio,
    city: p.ville,
    country: p.pays,
    speciality: p.specialite,
    portfolioUrl: p.portfolio,
    instagram: p.instagram,
    behance: p.behance,
    openToCommissions: p.disponibilite,
    dailyRate: p.tarifJournalier,
  };

  try {
    // `upsert` : un compte peut exister sans profil — l'inscription en crée
    // un, mais rien ne l'impose au schéma, et un compte fabriqué autrement
    // (script, import) n'en aurait pas.
    await db.profile.upsert({
      where: { userId: utilisateur.id },
      update: donneesProfil,
      create: { userId: utilisateur.id, ...donneesProfil },
    });
  } catch (cause) {
    // Deux personnes ont pu choisir le même nom entre la lecture ci-dessus et
    // cette écriture. La contrainte unique tranche, et l'on rend un message
    // au lieu d'une erreur 500.
    if (estCollisionUnique(cause)) {
      return {
        ok: false,
        saisie,
        champ: "username",
        message: "Ce nom d'utilisateur vient d'être pris. Choisis-en un autre.",
      };
    }
    throw cause;
  }

  revalidatePath("/dashboard/profil");
  // La vitrine publique, à sa nouvelle adresse comme à l'ancienne : celle
  // qu'on quitte doit cesser de servir une page en cache.
  revalidatePath(`/createurs/${p.username}`);
  if (utilisateur.username && utilisateur.username !== p.username) {
    revalidatePath(`/createurs/${utilisateur.username}`);
  }

  return { ok: true };
}

function estCollisionUnique(erreur: unknown): boolean {
  return (
    typeof erreur === "object" &&
    erreur !== null &&
    "code" in erreur &&
    (erreur as { code?: string }).code === "P2002"
  );
}

/**
 * Ce que le formulaire a envoyé, renvoyé tel quel en cas de refus.
 *
 * React vide les champs non contrôlés à la fin d'une action. Refaire saisir
 * une présentation pour un code pays mal tapé ferait abandonner.
 */
function lireSaisie(donnees: FormData): Saisie {
  const lire = (nom: string) => String(donnees.get(nom) ?? "");
  return {
    nomAffiche: lire("nomAffiche"),
    username: lire("username"),
    bio: lire("bio"),
    ville: lire("ville"),
    pays: lire("pays"),
    specialite: lire("specialite"),
    portfolio: lire("portfolio"),
    instagram: lire("instagram"),
    behance: lire("behance"),
    disponibilite: lire("disponibilite"),
    tarifJournalier: lire("tarifJournalier"),
  };
}
