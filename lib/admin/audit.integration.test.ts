/**
 * Le journal d'audit, contre la vraie base.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE FICHIER EXISTE PARCE QUE LA TABLE ÉTAIT VIDE
 *
 * `AuditLog` était au schéma depuis le début du projet et aucun appel ne
 * l'avait jamais remplie. Un écran d'audit aurait affiché une liste vide — et
 * vide se lit « rien ne s'est passé », pas « on ne consigne rien ».
 *
 * Ces tests vérifient donc surtout deux choses qu'on ne voit pas :
 *
 *   — qu'on retrouve tout ce qui a touché une ressource, quel qu'en soit
 *     l'auteur ;
 *   — qu'un acteur supprimé laisse sa trace derrière lui.
 *
 * La troisième propriété — « consigner ne lève jamais » — vit dans
 * `audit.test.ts` : elle relève de la gestion d'erreur du module, pas de la
 * base, et l'éprouver ici demanderait d'espionner le client Prisma.
 */

import { describe, expect, it } from "vitest";

import { consigner, dernieresTraces, ressource } from "@/lib/admin/audit";
import { db } from "@/lib/db";

let n = 0;

async function administrateur(nom = "Awa") {
  n += 1;
  return db.user.create({
    data: {
      email: `audit-${n}@baobart.test`,
      platformRole: "ADMIN",
      profile: { create: { username: `audit-${n}`, displayName: `${nom} ${n}` } },
    },
    select: { id: true, email: true },
  });
}

describe("consigner", () => {
  it("écrit la trace", async () => {
    const qui = await administrateur();

    await consigner({
      acteurId: qui.id,
      action: "risque.changer",
      ressource: ressource("user", "clx-cible"),
      details: { de: "COMPLIANT", vers: "FLAGGED_FRAUD", motif: "signalement" },
    });

    const lignes = await dernieresTraces({ acteurId: qui.id });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      action: "risque.changer",
      ressource: "user:clx-cible",
    });
    expect(lignes[0]!.details).toMatchObject({ vers: "FLAGGED_FRAUD" });
  });

  it("rend les traces du plus récent au plus ancien", async () => {
    const qui = await administrateur();

    for (const action of ["courriel.rejouer", "courriel.abandonner"] as const) {
      await consigner({
        acteurId: qui.id,
        action,
        ressource: ressource("email", "clx-1"),
      });
    }

    const lignes = await dernieresTraces({ acteurId: qui.id });
    // Le plus récent d'abord : on ouvre un audit pour savoir ce qui vient de
    // se passer, pas ce qui s'est passé au début.
    expect(lignes[0]!.action).toBe("courriel.abandonner");
  });

  it("retrouve tout ce qui a touché une ressource", async () => {
    // La question qu'on pose vraiment à un audit : « qu'est-il arrivé à ce
    // compte ? » — d'où la ressource préfixée par son type.
    const un = await administrateur();
    const deux = await administrateur();
    const cible = ressource("user", "clx-cible");

    await consigner({ acteurId: un.id, action: "risque.changer", ressource: cible });
    await consigner({ acteurId: deux.id, action: "compte.suspendre", ressource: cible });
    await consigner({
      acteurId: un.id,
      action: "courriel.rejouer",
      ressource: ressource("email", "clx-autre"),
    });

    const lignes = await dernieresTraces({ ressource: cible });
    expect(lignes).toHaveLength(2);
    expect(lignes.map((l) => l.acteurId).sort()).toEqual([un.id, deux.id].sort());
  });

  it("nomme l'acteur à la lecture", async () => {
    const qui = await administrateur("Mariam");

    await consigner({
      acteurId: qui.id,
      action: "versement.rejouer",
      ressource: ressource("payout", "clx-1"),
    });

    const lignes = await dernieresTraces({ acteurId: qui.id });
    expect(lignes[0]!.acteur).toContain("Mariam");
  });

  it("garde la trace d'un compte disparu", async () => {
    // Un audit qui s'efface avec son auteur ne sert à rien : c'est précisément
    // quand quelqu'un est parti qu'on cherche ce qu'il a fait.
    const qui = await administrateur();

    await consigner({
      acteurId: qui.id,
      action: "compte.suspendre",
      ressource: ressource("user", "clx-cible"),
    });

    await db.user.delete({ where: { id: qui.id } });

    const lignes = await dernieresTraces({ acteurId: qui.id });
    expect(lignes).toHaveLength(1);
    // Le nom n'est plus résoluble, et la ligne le dit franchement.
    expect(lignes[0]!.acteur).toBeNull();
    expect(lignes[0]!.acteurId).toBe(qui.id);
  });

  it("borne ce qu'on peut demander d'un coup", async () => {
    // Sans plafond, un écran d'audit finirait par tirer la table entière.
    const qui = await administrateur();
    await consigner({
      acteurId: qui.id,
      action: "courriel.rejouer",
      ressource: ressource("email", "clx-1"),
    });

    const lignes = await dernieresTraces({ limite: 10_000 });
    expect(lignes.length).toBeLessThanOrEqual(500);
  });
});
