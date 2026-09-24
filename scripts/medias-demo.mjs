/**
 * Téléverse les visuels de démonstration dans MinIO.
 *
 *   node --env-file=.env scripts/medias-demo.mjs "C:/chemin/vers/le/dossier"
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI MINIO ET NON `public/img/demo/`
 *
 * Les seize visuels de démonstration actuels pèsent 33 Mo dans le dépôt. Le
 * jeu qu'on ajoute ici en pèse 985 : le commiter ferait d'un `git clone` un
 * téléchargement d'un gigaoctet, pour des images que personne ne relit dans
 * un diff.
 *
 * MinIO est par ailleurs le chemin réel : en production, une couverture est
 * une clé S3 servie par `urlPublique()`. Faire passer la démo par là éprouve
 * la même mécanique que les vrais téléversements, au lieu de la contourner
 * avec des fichiers statiques.
 *
 * Le prix est dit franchement : sur un clone frais, les vignettes sont vides
 * tant que ce script n'a pas tourné. C'est pour ça qu'il est idempotent et
 * qu'il tient en une commande.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL OUVRE LE BUCKET EN LECTURE PUBLIQUE, ET C'EST UN CHOIX DE DÉVELOPPEMENT
 *
 * Une couverture est affichée par le navigateur dans un `background: url(…)` :
 * elle doit être joignable sans signature. MinIO refuse par défaut (403), donc
 * le script pose une politique de lecture anonyme sur le préfixe `demo/`.
 *
 * **Sur le préfixe, pas sur le bucket entier.** Les fichiers vendus, les CV de
 * candidature et les pièces jointes vivent dans le même bucket : les ouvrir
 * tous transformerait une commodité de démonstration en fuite de documents.
 *
 * En production, la politique est posée par l'infrastructure, pas par un
 * script — et ce script refuse de tourner ailleurs qu'en local.
 */

import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import {
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

import { lireLesDeuxListes, partagerLeDossier } from "./lire-catalogue.mjs";

const BUCKET = process.env.S3_BUCKET ?? "baobart-media";
const PREFIXE = "demo/";

/**
 * Largeur des aperçus.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI ILS EXISTENT
 *
 * Les originaux vont de 30 Ko à 28 Mo. Les servir comme couvertures rendrait
 * la mosaïque du feed inutilisable : elle en charge une trentaine par page, et
 * douze mégaoctets par vignette font trois cent soixante mégaoctets à l'écran.
 *
 * Un jeu de démonstration qui fait ramper l'application ne démontre rien.
 *
 * C'est aussi ce que fait la production : `coverUrl` pointe vers une dérivée,
 * jamais vers le fichier vendu. On reproduit la même séparation plutôt que de
 * la contourner.
 */
const APERCU_LARGEUR = 1400;
const PREFIXE_APERCU = "demo/apercu/";

/** Le préfixe `demo/` seulement — voir l'en-tête. */
const DECLARATION = {
  Sid: "LectureAnonymeDesVisuelsDeDemonstration",
  Effect: "Allow",
  Principal: { AWS: ["*"] },
  Action: ["s3:GetObject"],
  // `demo/*` couvre aussi `demo/apercu/*`.
  Resource: [`arn:aws:s3:::${BUCKET}/${PREFIXE}*`],
};

/**
 * Ajoute notre déclaration sans effacer celles des autres.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI ON RELIT AVANT D'ÉCRIRE
 *
 * `PutBucketPolicy` remplace le document entier. Ce script et
 * `lib/upload/storage.ts` en posaient chacun un, avec un préfixe différent —
 * `demo/` ici, `public/` là-bas — et le dernier passé effaçait l'autre.
 *
 * Mesuré le 23 septembre 2026 : après ce script, la politique locale ne
 * portait plus que `demo/*`, et un extrait vidéo sous `public/extraits/`
 * répondait `HTTP 403`. Dans l'autre sens, un simple téléversement depuis
 * l'application aurait rendu 403 toutes les couvertures de démonstration.
 *
 * Aucun des deux écrivains ne s'en plaignait : les vignettes devenaient
 * vides, et c'est tout.
 */
async function fusionnerLaPolitique(client) {
  const enPlace = await client
    .send(new GetBucketPolicyCommand({ Bucket: BUCKET }))
    .then((r) => JSON.parse(r.Policy ?? "{}"))
    .catch(() => ({ Statement: [] }));

  const dAutrui = (enPlace.Statement ?? []).filter((d) => d.Sid !== DECLARATION.Sid);

  await client.send(
    new PutBucketPolicyCommand({
      Bucket: BUCKET,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [...dAutrui, DECLARATION],
      }),
    }),
  );

  return dAutrui.length;
}

const TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

/** La clé de l'aperçu web d'un fichier. Toujours en JPEG. */
export function cleApercu(nomFichier) {
  const base = cleDe(nomFichier).slice(PREFIXE.length);
  const sansExt = base.slice(0, base.lastIndexOf("."));
  return `${PREFIXE_APERCU}${sansExt}.jpg`;
}

/**
 * Une clé stable, dérivée du nom de fichier.
 *
 * Stable, parce que `prisma/demo-catalogue.ts` s'y réfère : une clé qui
 * changerait à chaque passage casserait toutes les couvertures déjà seedées.
 */
export function cleDe(nomFichier) {
  const ext = extname(nomFichier).toLowerCase();
  const base = basename(nomFichier, extname(nomFichier));

  const propre = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${PREFIXE}${propre}${ext}`;
}

function local() {
  const point = process.env.S3_ENDPOINT ?? "";
  return /localhost|127\.0\.0\.1|minio/.test(point);
}

async function main() {
  const dossier = process.argv[2];
  if (!dossier) {
    console.error("Usage : node --env-file=.env scripts/medias-demo.mjs <dossier>");
    process.exit(1);
  }

  if (!local()) {
    // La garde qui compte. Ce script ouvre un préfixe en lecture anonyme :
    // le laisser s'exécuter contre un stockage distant rendrait publics des
    // objets que personne n'a décidé de publier.
    console.error(
      `S3_ENDPOINT vaut « ${process.env.S3_ENDPOINT} » — ce script ne tourne ` +
        `qu'en local. Il ouvre un préfixe en lecture anonyme, et ce n'est pas ` +
        `une décision qu'un script prend sur une infrastructure distante.`,
    );
    process.exit(1);
  }

  const client = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });

  console.log(`Ouverture du préfixe « ${PREFIXE} » en lecture anonyme…`);
  const gardees = await fusionnerLaPolitique(client);
  console.log(`  ${gardees} déclaration(s) d'autrui conservée(s).`);

  /*
    ══════════════════════════════════════════════════════════════════════════
    LES ÉCARTÉS NE MONTENT PAS — « PAS AU CATALOGUE » NE VOULAIT PAS DIRE
    « PAS EN LIGNE »

    Ce script prenait le dossier entier, par extension. `ECARTES` ne servait
    qu'au catalogue : les visuels refusés étaient téléversés quand même, et le
    préfixe `demo/` est en lecture anonyme.

    Mesuré le 24 septembre 2026, sur la MinIO locale : les trois packshots
    CeraVe et la fresque Campbell's répondaient HTTP 200, original et aperçu,
    à une URL dérivée de leur nom — donc devinable. Aucun produit ne les
    citait, ils n'apparaissaient nulle part dans l'application, et ils étaient
    servis.

    C'est la forme la plus commune du défaut silencieux ici : la décision
    avait été prise, écrite, et documentée, et elle ne s'appliquait qu'à
    l'endroit où on l'avait regardée.
  */
  const { ecartes } = await lireLesDeuxListes();
  const { aPoser: fichiers, aRetirer } = partagerLeDossier(
    await readdir(dossier),
    ecartes,
    Object.keys(TYPES),
  );

  if (aRetirer.length > 0) {
    console.log(`${aRetirer.length} visuel(s) écarté(s), non téléversé(s) :`);
    for (const f of aRetirer) console.log(`  ${f}`);
  }

  /*
    ──────────────────────────────────────────────────────────────────────────
    ET ON RETIRE CEUX QUI SONT DÉJÀ MONTÉS

    Ne plus les téléverser ne suffit pas : une MinIO sur laquelle l'ancienne
    version a tourné les garde. Ce script est le seul endroit qui connaisse à
    la fois la liste et les clés, donc c'est ici que le ménage se fait — et à
    chaque passage, pas une fois à la main.

    La portée est étroite volontairement : seules les deux clés dérivées d'un
    nom présent dans `ECARTES`, sous `demo/`. Rien d'autre n'est touché.
  */
  for (const nom of aRetirer) {
    for (const cle of [cleDe(nom), cleApercu(nom)]) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: cle }));
      } catch {
        continue; // absent, c'est l'état voulu
      }

      await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: cle }));
      console.log(`  retiré de MinIO : ${cle}`);
    }
  }

  console.log(`${fichiers.length} fichiers à téléverser vers ${BUCKET}/${PREFIXE}`);

  let poses = 0;
  let deja = 0;

  for (const [i, nom] of fichiers.entries()) {
    const chemin = join(dossier, nom);
    const cle = cleDe(nom);
    const infos = await stat(chemin);

    // Idempotent : on ne repousse pas un objet déjà présent à la même taille.
    // Relancer le script après un ajout de trois fichiers ne doit pas remonter
    // le gigaoctet entier.
    try {
      const tete = await client.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: cle }),
      );
      if (tete.ContentLength === infos.size) {
        deja += 1;
        continue;
      }
    } catch {
      // Absent : on téléverse. C'est le cas normal au premier passage.
    }

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: cle,
        Body: createReadStream(chemin),
        ContentLength: infos.size,
        ContentType: TYPES[extname(nom).toLowerCase()],
        // Un an : ces objets ne changent pas, et leur clé est dérivée du nom.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    poses += 1;
    if (poses % 20 === 0) {
      console.log(`  ${i + 1}/${fichiers.length}…`);
    }
  }

  // ── Les aperçus web ──────────────────────────────────────────────────────
  //
  // Après les originaux, et seulement pour les images : une vidéo n'a pas de
  // vignette ici, et `sharp` ne sait pas la lire. Les cinq concernées gardent
  // leur original en couverture — elles sont petites.
  console.log(`
Génération des aperçus (${APERCU_LARGEUR} px)…`);

  let apercus = 0;
  let sautes = 0;

  for (const nom of fichiers) {
    const ext = extname(nom).toLowerCase();
    if (ext === ".mp4" || ext === ".mov") {
      sautes += 1;
      continue;
    }

    const cle = cleApercu(nom);

    try {
      await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: cle }));
      continue;
    } catch {
      // Absent : on le fabrique.
    }

    try {
      const corps = await sharp(join(dossier, nom))
        .rotate()
        .resize(APERCU_LARGEUR, null, { withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();

      await client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: cle,
          Body: corps,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      apercus += 1;
    } catch (cause) {
      // Illisible : la couverture retombera sur l'original. Bruyant plutôt que
      // silencieux — une vignette manquante ne se voit qu'à l'œil.
      console.error(`  aperçu impossible : ${nom} — ${cause.message}`);
      sautes += 1;
    }
  }

  console.log(`  ${apercus} aperçus posés, ${sautes} sautés (vidéos ou illisibles).`);

  console.log(
    `\nFait : ${poses} téléversés, ${deja} déjà en place.\n` +
      `Vérification : ${process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT}/${BUCKET}/${cleDe(fichiers[0])}`,
  );
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
