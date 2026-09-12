import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Un seul passage de tests d'intégration à la fois sur une base donnée.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE PROBLÈME, ET POURQUOI IL NE RESSEMBLE PAS À UN PROBLÈME
 *
 * `fileParallelism: false` sérialise les fichiers **d'un même passage**. Il ne
 * dit rien de deux passages lancés en parallèle : le bouton « relancer » de
 * l'éditeur pendant qu'un `pnpm test` tourne dans un terminal, deux fenêtres
 * ouvertes sur le même dépôt, un observateur resté actif.
 *
 * Les deux pointent alors sur `baobart_test`, et le `TRUNCATE` du second vide
 * les données que le premier est en train de lire. Les échecs qui en sortent
 * sont **des faux positifs parfaits** : ils désignent du code juste, changent
 * de fichier à chaque fois, et disparaissent quand on les rejoue seuls. On
 * cherche la régression pendant une heure, et il n'y en a pas.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ICI, ET SURTOUT PAS DANS `setupFiles`
 *
 * C'est la première version, et elle avait un défaut qui ne se voit qu'à
 * plusieurs fichiers : `setupFiles` s'exécute **une fois par worker**. Vitest
 * en ouvre plusieurs, et le second se serait heurté au verrou du premier — du
 * même passage. Le verrou aurait bloqué ce qu'il devait protéger.
 *
 * `globalSetup` s'exécute une fois, dans le processus principal, avant tout le
 * reste, et son `teardown` à la fin. C'est exactement la portée d'un verrou de
 * passage.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN VERROU DE FICHIER, ET NON UN VERROU POSTGRES
 *
 * `pg_try_advisory_lock` serait l'outil naturel — il meurt avec la session, et
 * ne laisse jamais de trace. Mais un verrou consultatif appartient à **une
 * connexion**, et Prisma en tient tout un lot : rien ne garantit que la
 * requête suivante reparte sur celle qui le détient.
 *
 * Le fichier, lui, est indépendant du client SQL. Sa faiblesse connue est la
 * trace laissée par un processus tué — d'où le PID qu'il contient : si le
 * processus nommé n'existe plus, le verrou est repris plutôt que d'exiger un
 * nettoyage à la main. Un verrou qu'il faut réparer à la main finit désarmé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA CLÉ EST L'URL DE LA BASE, PAS LE DOSSIER DU PROJET
 *
 * C'est ce qui rend le verrou juste quand plusieurs projets Node tournent
 * ensemble : deux dépôts qui visent deux bases ne se gênent pas, et deux
 * fenêtres du même dépôt se gênent — ce qui est exactement l'intention.
 */

let chemin: string | null = null;

export async function setup(): Promise<void> {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }

  const urlBase = process.env.DATABASE_URL_TEST ?? "baobart_test";
  const cle = createHash("sha256").update(urlBase).digest("hex").slice(0, 16);
  chemin = join(tmpdir(), `baobart-integration-${cle}.lock`);

  if (!prendre(chemin)) {
    const proprietaire = Number(lireOuVide(chemin));

    if (proprietaire && proprietaire !== process.pid && estVivant(proprietaire)) {
      chemin = null; // Ne pas libérer un verrou qui n'est pas à nous.
      throw new Error(
        [
          `Un autre passage de tests d'intégration tient déjà « ${urlBase} » (PID ${proprietaire}).`,
          "",
          "Deux passages sur la même base se vident mutuellement les tables :",
          "les échecs qui en sortent désignent du code juste. On s'arrête ici",
          "plutôt que de rendre un résultat faux.",
          "",
          "Attends la fin de l'autre passage, ou lance celui-ci sur une base à",
          "part : DATABASE_URL_TEST=…/baobart_test2 pnpm db:test:setup && pnpm test",
        ].join("\n"),
      );
    }

    // Le propriétaire n'existe plus : verrou abandonné par un processus tué.
    try {
      unlinkSync(chemin);
    } catch {
      // Quelqu'un vient peut-être de le reprendre. `prendre` va le dire.
    }

    if (!prendre(chemin)) {
      const perdu = chemin;
      chemin = null;
      throw new Error(
        `Impossible de prendre le verrou des tests d'intégration (${perdu}).`,
      );
    }
  }
}

export async function teardown(): Promise<void> {
  rendre();
}

function prendre(ou: string): boolean {
  try {
    // « wx » : créer, et échouer si le fichier existe. L'opération est
    // atomique — deux processus qui la tentent au même instant ne peuvent pas
    // réussir tous les deux.
    const fd = openSync(ou, "wx");
    writeSync(fd, String(process.pid));
    closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

function rendre(): void {
  if (chemin === null) return;
  try {
    if (lireOuVide(chemin) === String(process.pid)) unlinkSync(chemin);
  } catch {
    // Rien à faire de plus en sortie de processus.
  }
}

function lireOuVide(ou: string): string {
  try {
    return readFileSync(ou, "utf8").trim();
  } catch {
    return "";
  }
}

/** Le signal 0 ne tue rien : il demande seulement si le processus existe. */
function estVivant(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    // `EPERM` : il existe, mais appartient à quelqu'un d'autre. Il est vivant.
    return (cause as NodeJS.ErrnoException)?.code === "EPERM";
  }
}

// `teardown` couvre la fin normale du passage. Un Ctrl-C, lui, ne l'appelle
// pas : sans ces lignes, le verrou resterait, et le passage suivant devrait le
// reprendre après avoir constaté la mort du propriétaire. Ça marcherait, mais
// ça laisse une trace inutile dans le dossier temporaire.
process.on("exit", rendre);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => {
    rendre();
    process.exit(130);
  });
}
