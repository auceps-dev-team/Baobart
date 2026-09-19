import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Chaque route d'ordonnanceur a un horaire, et chaque horaire une route.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE TEST EXISTE PARCE QUE LE CAS S'EST PRODUIT
 *
 * v1.53.1 a livré la publication planifiée du blog : le code, l'écran, la
 * colonne `publishedAt`, la route `/api/cron/blog`, et des tests qui passaient.
 * Il manquait une ligne dans `vercel.json`.
 *
 * Personne ne s'en est aperçu pendant six versions. Rien ne plantait — la
 * route existait, répondait, et attendait un appel que personne ne faisait.
 * Un article planifié restait simplement en brouillon pour toujours, et la
 * seule façon de le remarquer était qu'un auteur s'en plaigne.
 *
 * C'est le défaut qui **réussit en ne faisant rien** : le plus coûteux, parce
 * que rien ne le signale.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA VÉRIFICATION VA DANS LES DEUX SENS
 *
 * Une route sans horaire est du code mort qu'on croit vivant. Un horaire sans
 * route est un appel qui rend 404 toutes les heures, et une alerte
 * d'ordonnanceur que l'équipe apprend à ignorer.
 *
 * Les deux se valent, et aucune ne se voit à la lecture d'un diff — les deux
 * fichiers sont dans des dossiers différents.
 */

const RACINE = join(process.cwd(), "app", "api", "cron");

/** Les dossiers de `app/api/cron/` qui portent une vraie route. */
function routesDeclarees(): string[] {
  return readdirSync(RACINE, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((nom) => {
      try {
        readFileSync(join(RACINE, nom, "route.ts"));
        return true;
      } catch {
        // Un dossier sans `route.ts` n'est pas une route : Next ne le sert
        // pas, et l'exiger dans `vercel.json` créerait un 404 périodique.
        return false;
      }
    })
    .sort();
}

interface Cron {
  path: string;
  schedule: string;
}

function cronsPlanifies(): Cron[] {
  const brut = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
  return (JSON.parse(brut) as { crons?: Cron[] }).crons ?? [];
}

describe("l'ordonnanceur", () => {
  it("planifie toutes les routes de `app/api/cron/`", () => {
    // Le sens qui a manqué en v1.53.1.
    const routes = routesDeclarees();
    const planifiees = cronsPlanifies()
      .map((c) => c.path.replace("/api/cron/", ""))
      .sort();

    expect(planifiees).toEqual(routes);
  });

  it("ne planifie aucune route qui n'existe pas", () => {
    // L'autre sens : un 404 périodique, et une alerte qu'on apprend à ignorer.
    const routes = new Set(routesDeclarees());

    for (const cron of cronsPlanifies()) {
      expect(routes, cron.path).toContain(cron.path.replace("/api/cron/", ""));
    }
  });

  it("donne à chacune un horaire cron à cinq champs", () => {
    // Une faute de frappe dans l'expression ne se voit qu'en production, et
    // seulement par l'absence de passage.
    for (const cron of cronsPlanifies()) {
      const champs = cron.schedule.trim().split(/\s+/);
      expect(champs, `${cron.path} : « ${cron.schedule} »`).toHaveLength(5);
    }
  });

  it("garde le passage des courriels plus fréquent que les autres", () => {
    // C'est la file d'envoi : un message qui attend une heure est un reçu
    // d'achat qui arrive une heure après l'achat. Les autres passages portent
    // des échéances en jours.
    const parChemin = new Map(cronsPlanifies().map((c) => [c.path, c.schedule]));

    expect(parChemin.get("/api/cron/courriels")).toMatch(/^\*\/\d+ /);
  });
});
