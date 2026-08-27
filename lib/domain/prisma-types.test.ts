import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Le miroir des enums Prisma ne doit pas dériver du schéma.
 *
 * `prisma-types.ts` recopie à la main des unions que le code partagé doit
 * pouvoir contrôler avant même `prisma generate`. Le procédé est justifié, mais
 * il a un défaut connu : rien n'oblige la copie à suivre l'original. Une valeur
 * ajoutée au schéma et oubliée ici ne se voit qu'au moment où quelqu'un essaie
 * de l'employer — et le message parle d'une assignation impossible, pas d'un
 * miroir périmé. C'est arrivé en ajoutant les mouvements de litige.
 *
 * Ce test lit les deux et compare. Il coûte quelques millisecondes et change
 * une énigme en échec explicite.
 */

const RACINE = process.cwd();

const SCHEMA = readFileSync(
  path.join(RACINE, "prisma/schema.prisma"),
  "utf8",
);
const MIROIR = readFileSync(
  path.join(RACINE, "lib/domain/prisma-types.ts"),
  "utf8",
);

/** Les valeurs d'un enum du schéma, commentaires et accolades retirés. */
function valeursDuSchema(nom: string): string[] {
  const bloc = new RegExp(`enum ${nom} \\{([^}]*)\\}`).exec(SCHEMA);
  if (!bloc) throw new Error(`enum ${nom} absente du schéma`);

  return bloc[1]!
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter((l) => l.length > 0 && !l.startsWith("///") && !l.startsWith("@"));
}

/** Les membres d'une union de chaînes du miroir. */
function valeursDuMiroir(nom: string): string[] {
  const bloc = new RegExp(`export type ${nom} =([\\s\\S]*?);`).exec(MIROIR);
  if (!bloc) throw new Error(`type ${nom} absent du miroir`);

  return [...bloc[1]!.matchAll(/"([A-Z_0-9]+)"/g)].map((m) => m[1]!);
}

/**
 * Les enums que le miroir prétend refléter.
 *
 * Ajouter une entrée ici quand on ajoute un type au miroir : c'est le seul
 * geste manuel qui reste, et il est visible.
 */
const REFLETES = [
  "Currency",
  "LicenseCode",
  "BalanceTransactionType",
  "PayoutStatus",
  "ProductStatus",
  "PurchaseState",
  "OrderStatus",
  "BalanceState",
] as const;

describe("miroir des enums Prisma", () => {
  const presentes = REFLETES.filter((nom) => {
    try {
      valeursDuMiroir(nom);
      return true;
    } catch {
      return false;
    }
  });

  it("reflète au moins les enums de l'argent", () => {
    // Si quelqu'un retire l'un de ces types du miroir, le test suivant ne
    // vérifierait plus rien sans que personne ne s'en aperçoive.
    expect(presentes).toContain("BalanceTransactionType");
    expect(presentes).toContain("Currency");
  });

  it.each(presentes)("%s dit exactement ce que dit le schéma", (nom) => {
    const attendues = valeursDuSchema(nom).sort();
    const copiees = valeursDuMiroir(nom).sort();

    expect(copiees).toEqual(attendues);
  });
});
