import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  LARGEUR_APERCU,
  LARGEUR_VIGNETTE,
  QUALITE_APERCU,
  QUALITE_VIGNETTE,
} from "@/lib/upload/apercu";
import {
  filigraner,
  optionsDuTexte,
  POLICE_FILIGRANE,
  texteDuFiligrane,
  tuileDeFiligrane,
} from "@/lib/upload/filigrane";

/**
 * Les tests qui passent par sharp traitent de vraies images, et ce travail
 * dépend de la charge de la machine.
 *
 * Mesuré le 09/10 : seul, ce fichier tourne en 1,6 s. Dans la suite unitaire
 * complète (90 fichiers sur 4 cœurs), « se voit sur une image claire » a
 * dépassé les 5 s par défaut, et le fichier a pris 7,7 s. L'échec visait donc
 * du code juste : la charge, pas une régression.
 *
 * Trente secondes ici plutôt que dans `vitest.config.ts`, comme dans
 * `lib/auth/password.test.ts` : le reste de la suite garde un délai serré,
 * pour qu'une vraie boucle infinie se signale vite.
 */
const LENT = { timeout: 30_000 };

/** Une image unie : tout écart vient du filigrane. */
function unie(largeur: number, hauteur: number, gris: number): Promise<Buffer> {
  return sharp({
    create: { width: largeur, height: hauteur, channels: 3, background: { r: gris, g: gris, b: gris } },
  })
    .png()
    .toBuffer();
}

/** Combien de pixels ont bougé, en part de l'image. */
async function partModifiee(avant: Buffer, apres: Buffer): Promise<number> {
  const a = await sharp(avant).removeAlpha().raw().toBuffer();
  const b = await sharp(apres).removeAlpha().raw().toBuffer();
  let bouges = 0;
  for (let i = 0; i < a.length; i += 3) {
    if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) > 12) {
      bouges += 1;
    }
  }
  return bouges / (a.length / 3);
}

describe("le texte du filigrane", () => {
  it("porte le pseudo du créateur, puis Baobart", () => {
    expect(texteDuFiligrane("awa-design")).toBe("@awa-design · Baobart");
  });

  it("se contente de Baobart sans pseudo", () => {
    expect(texteDuFiligrane(null)).toBe("Baobart");
    expect(texteDuFiligrane("   ")).toBe("Baobart");
  });

  it("retire ce qui casserait le balisage de sharp", () => {
    // Un `<` ou un `&` dans le balisage Pango rend le texte vide — en silence.
    expect(texteDuFiligrane("<b>awa&co</b>")).toBe("@bawacob · Baobart");
  });
});

describe("le filigrane posé sur une image", LENT, () => {
  it.each([
    ["claire", 245],
    ["sombre", 15],
  ])("se voit sur une image %s", async (_nom, gris) => {
    // Blanc sur ombre noire : une seule couleur disparaîtrait sur un fond de
    // la même couleur.
    const image = await unie(800, 600, gris);
    const marquee = await filigraner(image, texteDuFiligrane("awa-design"));

    expect(await sharp(marquee).metadata()).toMatchObject({ width: 800, height: 600 });
    // Mesuré le 09/10 : 2,4 % des pixels sur fond clair (le blanc s'y fond,
    // l'ombre porte la lecture), davantage sur fond sombre.
    expect(await partModifiee(image, marquee)).toBeGreaterThan(0.015);
  });

  it("couvre aussi le bas et la droite de l'image, pas seulement une tuile", async () => {
    const image = await unie(800, 1200, 128);
    const marquee = await filigraner(image, "Baobart");
    const coin = (img: Buffer) =>
      sharp(img).extract({ left: 400, top: 800, width: 400, height: 400 }).png().toBuffer();

    expect(await partModifiee(await coin(image), await coin(marquee))).toBeGreaterThan(0.02);
  });

  it("ne casse pas sur une vignette plus petite que le motif", async () => {
    const image = await unie(40, 30, 200);
    const marquee = await filigraner(image, texteDuFiligrane("un-pseudo-assez-long-pour-deborder"));
    expect(await sharp(marquee).metadata()).toMatchObject({ width: 40, height: 30 });
  });
});

describe("la police embarquée", () => {
  it("est dans le dépôt, avec sa licence", () => {
    expect(existsSync(POLICE_FILIGRANE)).toBe(true);
    expect(existsSync(join(process.cwd(), "assets", "polices", "OFL.txt"))).toBe(true);
  });

  it("est copiée dans l'image Docker", async () => {
    // Le mode « standalone » ne copie que ce que la compilation a tracé ; une
    // police lue à l'exécution n'en fait pas partie.
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(join(process.cwd(), "Dockerfile"), "utf8")).toMatch(
      /COPY --from=builder[^\n]*\/app\/assets \.\/assets/,
    );
  });

  // Trois processus Node, qui chargent chacun sharp : le plus lent du fichier.
  it("dessine le même texte sans aucune police système — comme sous Alpine", LENT, () => {
    // Mesuré le 09/10 : sous une configuration fontconfig vide, une police
    // demandée par son nom sort en carrés vides, sans erreur. Le rendu se fait
    // avec les options EXACTES du module (`optionsDuTexte`) : retirer leur
    // `fontfile` fait tomber ce test.
    const dossier = mkdtempSync(join(tmpdir(), "fc-vide-"));
    const conf = join(dossier, "fonts.conf");
    writeFileSync(
      conf,
      `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><cachedir>${dossier}</cachedir></fontconfig>`,
    );

    const rendu = (options: object, env: NodeJS.ProcessEnv) =>
      spawnSync(
        process.execPath,
        [
          "-e",
          `require("sharp")({ text: ${JSON.stringify(options)} })` +
            `.raw().toBuffer({ resolveWithObject: true })` +
            `.then(({ info }) => process.stdout.write(String(info.width)))`,
        ],
        { cwd: process.cwd(), env, encoding: "utf8" },
      ).stdout;

    const options = optionsDuTexte("@awa · Baobart", "#000000", 24);
    const sansPolice = { ...process.env, FONTCONFIG_FILE: conf };

    const ici = rendu(options, process.env);
    const alpine = rendu(options, sansPolice);
    const parNom = rendu({ text: "@awa · Baobart", font: "sans bold 24", dpi: 72, rgba: true }, sansPolice);

    expect(Number(ici)).toBeGreaterThan(0);
    // Mêmes glyphes sans aucune police système : même largeur au pixel près.
    // (La hauteur peut varier d'un pixel — l'interligne vient de la
    // configuration système : 184 × 24 ici, 184 × 23 sans, mesuré le 09/10.)
    expect(alpine).toBe(ici);
    // Une police demandée par son nom, elle, sort en carrés d'une autre largeur.
    expect(parNom).not.toBe(ici);
  });
});

describe("la tuile du motif", LENT, () => {
  it("est transparente autour du texte", async () => {
    const tuile = await tuileDeFiligrane("Baobart", 800);
    const { channels } = await sharp(tuile).stats();
    expect(channels[3]!.min).toBe(0);
    expect(channels[3]!.max).toBeGreaterThan(0);
    // Jamais opaque : le filigrane laisse voir l'image.
    expect(channels[3]!.max).toBeLessThan(255);
  });
});

describe("l'aperçu public", () => {
  it("suit la spec : 800 px q60 pour la fiche, 400 px q65 pour le fil", () => {
    expect([LARGEUR_APERCU, QUALITE_APERCU]).toEqual([800, 60]);
    expect([LARGEUR_VIGNETTE, QUALITE_VIGNETTE]).toEqual([400, 65]);
  });
});
