import { describe, expect, it } from "vitest";

import { formatMoney } from "@/lib/i18n/money";
import { tientEnGsm7, segments } from "@/lib/sms/gsm7";
import { texteRelance } from "@/lib/sms/relance";
import type { Message } from "@/lib/ndank/ports";

const BASE: Message = {
  cle: "abc-j0",
  destinataire: "Awa",
  offre: "Pass Découverte",
  montant: formatMoney(2_000, "XOF"),
  lien: "https://baobart.ci/abonnement/clx123456789/renouveler",
  joursRestants: 3,
  dernier: false,
};

describe("le texte de relance", () => {
  it("tient en un seul segment", () => {
    // C'est la contrainte qui décide de tout le reste. Deux segments, c'est le
    // double du budget SMS de Ndank pour rien.
    const t = texteRelance(BASE);
    expect(segments(t)).toBe(1);
  });

  it("part en GSM-7, malgré l'espace fine du montant", () => {
    // `formatMoney` insère une espace fine insécable. Sans repli, chaque
    // relance basculerait en UCS-2 : 70 caractères par segment au lieu de 160,
    // donc deux segments pour ce même texte.
    expect(tientEnGsm7(BASE.montant)).toBe(false);
    expect(tientEnGsm7(texteRelance(BASE))).toBe(true);
  });

  it("dit combien de jours il reste, le montant, et où valider", () => {
    const t = texteRelance(BASE);
    expect(t).toContain("Awa");
    expect(t).toContain("Pass");
    expect(t).toContain("3 jours");
    expect(t).toContain("2 000");
    expect(t).toContain(BASE.lien);
  });

  it("ne colle pas de point au lien", () => {
    // La moitié des combinés avaleraient le point dans l'URL, et la page
    // ouvrirait sur une 404 au moment précis où l'on demande de payer.
    expect(texteRelance(BASE).endsWith(BASE.lien)).toBe(true);
  });

  it("accorde le singulier", () => {
    expect(texteRelance({ ...BASE, joursRestants: 1 })).toContain("1 jour.");
  });

  it("change de phrase le jour de l'échéance", () => {
    const t = texteRelance({ ...BASE, joursRestants: 0 });
    expect(t).toContain("échéance");
    expect(t).not.toContain("0 jour");
  });

  it("change de phrase une fois l'accès coupé", () => {
    // Annoncer « expire dans -2 jours » à quelqu'un déjà suspendu est absurde,
    // et lui fait croire qu'il a encore le temps.
    const t = texteRelance({ ...BASE, joursRestants: -2, dernier: true });
    expect(t).toContain("suspendu");
    expect(t).not.toContain("-2");
  });

  it("se passe du prénom quand on ne l'a pas", () => {
    const t = texteRelance({ ...BASE, destinataire: "" });
    expect(t.startsWith("ton abonnement")).toBe(true);
  });

  it("tient encore en un segment avec un nom et une offre longs", () => {
    // Le cas qui fait déraper la facture sans qu'on le voie : rien n'échoue,
    // tout coûte double.
    const t = texteRelance({
      ...BASE,
      destinataire: "Mariam-Aïcha",
      offre: "Pass Créateur Annuel",
    });
    expect(segments(t)).toBe(1);
  });
});
