import { NextResponse } from "next/server";

import { etatDes } from "@/lib/config/fonctionnalites";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { stockageConfigure } from "@/lib/upload/storage";

/**
 * Point de santé — ce qu'interroge une sonde de disponibilité.
 *
 * Une application qui répond « 200 » sur sa page d'accueil peut très bien avoir
 * perdu sa base : Next.js sert la coquille, et l'erreur n'apparaît qu'au
 * premier visiteur. Cette route va chercher la seule dépendance sans laquelle
 * plus rien ne fonctionne, et répond 503 quand elle manque — ce que les sondes
 * savent lire, contrairement à un message d'erreur dans une page.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'ELLE NE DIT PAS
 *
 * Elle est publique : pas de secret d'authentification, donc pas de détail
 * d'infrastructure. Ni nom d'hôte, ni bucket, ni version, ni message d'erreur
 * de la base — un message de connexion Postgres porte l'hôte et l'utilisateur.
 * Le diagnostic complet appartient à l'écran d'administration, quand il
 * existera, derrière un compte.
 */

export const dynamic = "force-dynamic";

/**
 * Au-delà, on considère la base perdue.
 *
 * Sans ce délai, une base qui accepte la connexion mais ne répond plus ferait
 * pendre la sonde jusqu'à la limite de la fonction : le moniteur verrait un
 * dépassement de délai, pas une panne, et la distinction change ce qu'on va
 * regarder en premier.
 */
const DELAI_BASE_MS = 3000;

async function baseJoignable(): Promise<boolean> {
  const sonde = db
    .$queryRaw`SELECT 1`
    .then(() => true)
    .catch((cause: unknown) => {
      journal.erreur("base injoignable au point de santé", { cause });
      return false;
    });

  const delai = new Promise<false>((resoudre) => {
    setTimeout(() => resoudre(false), DELAI_BASE_MS).unref?.();
  });

  return Promise.race([sonde, delai]);
}

export async function GET() {
  const base = await baseJoignable();
  const stockage = stockageConfigure();

  // Seule la base rend l'application inutilisable : sans stockage on ne peut
  // plus envoyer de fichiers, mais tout le reste — parcourir, se connecter,
  // télécharger ce qui est déjà en place — continue de fonctionner. Basculer
  // en 503 pour autant ferait sortir du service une application qui sert.
  const vivant = base;

  return NextResponse.json(
    {
      etat: vivant ? "ok" : "degrade",
      base: base ? "ok" : "injoignable",
      stockage: stockage ? "configure" : "absent",
      fonctionnalites: Object.fromEntries(
        etatDes(process.env).map((f) => [f.id, f.ouverte ? "ouverte" : f.motif]),
      ),
    },
    {
      status: vivant ? 200 : 503,
      // Une réponse de santé mise en cache est pire que pas de sonde du tout :
      // elle affirme que tout va bien longtemps après la panne.
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
