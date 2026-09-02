import { describe, expect, it } from "vitest";

import {
  PREFIXE,
  paiementDeReference,
  referenceDe,
} from "@/lib/abonnements/renouvellement";

/**
 * L'aiguillage de la réception tient entièrement sur ces deux fonctions.
 *
 * Si `paiementDeReference` rendait `null` sur une vraie référence
 * d'abonnement, le rappel serait cherché parmi les commandes, n'y serait pas,
 * et refusé comme « commande introuvable » : l'abonné aurait payé et son accès
 * serait coupé le lendemain.
 *
 * Si elle rendait un identifiant sur une référence de commande, c'est l'achat
 * qui ne serait jamais livré.
 */

describe("la référence d'un renouvellement", () => {
  it("se relit telle qu'on l'a écrite", () => {
    const id = "clx0123456789abcdef";
    expect(paiementDeReference(referenceDe(id))).toBe(id);
  });

  it("ne reconnaît pas une référence de commande", () => {
    // Les commandes envoient un cuid nu. C'est cette asymétrie qui rend
    // l'ambiguïté impossible plutôt qu'improbable.
    expect(paiementDeReference("clx0123456789abcdef")).toBeNull();
  });

  it("refuse un préfixe sans identifiant derrière", () => {
    // Sinon on chercherait le paiement d'identifiant vide, et la réception
    // répondrait « abonnement introuvable » sur ce qui est en fait une
    // référence malformée.
    expect(paiementDeReference(PREFIXE)).toBeNull();
  });

  it("ne se laisse pas prendre par un préfixe au milieu", () => {
    expect(paiementDeReference("cmdabo-123")).toBeNull();
  });

  it("n'emploie que des caractères qu'un opérateur accepte", () => {
    // Paystack et Flutterwave restreignent le jeu de caractères d'une
    // référence. Un préfixe avec un tiret bas passerait ici et serait refusé
    // à l'ouverture, en production seulement.
    expect(referenceDe("clx1")).toMatch(/^[A-Za-z0-9.=-]+$/);
  });
});
