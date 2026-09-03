/**
 * La file de modération, contre la vraie base.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS PROPRIÉTÉS QUI NE SE VOIENT PAS
 *
 *   — **deux modérateurs ne tranchent pas deux fois.** Ils peuvent avoir ouvert
 *     la même offre ; seul le premier doit décider ;
 *   — **un refus laisse toujours un motif.** Trois mois plus tard, devant
 *     l'annonceur qui écrit pour comprendre, c'est la seule chose qu'on ait ;
 *   — **chaque décision laisse une trace.** Un audit troué ne vaut rien, et
 *     c'est précisément sur les décisions contestées qu'on vient le lire.
 */

import { describe, expect, it } from "vitest";

import { dernieresTraces, ressource } from "@/lib/admin/audit";
import { estPublic } from "@/lib/cms/cycle";
import { combienAttendent, fileDeModeration } from "@/lib/cms/moderation";
import { db } from "@/lib/db";
import { marquerVerifiee, trancher } from "@/lib/jobs/moderation";

let n = 0;

async function moderateur() {
  n += 1;
  return db.user.create({
    data: {
      email: `mod-${n}@baobart.test`,
      platformRole: "MODERATOR",
      profile: { create: { username: `mod-${n}`, displayName: `Mod ${n}` } },
    },
    select: { id: true },
  });
}

async function offreSoumise(options: { url?: string } = {}) {
  n += 1;
  const auteur = await db.user.create({
    data: {
      email: `recruteur-${n}@baobart.test`,
      profile: {
        create: { username: `recruteur-${n}`, displayName: `Studio ${n}` },
      },
    },
    select: { id: true },
  });

  return db.jobPosting.create({
    data: {
      recruiterId: auteur.id,
      title: `Illustrateur ${n}`,
      description:
        "Une description assez longue pour être acceptée par la validation.",
      type: "FREELANCE",
      mode: "REMOTE",
      state: "SOUMIS",
      applyMode: options.url ? "EXTERNE" : "BAOBART",
      applyUrl: options.url ?? null,
    },
    select: { id: true },
  });
}

describe("la file", () => {
  it("ne montre que ce qui attend", async () => {
    await offreSoumise();
    const publiee = await offreSoumise();
    await db.jobPosting.update({
      where: { id: publiee.id },
      data: { state: "PUBLIE" },
    });

    expect(await fileDeModeration()).toHaveLength(1);
    expect(await combienAttendent()).toBe(1);
  });

  it("rend l'adresse externe en entier", async () => {
    // Une URL tronquée dans une file de modération est une URL qu'on approuve
    // sans l'avoir lue — le vecteur d'arnaque exact qu'on cherche à arrêter.
    const url =
      "https://recruteur.example/offres/tres/longue/adresse?ref=abcdefghijklmnop";
    await offreSoumise({ url });

    const file = await fileDeModeration();
    expect(file[0]!.urlExterne).toBe(url);
  });

  it("sort le plus ancien d'abord", async () => {
    // Une file se vide du plus ancien. Trier à l'envers ferait vieillir
    // indéfiniment les offres du bas.
    const vieille = await offreSoumise();
    await db.jobPosting.update({
      where: { id: vieille.id },
      data: { createdAt: new Date(Date.now() - 86_400_000) },
    });
    await offreSoumise();

    const file = await fileDeModeration();
    expect(file[0]!.id).toBe(vieille.id);
  });
});

describe("trancher", () => {
  it("publie, et l'offre devient visible", async () => {
    const qui = await moderateur();
    const offre = await offreSoumise();

    const suite = await trancher({
      offreId: offre.id,
      geste: "publier",
      moderateurId: qui.id,
    });
    expect(suite).toEqual({ ok: true, vers: "PUBLIE" });

    const apres = await db.jobPosting.findUniqueOrThrow({
      where: { id: offre.id },
      select: { state: true, deadline: true, moderatorId: true },
    });
    expect(estPublic(apres.state, apres.deadline)).toBe(true);
    expect(apres.moderatorId).toBe(qui.id);
  });

  it("exige un motif pour refuser", async () => {
    const qui = await moderateur();
    const offre = await offreSoumise();

    expect(
      await trancher({
        offreId: offre.id,
        geste: "refuser",
        moderateurId: qui.id,
      }),
    ).toEqual({ ok: false, motif: "MOTIF_REQUIS" });

    // Et l'offre n'a pas bougé : un refus sans motif ne doit rien écrire.
    const apres = await db.jobPosting.findUniqueOrThrow({
      where: { id: offre.id },
      select: { state: true },
    });
    expect(apres.state).toBe("SOUMIS");
  });

  it("écrit le motif, et l'efface si l'offre est finalement publiée", async () => {
    const qui = await moderateur();
    const offre = await offreSoumise();

    await trancher({
      offreId: offre.id,
      geste: "refuser",
      moderateurId: qui.id,
      motif: "Aucune entreprise identifiable.",
    });

    let apres = await db.jobPosting.findUniqueOrThrow({
      where: { id: offre.id },
      select: { state: true, refusedReason: true },
    });
    expect(apres.state).toBe("REFUSE");
    expect(apres.refusedReason).toContain("identifiable");

    // Reprise puis publication : garder l'ancien motif ferait afficher
    // « refusée pour X » sur une offre en ligne.
    await trancher({
      offreId: offre.id,
      geste: "reprendre",
      moderateurId: qui.id,
    });
    await trancher({
      offreId: offre.id,
      geste: "publier",
      moderateurId: qui.id,
    });

    apres = await db.jobPosting.findUniqueOrThrow({
      where: { id: offre.id },
      select: { state: true, refusedReason: true },
    });
    expect(apres.state).toBe("PUBLIE");
    expect(apres.refusedReason).toBeNull();
  });

  it("ne laisse pas deux modérateurs trancher la même offre", async () => {
    // Ils peuvent l'avoir ouverte tous les deux. La condition d'état vit dans
    // le `WHERE` : le second repart sans rien casser.
    const un = await moderateur();
    const deux = await moderateur();
    const offre = await offreSoumise();

    const premier = await trancher({
      offreId: offre.id,
      geste: "publier",
      moderateurId: un.id,
    });
    const second = await trancher({
      offreId: offre.id,
      geste: "refuser",
      moderateurId: deux.id,
      motif: "Trop tard.",
    });

    expect(premier.ok).toBe(true);
    expect(second).toEqual({ ok: false, motif: "TRANSITION_INTERDITE" });

    const apres = await db.jobPosting.findUniqueOrThrow({
      where: { id: offre.id },
      select: { state: true, moderatorId: true },
    });
    expect(apres.state).toBe("PUBLIE");
    expect(apres.moderatorId).toBe(un.id);
  });

  it("refuse une transition que la machine n'autorise pas", async () => {
    const qui = await moderateur();
    const offre = await offreSoumise();

    // On ne « reprend » pas une offre en relecture : elle n'a pas été refusée.
    expect(
      await trancher({
        offreId: offre.id,
        geste: "reprendre",
        moderateurId: qui.id,
      }),
    ).toEqual({ ok: false, motif: "TRANSITION_INTERDITE" });
  });

  it("consigne chaque décision", async () => {
    const qui = await moderateur();
    const offre = await offreSoumise();

    await trancher({
      offreId: offre.id,
      geste: "refuser",
      moderateurId: qui.id,
      motif: "Demande de l'argent au candidat.",
    });

    const traces = await dernieresTraces({
      ressource: ressource("job", offre.id),
    });
    expect(traces).toHaveLength(1);
    expect(traces[0]!.action).toBe("contenu.refuser");
    expect(traces[0]!.details).toMatchObject({ vers: "REFUSE" });
  });
});

describe("le badge Offre vérifiée", () => {
  it("se pose et se retire, et laisse une trace", async () => {
    // Il ne dit pas « publiée » — toute offre en ligne l'est. Il dit qu'un
    // humain est allé vérifier. Un badge que tout le monde porte ne protège
    // plus personne, d'où le fait qu'il se retire.
    const qui = await moderateur();
    const offre = await offreSoumise();

    await marquerVerifiee({
      offreId: offre.id,
      moderateurId: qui.id,
      verifiee: true,
    });
    expect(await estVerifiee(offre.id)).toBe(true);

    await marquerVerifiee({
      offreId: offre.id,
      moderateurId: qui.id,
      verifiee: false,
    });
    expect(await estVerifiee(offre.id)).toBe(false);

    const traces = await dernieresTraces({
      ressource: ressource("job", offre.id),
    });
    expect(traces).toHaveLength(2);
  });

  it("ne publie pas l'offre au passage", async () => {
    // Vérifier et publier sont deux gestes. Les confondre ferait paraître une
    // offre que personne n'a décidé de publier.
    const qui = await moderateur();
    const offre = await offreSoumise();

    await marquerVerifiee({
      offreId: offre.id,
      moderateurId: qui.id,
      verifiee: true,
    });

    const apres = await db.jobPosting.findUniqueOrThrow({
      where: { id: offre.id },
      select: { state: true },
    });
    expect(apres.state).toBe("SOUMIS");
  });
});

async function estVerifiee(id: string): Promise<boolean> {
  const o = await db.jobPosting.findUniqueOrThrow({
    where: { id },
    select: { isVerified: true },
  });
  return o.isVerified;
}
