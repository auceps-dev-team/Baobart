import "server-only";

import { readdir } from "node:fs/promises";
import path from "node:path";

import { listerFournisseurs } from "@/lib/auth/providers";
import { etatDes } from "@/lib/config/fonctionnalites";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import {
  constatBase,
  constatConnexion,
  constatInterrupteurs,
  constatStockage,
  graviteGlobale,
  type Constat,
  type Gravite,
} from "@/lib/systeme/diagnostic";
import { stockageConfigure } from "@/lib/upload/storage";

/**
 * Collecte les faits que `diagnostic.ts` interprète.
 *
 * La séparation n'est pas décorative : les règles — une migration en retard est
 * une panne, un aperçu en HTTP aussi — sont exerçables par un test unitaire
 * parce qu'elles ne savent pas d'où viennent les faits. Ici on ne fait que
 * regarder, sans juger.
 */

export interface EtatPlateforme {
  gravite: Gravite;
  constats: Constat[];
  /** Modules dont les variables sont documentées mais dont le code n'existe pas. */
  aVenir: string[];
}

interface LigneMigration {
  migration_name: string;
  finished_at: Date | null;
}

/**
 * Migrations appliquées, et celles qui ont échoué en cours de route.
 *
 * Une ligne sans `finished_at` est une migration interrompue : la base est
 * alors dans un état intermédiaire que personne n'a voulu. C'est plus grave
 * qu'une migration jamais lancée, et ça ne se voit nulle part ailleurs.
 */
async function migrations(): Promise<{
  appliquees: Set<string>;
  interrompues: number;
} | null> {
  try {
    const lignes = await db.$queryRaw<LigneMigration[]>`
      SELECT migration_name, finished_at FROM "_prisma_migrations"
    `;
    return {
      appliquees: new Set(
        lignes.filter((l) => l.finished_at !== null).map((l) => l.migration_name),
      ),
      interrompues: lignes.filter((l) => l.finished_at === null).length,
    };
  } catch (cause) {
    journal.erreur("lecture des migrations impossible", { cause });
    return null;
  }
}

/**
 * Migrations présentes dans le dépôt.
 *
 * Renvoie `null` quand le dossier n'est pas lisible — ce qui arrive si le
 * traçage de fichiers de l'hébergeur ne l'a pas embarqué. Mieux vaut dire
 * « je ne sais pas » que compter zéro et afficher un vert rassurant.
 */
async function migrationsDuDepot(): Promise<string[] | null> {
  try {
    const entrees = await readdir(path.join(process.cwd(), "prisma/migrations"), {
      withFileTypes: true,
    });
    return entrees.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return null;
  }
}

/** Modules dont les variables sont documentées mais que rien ne lit encore. */
const A_VENIR = [
  "Passage en caisse",
  "Paiements (Wave, Orange Money, carte)",
  "Courriels transactionnels",
  "Envoi effectif des versements",
  "SMS (code à usage unique)",
];

export async function etatDeLaPlateforme(): Promise<EtatPlateforme> {
  const production = process.env.NODE_ENV === "production";

  const [etatMigrations, duDepot] = await Promise.all([
    migrations(),
    migrationsDuDepot(),
  ]);

  const joignable = etatMigrations !== null;

  // On ne compte un retard que si l'on a les deux listes. Sans le dossier, on
  // annonce zéro plutôt qu'un chiffre inventé — l'écran dira ce qu'il sait.
  const enAttente =
    etatMigrations && duDepot
      ? duDepot.filter((m) => !etatMigrations.appliquees.has(m)).length
      : 0;

  const constats: Constat[] = [
    constatBase({ joignable, enAttente }),
    constatStockage({
      configure: stockageConfigure(),
      urlPublique: process.env.S3_PUBLIC_URL ?? null,
      production,
    }),
    constatConnexion({
      actifs: listerFournisseurs()
        .filter((f) => f.actif)
        .map((f) => f.label),
      // Le mot de passe est toujours une voie d'entrée : `lib/auth/actions.ts`
      // l'implémente sans condition d'environnement.
      motDePasse: true,
    }),
    constatInterrupteurs({
      fermees: etatDes(process.env)
        .filter((f) => !f.ouverte)
        .map((f) => f.libelle),
    }),
  ];

  if (etatMigrations && etatMigrations.interrompues > 0) {
    constats.push({
      cle: "migrations-interrompues",
      libelle: "Migrations interrompues",
      gravite: "panne",
      detail: `${etatMigrations.interrompues} migration(s) commencée(s) sans jamais s'achever.`,
      remede:
        "La base est dans un état intermédiaire : inspecte `_prisma_migrations` avant tout déploiement.",
    });
  }

  if (etatMigrations && duDepot === null) {
    constats.push({
      cle: "migrations-dossier",
      libelle: "Dossier des migrations",
      gravite: "attention",
      detail: `${etatMigrations.appliquees.size} appliquée(s), mais le dépôt n'est pas lisible d'ici.`,
      remede: "Un retard de migration ne peut pas être détecté depuis cet hébergeur.",
    });
  }

  return {
    gravite: graviteGlobale(constats),
    constats,
    aVenir: A_VENIR,
  };
}
