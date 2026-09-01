import { describe, expect, it } from "vitest";

import {
  PAYS,
  PAYS_PAR_DEFAUT,
  RAILS,
  demandeLeTelephone,
  motDuTelephone,
  paysDe,
  paysValide,
  railValide,
  railsDe,
} from "@/lib/payments/rails";

describe("le choix du pays", () => {
  it("retombe sur le pays par défaut sur une valeur inconnue", () => {
    // La valeur vient d'une URL : elle est fournie par l'appelant, donc
    // n'importe quoi peut y arriver.
    expect(paysValide("XX")).toBe(PAYS_PAR_DEFAUT);
    expect(paysValide(undefined)).toBe(PAYS_PAR_DEFAUT);
    expect(paysValide("")).toBe(PAYS_PAR_DEFAUT);
  });

  it("garde un pays connu", () => {
    expect(paysValide("SN")).toBe("SN");
    expect(paysDe("SN").label).toBe("Sénégal");
    expect(paysDe("GH").devise).toBe("GHS");
  });
});

describe("les rails proposés", () => {
  it("n'offre jamais un opérateur absent du pays", () => {
    // « Un opérateur grisé ne sert à rien » : montrer Orange Money au Ghana
    // fait essayer, échouer, et croire que Baobart est cassé.
    const ghana = railsDe("GH").map((r) => r.code);
    expect(ghana).not.toContain("om");
    expect(ghana).not.toContain("wave");
    expect(ghana).toContain("mtn");
  });

  it("offre la carte partout : elle ne dépend d'aucun opérateur local", () => {
    for (const p of PAYS) {
      expect(railsDe(p.code).map((r) => r.code), p.label).toContain("carte");
    }
  });

  it("ne propose jamais une liste vide", () => {
    // Un pays sans rail donnerait un écran de paiement sans bouton.
    for (const p of PAYS) {
      expect(railsDe(p.code).length, p.label).toBeGreaterThan(0);
    }
  });

  it("ne nomme que des rails déclarés", () => {
    const connus = RAILS.map((r) => r.code);
    for (const p of PAYS) {
      for (const r of railsDe(p.code)) {
        expect(connus, `${p.label} → ${r.code}`).toContain(r.code);
      }
    }
  });

  it("retombe sur le premier rail du pays quand le choix est absurde", () => {
    expect(railValide("GH", "wave")).not.toBe("wave");
    expect(railsDe("GH").map((r) => r.code)).toContain(railValide("GH", "wave"));
    expect(railValide("CI", "om")).toBe("om");
  });
});

describe("le numéro de téléphone", () => {
  it("n'est jamais demandé pour une carte", () => {
    expect(demandeLeTelephone("flutterwave", "carte")).toBe(false);
    expect(demandeLeTelephone("paystack", "carte")).toBe(false);
  });

  it("n'est pas demandé par Paystack, qui le réclame sur sa propre page", () => {
    // Le réclamer d'abord ferait saisir deux fois la même chose, et nous
    // donnerait une donnée personnelle dont nous n'avons aucun usage.
    expect(demandeLeTelephone("paystack", "om")).toBe(false);
    expect(motDuTelephone("paystack", "om")).toContain("On ne le conserve pas");
  });

  it("est demandé par Flutterwave, qui en a besoin avant d'ouvrir", () => {
    expect(demandeLeTelephone("flutterwave", "om")).toBe(true);
    // Le mot explique pourquoi : c'est le numéro qui désigne le réseau.
    expect(motDuTelephone("flutterwave", "om")).toContain("réseau");
  });

  it("explique aussi son absence, plutôt que de ne rien dire", () => {
    expect(motDuTelephone("paystack", "carte").length).toBeGreaterThan(20);
  });
});
