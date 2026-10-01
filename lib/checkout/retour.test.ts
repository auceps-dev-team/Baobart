import { describe, expect, it } from "vitest";

import { MESSAGES, type MotifRefus } from "@/lib/checkout/achat";
import { texteDuRetour } from "@/lib/checkout/retour";
import { MESSAGES_MONTANT } from "@/lib/commerce/montant";
import { formatMoney } from "@/lib/i18n/money";

describe("le retour d'un achat sur la fiche", () => {
  it("a un texte pour chaque motif que le tunnel peut renvoyer", () => {
    // Le défaut mesuré le 25/09 : trois motifs revenaient sans un mot.
    for (const motif of Object.keys(MESSAGES) as MotifRefus[]) {
      expect(texteDuRetour(motif), motif).toBeTruthy();
    }
  });

  it("dit pourquoi un montant est refusé, avec le minimum", () => {
    expect(texteDuRetour("MONTANT_REFUSE", "TROP_BAS", "2000")).toBe(
      `${MESSAGES_MONTANT.TROP_BAS} Le minimum est de ${formatMoney(2_000)}.`,
    );
    expect(texteDuRetour("MONTANT_REFUSE", "INVALIDE")).toBe(MESSAGES_MONTANT.INVALIDE);
    expect(texteDuRetour("MONTANT_REFUSE", "POURBOIRE_TROP_HAUT")).toBe(
      MESSAGES_MONTANT.POURBOIRE_TROP_HAUT,
    );
  });

  it("retombe sur le message général quand le détail manque ou est forgé", () => {
    expect(texteDuRetour("MONTANT_REFUSE")).toBe(MESSAGES.MONTANT_REFUSE);
    expect(texteDuRetour("MONTANT_REFUSE", "toString")).toBe(MESSAGES.MONTANT_REFUSE);
    expect(texteDuRetour("MONTANT_REFUSE", "TROP_BAS", "abc")).toBe(MESSAGES_MONTANT.TROP_BAS);
  });

  it("ne dit rien d'un code inconnu, même hérité d'Object", () => {
    expect(texteDuRetour("n-importe-quoi")).toBeNull();
    expect(texteDuRetour("toString")).toBeNull();
    expect(texteDuRetour("constructor")).toBeNull();
  });
});
