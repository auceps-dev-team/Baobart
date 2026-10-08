import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BORNES, LIMITES_PAR_DEFAUT, parMinute, validerLimites } from "@/lib/publicites/limites";
import { cleDuPlafond, secretDuPlafond, sousLePlafond } from "@/lib/publicites/plafond";
import { verifierLimite } from "@/lib/securite/garde";
import { REGLES } from "@/lib/securite/limites";
import { oublierCompteurs } from "@/lib/securite/pilotes";

const AVANT = { pilote: process.env.RATE_LIMIT_DRIVER, secret: process.env.AUTH_SECRET };
const SECRET = "un-secret-de-plafond-assez-long";
beforeEach(() => {
  process.env.RATE_LIMIT_DRIVER = "memoire";
  process.env.AUTH_SECRET = SECRET;
  oublierCompteurs();
});
afterEach(() => {
  for (const [nom, valeur] of [
    ["RATE_LIMIT_DRIVER", AVANT.pilote],
    ["AUTH_SECRET", AVANT.secret],
  ] as const) {
    if (valeur === undefined) delete process.env[nom];
    else process.env[nom] = valeur;
  }
  oublierCompteurs();
});

const A = "cmg0aaaaaaaaaaaaaaaaaaaaa";
const B = "cmg0bbbbbbbbbbbbbbbbbbbbb";
const saisie = (s: Partial<Record<keyof typeof LIMITES_PAR_DEFAUT, string>> = {}) => ({
  vuesParMinute: "120",
  clicsParMinute: "30",
  vuesParVisiteurJour: "20",
  clicsParVisiteurJour: "1",
  ...s,
});

describe("les limites réglables", () => {
  it("reprennent pour défauts le débit de v1.71.0", () => {
    // Un réglage absent ne doit rien changer à ce qui tournait déjà.
    expect(LIMITES_PAR_DEFAUT.vuesParMinute).toBe(REGLES["pub.vues"].quota);
    expect(LIMITES_PAR_DEFAUT.clicsParMinute).toBe(REGLES["pub.clic"].quota);
  });

  it("refusent zéro, l'illisible et ce qui dépasse les bornes", () => {
    expect(validerLimites(saisie({ clicsParVisiteurJour: "0" }))).toMatchObject({ ok: false, champ: "clicsParVisiteurJour" });
    expect(validerLimites(saisie({ vuesParMinute: "beaucoup" }))).toMatchObject({ ok: false, champ: "vuesParMinute" });
    expect(validerLimites(saisie({ clicsParMinute: String(BORNES.clicsParMinute[1] + 1) }))).toMatchObject({ ok: false, champ: "clicsParMinute" });
    expect(validerLimites(saisie())).toEqual({ ok: true, limites: LIMITES_PAR_DEFAUT });
  });

  it("remplacent le quota écrit dans REGLES quand on les passe à la garde", async () => {
    const regle = parMinute(5);
    for (let i = 0; i < 5; i += 1) expect((await verifierLimite("pub.clic", "1.2.3.4", regle)).autorise).toBe(true);
    expect((await verifierLimite("pub.clic", "1.2.3.4", regle)).autorise).toBe(false);
  });
});

describe("le plafond par visiteur", () => {
  const jour = "2026-10-03";

  it("arrête de compter au plafond, sans toucher aux autres pubs ni aux autres adresses", async () => {
    // Le défaut de v1.71.0 : une même adresse faisait compter sans fin, au
    // seul rythme du débit.
    const ids = Array.from({ length: 25 }, () => A);
    const gardes = await sousLePlafond({ nature: "vue", sujet: "1.2.3.4", ids, plafond: 20, jour });
    expect(gardes).toHaveLength(20);

    expect(await sousLePlafond({ nature: "vue", sujet: "1.2.3.4", ids: [B], plafond: 20, jour })).toEqual([B]);
    expect(await sousLePlafond({ nature: "vue", sujet: "5.6.7.8", ids: [A], plafond: 20, jour })).toEqual([A]);
  });

  it("ne compte qu'un clic par adresse, par pub et par jour, par défaut", async () => {
    const plafond = LIMITES_PAR_DEFAUT.clicsParVisiteurJour;
    expect(await sousLePlafond({ nature: "clic", sujet: "1.2.3.4", ids: [A], plafond, jour })).toEqual([A]);
    expect(await sousLePlafond({ nature: "clic", sujet: "1.2.3.4", ids: [A], plafond, jour })).toEqual([]);
    // Le lendemain, la place se rouvre.
    expect(await sousLePlafond({ nature: "clic", sujet: "1.2.3.4", ids: [A], plafond, jour: "2026-10-04" })).toEqual([A]);
  });

  it("compte sans plafonner quand l'adresse manque", async () => {
    const ids = [A, A, A];
    expect(await sousLePlafond({ nature: "clic", sujet: null, ids, plafond: 1, jour })).toEqual(ids);
  });

  it("compte sans plafonner, et sans rien ranger, quand le secret manque", async () => {
    // Le défaut constaté le 08/10 : sans AUTH_SECRET, la clé était une
    // empreinte à clé vide — l'adresse se retrouvait en essayant les quatre
    // milliards d'IPv4, et rien ne le signalait.
    delete process.env.AUTH_SECRET;
    expect(await sousLePlafond({ nature: "clic", sujet: "1.2.3.4", ids: [A], plafond: 1, jour })).toEqual([A]);
    expect(await sousLePlafond({ nature: "clic", sujet: "1.2.3.4", ids: [A], plafond: 1, jour })).toEqual([A]);

    // Rien n'a été compté pendant l'absence : le secret revenu, la première
    // place est encore libre.
    process.env.AUTH_SECRET = SECRET;
    expect(await sousLePlafond({ nature: "clic", sujet: "1.2.3.4", ids: [A], plafond: 1, jour })).toEqual([A]);
    expect(await sousLePlafond({ nature: "clic", sujet: "1.2.3.4", ids: [A], plafond: 1, jour })).toEqual([]);
  });

  it("tient pour absent un secret vide ou trop court", () => {
    expect(secretDuPlafond({})).toBeNull();
    expect(secretDuPlafond({ AUTH_SECRET: "" })).toBeNull();
    expect(secretDuPlafond({ AUTH_SECRET: "   court   " })).toBeNull();
    expect(secretDuPlafond({ AUTH_SECRET: ` ${SECRET} ` })).toBe(SECRET);
  });

  it("ne range jamais l'adresse en clair dans la clé", () => {
    const cle = cleDuPlafond({ secret: "s", sujet: "196.47.12.8", pubId: A, jour, nature: "clic" });
    expect(cle).not.toContain("196.47.12.8");
    expect(cle).not.toBe(cleDuPlafond({ secret: "s", sujet: "196.47.12.8", pubId: A, jour: "2026-10-04", nature: "clic" }));
  });
});
