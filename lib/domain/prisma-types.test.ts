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
 * Les types que le miroir définit, lus dans le miroir.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELLE ÉTAIT UNE LISTE À LA MAIN, ET ELLE MENTAIT
 *
 * Mesuré le 24 septembre 2026 : la liste écrite ici annonçait huit types ; le
 * miroir en définissait cinq, et le test en vérifiait **trois**. Les cinq
 * autres — `PayoutStatus`, `ProductStatus`, `PurchaseState`, `OrderStatus`,
 * `BalanceState` — étaient filtrés par un `try/catch` qui transformait
 * « absent du miroir » en « pas vérifié », sans un mot. Et deux types que le
 * miroir définit bel et bien, `ProductType` et `ProductFamily`, n'étaient pas
 * dans la liste, donc pas vérifiés non plus.
 *
 * Un garde-fou contre la dérive d'une liste recopiée, désamorcé par une liste
 * recopiée. Il a laissé passer exactement ce qu'il surveillait : `SUSPENDED`
 * ajouté à `ProductStatus` au schéma, et la copie du tableau de bord restée à
 * trois valeurs. C'est le typecheck qui l'a signalé, pas lui.
 *
 * Elle se lit donc dans le miroir. Il n'y a plus rien à tenir à jour, donc
 * plus rien à oublier.
 */
function typesDuMiroir(): string[] {
  return [...MIROIR.matchAll(/^export type ([A-Za-z]+) =/gm)].map((m) => m[1]!);
}

describe("miroir des enums Prisma", () => {
  const refletes = typesDuMiroir();

  it("reflète au moins les enums de l'argent", () => {
    // Si quelqu'un retire l'un de ces types du miroir, le test suivant ne
    // vérifierait plus rien sans que personne ne s'en aperçoive.
    expect(refletes).toContain("BalanceTransactionType");
    expect(refletes).toContain("Currency");
  });

  it("reflète tout ce que le miroir déclare, sans exception silencieuse", () => {
    // Le nombre est écrit pour qu'un type retiré du miroir se voie. Il montera
    // quand on en ajoutera un — et c'est le moment de vérifier que le schéma
    // porte bien l'enum du même nom.
    expect(refletes.length).toBeGreaterThanOrEqual(6);
  });

  it.each(refletes)("%s dit exactement ce que dit le schéma", (nom) => {
    // `valeursDuSchema` lève si l'enum n'existe pas : un type du miroir qui ne
    // reflète rien est une faute, pas un cas à sauter.
    const attendues = valeursDuSchema(nom).sort();
    const copiees = valeursDuMiroir(nom).sort();

    expect(copiees).toEqual(attendues);
  });
});
