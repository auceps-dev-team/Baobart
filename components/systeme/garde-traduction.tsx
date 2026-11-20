"use client";

/**
 * Le filet sous la traduction automatique du navigateur (Q-44).
 *
 * La traduction de Chrome REMPLACE chaque nœud de texte de la page par des
 * balises <font>. React, lui, croit toujours tenir ses nœuds d'origine : quand
 * il veut en retirer un, ou insérer avant lui, le navigateur répond « The node
 * to be removed is not a child of this node » — l'exception remonte, et tout
 * l'écran tombe (« Quelque chose a cassé »). Mesuré le 14/11/2026 dans le vrai
 * Chrome 157 sur « J'aime » (`Doc/QA_PERSONAS_2026-11-14-suite.md`, piste 5).
 *
 * Les composants touchés par la recette sont corrigés à la source (un élément
 * par texte qui change). Ce filet couvre tous les autres, que personne n'a
 * encore joués traduits : quand le nœud n'est plus là où React le croit, le
 * retrait est abandonné, et l'ajout se fait en fin de parent (un contenu mal
 * placé plutôt qu'absent), au lieu de lever. C'est le contournement décrit
 * par l'équipe React (facebook/react#11538) — lu, non revérifié dans leur
 * dépôt ; son effet ici est mesuré par e2e/traduction.spec.ts.
 *
 * Dans tous les autres cas, les deux méthodes font exactement ce qu'elles
 * faisaient : le filet ne change que le cas où le navigateur allait lever.
 */
if (typeof window !== "undefined" && typeof Node === "function" && !(window as { __gardeTraduction?: boolean }).__gardeTraduction) {
  (window as { __gardeTraduction?: boolean }).__gardeTraduction = true;

  const retirer = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, enfant: T): T {
    if (enfant.parentNode !== this) {
      console.warn("[garde-traduction] nœud déjà retiré par une traduction ; retrait ignoré.");
      return enfant;
    }
    return retirer.call(this, enfant) as T;
  };

  const inserer = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, nouveau: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) {
      console.warn("[garde-traduction] repère déplacé par une traduction ; ajout en fin de parent.");
      return inserer.call(this, nouveau, null) as T;
    }
    return inserer.call(this, nouveau, reference) as T;
  };
}

/** Rien à afficher : l'import suffit à poser le filet, avant l'hydratation. */
export function GardeTraduction() {
  return null;
}
