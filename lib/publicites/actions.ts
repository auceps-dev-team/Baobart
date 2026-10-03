"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { consigner } from "@/lib/admin/audit";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import {
  validerEcart,
  validerPublicite,
  type ChampPub,
  type SaisiePub,
} from "@/lib/publicites/regles";
import {
  archiver,
  creer,
  mettreEnPause,
  modifier,
  racineMedias,
  regler,
} from "@/lib/publicites/service";

/**
 * Les gestes de l'ADS manager.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * `promouvoir_du_contenu`, DANS CHAQUE ACTION
 *
 * Décidé le 03/10 : l'administration et le marketing. Un module « use server »
 * expose chacun de ses exports au navigateur — cacher l'écran ne fermerait
 * rien, la garde est donc ici, en tête de chaque geste.
 */

export type EtatFormulairePub =
  | { ok: true }
  | { ok: false; message: string; champ?: ChampPub; saisie: SaisiePub };

export async function creerPublicite(
  _precedent: EtatFormulairePub | null,
  donnees: FormData,
): Promise<EtatFormulairePub> {
  const qui = await exigerLePouvoir("promouvoir_du_contenu");
  const saisie = lireSaisie(donnees);

  const verdict = validerPublicite(saisie, racineMedias());
  if (!verdict.ok) return { ok: false, saisie, champ: verdict.champ, message: verdict.message };

  const id = await creer(qui.id, verdict.pub);
  await consigner({
    acteurId: qui.id,
    action: "publicite.creer",
    ressource: `ad:${id}`,
    details: { titre: verdict.pub.title, lien: verdict.pub.linkUrl, frequence: verdict.pub.frequency },
  });

  rafraichir();
  redirect("/dashboard/publicites" as Route);
}

export async function modifierPublicite(
  id: string,
  _precedent: EtatFormulairePub | null,
  donnees: FormData,
): Promise<EtatFormulairePub> {
  const qui = await exigerLePouvoir("promouvoir_du_contenu");
  const saisie = lireSaisie(donnees);

  const verdict = validerPublicite(saisie, racineMedias());
  if (!verdict.ok) return { ok: false, saisie, champ: verdict.champ, message: verdict.message };

  if (!(await modifier(id, verdict.pub))) {
    return { ok: false, saisie, message: "Cette publicité n'existe plus — quelqu'un l'a supprimée entre-temps." };
  }

  await consigner({
    acteurId: qui.id,
    action: "publicite.modifier",
    ressource: `ad:${id}`,
    details: { titre: verdict.pub.title, lien: verdict.pub.linkUrl, frequence: verdict.pub.frequency },
  });

  rafraichir();
  return { ok: true };
}

export type EtatGestePub = { ok: boolean; message?: string };

export async function basculerPause(id: string, enPause: boolean): Promise<EtatGestePub> {
  const qui = await exigerLePouvoir("promouvoir_du_contenu");

  if (!(await mettreEnPause(id, enPause))) {
    return { ok: false, message: "Cette publicité n'existe plus." };
  }

  await consigner({
    acteurId: qui.id,
    action: enPause ? "publicite.suspendre" : "publicite.reprendre",
    ressource: `ad:${id}`,
  });

  rafraichir();
  return { ok: true };
}

/**
 * Archiver, ou restaurer. Il n'y a plus de suppression : elle effaçait les
 * affichages et les clics de la campagne, et rien ne les recrée.
 */
export async function archiverPublicite(id: string, archivee: boolean): Promise<EtatGestePub> {
  const qui = await exigerLePouvoir("promouvoir_du_contenu");

  if (!(await archiver(id, archivee))) return { ok: false, message: "Cette publicité n'existe plus." };

  await consigner({
    acteurId: qui.id,
    action: archivee ? "publicite.archiver" : "publicite.restaurer",
    ressource: `ad:${id}`,
  });

  rafraichir();
  return { ok: true };
}

export type EtatReglages = { ok: boolean; message?: string };

export async function reglerPublicites(
  _precedent: EtatReglages | null,
  donnees: FormData,
): Promise<EtatReglages> {
  const qui = await exigerLePouvoir("promouvoir_du_contenu");

  const ecart = validerEcart(String(donnees.get("ecartMinimal") ?? ""));
  if (ecart === null) {
    return { ok: false, message: "L'écart minimal va d'un produit à cinquante." };
  }
  // Une case cochée arrive « on » ; décochée, elle n'arrive pas du tout.
  const actives = donnees.get("actives") !== null;

  await regler({ actives, ecartMinimal: ecart });
  await consigner({
    acteurId: qui.id,
    action: "publicite.regler",
    ressource: "adsettings:global",
    details: { actives, ecartMinimal: ecart },
  });

  rafraichir();
  return { ok: true };
}

function lireSaisie(donnees: FormData): SaisiePub {
  const lire = (nom: string) => String(donnees.get(nom) ?? "");
  return {
    titre: lire("titre"),
    lien: lire("lien"),
    nature: lire("nature"),
    imageUrl: lire("imageUrl"),
    imageLargeur: lire("imageLargeur"),
    imageHauteur: lire("imageHauteur"),
    videoUrl: lire("videoUrl"),
    frequence: lire("frequence"),
    debut: lire("debut"),
    fin: lire("fin"),
  };
}

/**
 * L'écran d'administration, et les deux mosaïques qui montrent les bannières.
 * Les deux pages publiques sont rendues à chaque requête ; les rafraîchir ici
 * vide aussi le cache du routeur côté client.
 */
function rafraichir(): void {
  revalidatePath("/dashboard/publicites");
  revalidatePath("/");
  revalidatePath("/explore");
}
