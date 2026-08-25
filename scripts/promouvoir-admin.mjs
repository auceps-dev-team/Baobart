/**
 * Nomme ou révoque un administrateur.
 *
 * Aucun écran ne fait ce travail, et c'est délibéré : un formulaire capable
 * d'élever un compte est une cible: il suffit d'une faille d'autorisation pour
 * que n'importe qui devienne super administrateur. Passer par ce script exige
 * un accès à la base — quelqu'un qui l'a déjà n'a plus rien à gagner à
 * l'exploiter.
 *
 *   node scripts/promouvoir-admin.mjs <email> [MEMBER|ADMIN|SUPER_ADMIN]
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";

if (existsSync(".env")) process.loadEnvFile(".env");

const ROLES = ["MEMBER", "ADMIN", "SUPER_ADMIN"];
const [email, role = "ADMIN"] = process.argv.slice(2);

if (!email) {
  console.error("Usage : node scripts/promouvoir-admin.mjs <email> [role]");
  process.exit(1);
}
if (!ROLES.includes(role)) {
  console.error(`Rôle inconnu « ${role} ». Attendu : ${ROLES.join(", ")}.`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

try {
  const avant = await db.user.findUnique({
    where: { email },
    select: { id: true, platformRole: true },
  });

  if (!avant) {
    console.error(`Aucun compte pour « ${email} ».`);
    process.exit(1);
  }

  if (avant.platformRole === role) {
    console.log(`« ${email} » est déjà ${role}. Rien à faire.`);
    process.exit(0);
  }

  await db.user.update({ where: { email }, data: { platformRole: role } });

  // Les sessions ouvertes portent l'ancien rôle jusqu'à leur prochaine lecture.
  // Une révocation qui met trente jours à prendre effet n'est pas une
  // révocation : on ferme tout, la personne se reconnecte.
  const { count } = await db.session.deleteMany({ where: { userId: avant.id } });

  console.log(`« ${email} » : ${avant.platformRole} → ${role}.`);
  console.log(`${count} session(s) fermée(s) — reconnexion nécessaire.`);
} finally {
  await db.$disconnect();
}
