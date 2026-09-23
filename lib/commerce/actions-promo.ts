"use server";

import { revalidatePath } from "next/cache";

import { sessionCourante } from "@/lib/auth/session";
import {
  MESSAGES_CODE,
  creerUnCode,
  evaluerUnCode,
  retirerUnCode,
  type TypeRemise,
} from "@/lib/commerce/codes-promo";
import { declarerUnChamp, retirerUnChamp } from "@/lib/commerce/champs";
import { basculerUnUpsell, declarerUnUpsell } from "@/lib/commerce/upsell";
import { db } from "@/lib/db";
import { verifierLimiteAction } from "@/lib/securite/garde";

/**
 * Les codes promo, vus des écrans.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'APERÇU DIT POURQUOI, L'ACHAT NE LE DIT PAS
 *
 * `evaluerUnCode` distingue sept refus — inconnu, retiré, expiré, épuisé,
 * autre ressource, trop forte, sans effet. L'acheteur a besoin de les
 * connaître **avant** de valider : « ce code a expiré » lui apprend quoi
 * faire, « ça n'a pas marché » ne lui apprend rien.
 *
 * Au moment de l'achat, en revanche, le seul cas qui reste est la course —
 * quelqu'un a pris le dernier exemplaire entre l'aperçu et le clic — et le
 * détail n'apporte plus rien. C'est pourquoi `acheter` n'a qu'un motif.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'APERÇU EST BORNÉ
 *
 * Il dit « ce code existe » ou « il n'existe pas », pour un vendeur donné.
 * Sans borne, on l'appellerait en boucle pour découvrir les codes actifs d'une
 * boutique — quelques milliers d'essais suffisent sur des codes courts.
 */

export type ApercuCode =
  | {
      ok: true;
      code: string;
      remise: number;
      prixFinal: number;
      prixAffiche: number;
    }
  | { ok: false; message: string };

export async function apercuDuCode(
  produitId: string,
  code: string,
): Promise<ApercuCode> {
  const borne = await verifierLimiteAction("connexion");
  if (!borne.autorise) {
    return { ok: false, message: "Trop d'essais. Attends un instant." };
  }

  if (!code.trim()) return { ok: false, message: "" };

  const produit = await db.product.findUnique({
    where: { id: produitId },
    select: { id: true, sellerId: true, price: true, status: true },
  });

  if (!produit || produit.status !== "PUBLISHED") {
    return { ok: false, message: MESSAGES_CODE.INCONNU };
  }

  const suite = await evaluerUnCode({
    code,
    vendeurId: produit.sellerId,
    produitId: produit.id,
    prix: produit.price,
  });

  if (!suite.ok) return { ok: false, message: MESSAGES_CODE[suite.motif] };

  return {
    ok: true,
    code: suite.code,
    remise: suite.remise,
    prixFinal: suite.prixFinal,
    prixAffiche: suite.prixAffiche,
  };
}

// ─────────────────────────────────────────────────────────── vendeur ──

export type EtatPromo =
  | { ok: true; message: string }
  | { ok: false; message: string };

const CHEMIN = "/dashboard/promos";

/**
 * Crée un code.
 *
 * Le vendeur est lu depuis la session : un module « use server » est joignable
 * sans passer par l'écran, et accepter un identifiant laisserait créer des
 * codes sur la boutique d'autrui.
 */
export async function creerMonCode(
  _precedent: EtatPromo | null,
  donnees: FormData,
): Promise<EtatPromo> {
  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const type = String(donnees.get("type") ?? "PERCENT") as TypeRemise;
  const montant = Number(donnees.get("montant") ?? 0);
  const plafondBrut = String(donnees.get("plafond") ?? "").trim();
  const expireBrut = String(donnees.get("expireLe") ?? "").trim();

  // Une date invalide devient `null` plutôt que `Invalid Date` : Prisma
  // refuserait la seconde avec une erreur que personne ne sait lire.
  const expireLe = expireBrut ? new Date(expireBrut) : null;

  const suite = await creerUnCode({
    vendeurId: moi.id,
    code: String(donnees.get("code") ?? ""),
    type: type === "FIXED" ? "FIXED" : "PERCENT",
    montant: Number.isFinite(montant) ? Math.trunc(montant) : 0,
    plafond: plafondBrut ? Math.trunc(Number(plafondBrut)) || null : null,
    expireLe: expireLe && !Number.isNaN(expireLe.getTime()) ? expireLe : null,
  });

  revalidatePath(CHEMIN);

  if (suite.ok) return { ok: true, message: "Code créé." };

  const messages = {
    CODE_VIDE: "Un code fait au moins trois caractères.",
    DEJA_PRIS: "Tu as déjà un code qui s'écrit comme celui-là.",
    MONTANT_INVALIDE:
      "Le montant doit être un entier positif — et au plus 100 pour un pourcentage.",
    RESSOURCE_ETRANGERE: "Cette ressource n'est pas la tienne.",
  } as const;

  return { ok: false, message: messages[suite.motif] };
}

/** Retire un code sans l'effacer — les ventes qui le citent le gardent. */
export async function retirerMonCode(
  _precedent: EtatPromo | null,
  donnees: FormData,
): Promise<EtatPromo> {
  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const retire = await retirerUnCode(moi.id, String(donnees.get("id") ?? ""));

  revalidatePath(CHEMIN);

  return retire
    ? { ok: true, message: "Code retiré." }
    : { ok: false, message: "Ce code n'est pas le tien, ou est déjà retiré." };
}

// ──────────────────────────────────────────────────────────── upsell ──

/**
 * Déclare une offre post-achat.
 *
 * Même règle que les codes : le vendeur vient de la session. Accepter un
 * identifiant laisserait déclencher sur la ressource d'un concurrent et
 * proposer la sienne à ses acheteurs.
 */
export async function declarerMonUpsell(
  _precedent: EtatPromo | null,
  donnees: FormData,
): Promise<EtatPromo> {
  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const remiseBrute = String(donnees.get("remise") ?? "").trim();
  const remise = remiseBrute ? Math.trunc(Number(remiseBrute)) : null;

  const suite = await declarerUnUpsell({
    vendeurId: moi.id,
    declencheurId: String(donnees.get("declencheur") ?? ""),
    offreId: String(donnees.get("offre") ?? ""),
    remisePourcent: Number.isFinite(remise) ? remise : null,
  });

  revalidatePath(CHEMIN);

  if (suite.ok) return { ok: true, message: "Offre déclarée." };

  const messages = {
    RESSOURCE_ETRANGERE: "Une de ces ressources n'est pas la tienne.",
    MEME_RESSOURCE: "Une ressource ne peut pas se proposer elle-même.",
    REMISE_INVALIDE: "La remise doit être un entier entre 1 et 100.",
    DEJA_DECLAREE: "Cette offre existe déjà sur ce déclencheur.",
  } as const;

  return { ok: false, message: messages[suite.motif] };
}

/** Active ou coupe une offre. */
export async function basculerMonUpsell(
  _precedent: EtatPromo | null,
  donnees: FormData,
): Promise<EtatPromo> {
  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const actif = donnees.get("actif") === "1";
  const bascule = await basculerUnUpsell(
    moi.id,
    String(donnees.get("id") ?? ""),
    actif,
  );

  revalidatePath(CHEMIN);

  return bascule
    ? { ok: true, message: actif ? "Offre réactivée." : "Offre coupée." }
    : { ok: false, message: "Cette offre n'est pas la tienne." };
}

// ────────────────────────────────────────────── champs personnalisés ──

/**
 * Déclare une question sur une ressource.
 *
 * Le chemin revalidé est celui de la ressource, pas `/dashboard/promos` : les
 * champs vivent sur le produit, pas sur la boutique.
 */
export async function declarerMonChamp(
  _precedent: EtatPromo | null,
  donnees: FormData,
): Promise<EtatPromo> {
  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const produitId = String(donnees.get("produitId") ?? "");

  const suite = await declarerUnChamp({
    vendeurId: moi.id,
    produitId,
    nom: String(donnees.get("nom") ?? ""),
    type: String(donnees.get("type") ?? "TEXT"),
    obligatoire: donnees.get("obligatoire") === "on",
    options: String(donnees.get("options") ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  });

  revalidatePath(`/dashboard/produits/${produitId}`);

  if (suite.ok) return { ok: true, message: "Question ajoutée." };

  const messages = {
    RESSOURCE_ETRANGERE: "Cette ressource n'est pas la tienne.",
    TYPE_NON_SERVI:
      "Les champs « fichier » ne sont pas encore servis : il faut un téléversement avant le paiement.",
    TYPE_INCONNU: "Cette sorte de réponse n'existe pas.",
    NOM_VIDE: "Écris la question.",
    CHOIX_MANQUANTS: "Une liste de choix en demande au moins deux.",
  } as const;

  return { ok: false, message: messages[suite.motif] };
}

/** Retire une question. Les réponses déjà données ne bougent pas. */
export async function retirerMonChamp(
  _precedent: EtatPromo | null,
  donnees: FormData,
): Promise<EtatPromo> {
  const moi = await sessionCourante();
  if (!moi) return { ok: false, message: "Reconnecte-toi." };

  const produitId = String(donnees.get("produitId") ?? "");
  const retire = await retirerUnChamp(moi.id, String(donnees.get("id") ?? ""));

  revalidatePath(`/dashboard/produits/${produitId}`);

  return retire
    ? { ok: true, message: "Question retirée. Les réponses déjà données restent." }
    : { ok: false, message: "Cette question n'est pas la tienne." };
}
