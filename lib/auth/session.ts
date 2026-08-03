import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { deduireProgression, type Progression } from "@/lib/auth/roles";

/**
 * Sessions par cookie.
 *
 * Le cookie porte un jeton aléatoire de 32 octets ; la base ne stocke que son
 * **empreinte SHA-256**. Une fuite de la table des sessions ne permet donc pas
 * de se faire passer pour quelqu'un — comme pour les mots de passe, on ne garde
 * jamais le secret lui-même.
 *
 * SHA-256 suffit ici, là où les mots de passe exigent scrypt : un jeton de
 * 32 octets tirés au hasard n'est pas devinable, il n'y a rien à ralentir.
 */

const NOM_COOKIE = "baobart_session";
const DUREE_JOURS = 30;

function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export interface UtilisateurConnecte {
  id: string;
  email: string;
  nom: string;
  username: string | null;
  /** Compteur dénormalisé, affiché tel quel par le tableau de bord. */
  abonnes: number;
  /** Où en est le compte sur le chemin acheteur → créateur. */
  progression: Progression;
}

/** Ouvre une session et pose le cookie. */
export async function ouvrirSession(userId: string): Promise<void> {
  const jeton = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DUREE_JOURS * 86_400_000);

  await db.session.create({
    data: { userId, token: empreinte(jeton), expiresAt },
  });

  const magasin = await cookies();
  magasin.set(NOM_COOKIE, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Personne connectée, ou `null`.
 *
 * Une session expirée est supprimée au passage : la table ne grossit pas
 * indéfiniment, et un jeton périmé ne traîne pas en base.
 */
export async function sessionCourante(): Promise<UtilisateurConnecte | null> {
  const magasin = await cookies();
  const jeton = magasin.get(NOM_COOKIE)?.value;
  if (!jeton) return null;

  const session = await db.session.findUnique({
    where: { token: empreinte(jeton) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          suspendedAt: true,
          followersCount: true,
          profile: { select: { displayName: true, username: true } },
          _count: {
            select: {
              products: true,
              balanceTransactions: true,
            },
          },
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Un compte suspendu n'a plus de session valable, même s'il détient un jeton
  // encore frais — la suspension doit prendre effet immédiatement.
  if (session.user.suspendedAt) return null;

  // Le compte des produits PUBLIÉS demande une seconde lecture : `_count` ne
  // sait pas compter deux fois la même relation avec des filtres différents.
  const produitsPublies = await db.product.count({
    where: { sellerId: session.user.id, status: "PUBLISHED" },
  });

  return {
    id: session.user.id,
    email: session.user.email,
    nom: session.user.profile?.displayName ?? session.user.email,
    username: session.user.profile?.username ?? null,
    abonnes: session.user.followersCount,
    progression: deduireProgression({
      produits: session.user._count.products,
      produitsPublies,
      ecrituresAuGrandLivre: session.user._count.balanceTransactions,
    }),
  };
}

/** Ferme la session courante et efface le cookie. */
export async function fermerSession(): Promise<void> {
  const magasin = await cookies();
  const jeton = magasin.get(NOM_COOKIE)?.value;

  if (jeton) {
    await db.session
      .deleteMany({ where: { token: empreinte(jeton) } })
      .catch(() => {});
  }

  magasin.delete(NOM_COOKIE);
}

/** Ferme toutes les sessions d'un compte — changement de mot de passe, suspension. */
export async function fermerToutesLesSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
