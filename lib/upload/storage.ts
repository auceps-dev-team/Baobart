import "server-only";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Stockage des médias.
 *
 * S3-compatible : MinIO en développement, R2 ou S3 en production. Le même code
 * sert les deux — c'est la promesse « deploy anywhere » de la spec de
 * déploiement, et la raison pour laquelle rien ici ne nomme MinIO.
 *
 * Le fichier ne transite **jamais** par notre serveur : le navigateur l'envoie
 * directement au stockage avec une URL signée. Un pack de 200 Mo n'a aucune
 * raison de traverser Next pour finir au même endroit.
 */

const BUCKET = process.env.S3_BUCKET ?? "baobart-media";

/** Une URL signée pour déposer vaut quinze minutes : le temps de choisir et d'envoyer. */
const VALIDITE_DEPOT_SECONDES = 15 * 60;

let client: S3Client | null = null;

function s3(): S3Client {
  if (client) return client;

  client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    // MinIO ne sait pas router par sous-domaine : les chemins portent le bucket.
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });

  return client;
}

/** Le stockage est-il configuré ? Sert à refuser proprement plutôt qu'à planter. */
export function stockageConfigure(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

/**
 * Préfixe des objets lisibles sans signature.
 *
 * Tout ce qui n'est pas sous ce préfixe est privé. C'est la ligne qui sépare
 * l'aperçu — fait pour être vu par tout le monde — du fichier vendu, qui ne se
 * délivre que contre une URL signée et une commande payée.
 */
export const PREFIXE_PUBLIC = "public/";

let bucketPret: Promise<void> | null = null;

/**
 * Crée le bucket au premier usage, pour qu'un dev n'ait rien à préparer.
 *
 * Mémoïsé : une fois par processus, pas une fois par envoi.
 */
export async function assurerBucket(): Promise<void> {
  bucketPret ??= preparerBucket().catch((erreur) => {
    // Un échec ne doit pas se figer : le prochain envoi retentera.
    bucketPret = null;
    throw erreur;
  });

  return bucketPret;
}

async function preparerBucket(): Promise<void> {
  try {
    await s3().send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3().send(new CreateBucketCommand({ Bucket: BUCKET }));
  }

  // Ouvre la lecture anonyme **du seul préfixe public**. Rejouée même quand le
  // bucket existait déjà : sinon un bucket créé avant cette règle n'aurait
  // jamais de politique, et les aperçus répondraient 403 sans qu'on comprenne
  // pourquoi.
  await s3()
    .send(
      new PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "ApercusPublics",
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${BUCKET}/${PREFIXE_PUBLIC}*`],
            },
          ],
        }),
      }),
    )
    .catch(() => {
      // Un hébergeur peut refuser les politiques (R2 passe par son propre
      // domaine public). L'envoi ne doit pas échouer pour autant.
    });
}

export interface DepotSigne {
  url: string;
  cle: string;
  expireLe: Date;
}

/**
 * URL signée pour déposer un fichier.
 *
 * Le type de contenu est **figé dans la signature** : le navigateur ne peut pas
 * envoyer autre chose que ce qu'il a annoncé, sans quoi la signature ne vaut
 * plus rien.
 */
export async function signerDepot(input: {
  cle: string;
  contentType: string;
}): Promise<DepotSigne> {
  await assurerBucket();

  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: input.cle,
      ContentType: input.contentType,
    }),
    { expiresIn: VALIDITE_DEPOT_SECONDES },
  );

  return {
    url,
    cle: input.cle,
    expireLe: new Date(Date.now() + VALIDITE_DEPOT_SECONDES * 1000),
  };
}

export interface ObjetDepose {
  taille: number;
  contentType: string;
  etag: string;
}

/**
 * Lit ce qui a **réellement** été déposé.
 *
 * On ne croit pas le navigateur sur la taille ni sur le type : il déclare ce
 * qu'il veut. La seule source qui fasse foi est le stockage lui-même, et c'est
 * elle qu'on enregistre.
 */
export async function lireObjet(cle: string): Promise<ObjetDepose | null> {
  try {
    const tete = await s3().send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: cle }),
    );

    return {
      taille: tete.ContentLength ?? 0,
      contentType: tete.ContentType ?? "application/octet-stream",
      etag: (tete.ETag ?? "").replaceAll('"', ""),
    };
  } catch {
    return null;
  }
}

/**
 * Rapatrie un objet en mémoire, pour le mesurer ou en tirer un aperçu.
 *
 * Borné : au-delà de `maxOctets` on renonce plutôt que de charger deux cents
 * mégaoctets dans le tas du serveur. Le fichier reste vendable, il n'aura
 * simplement pas d'aperçu.
 */
export async function telechargerObjet(
  cle: string,
  maxOctets: number,
): Promise<Buffer | null> {
  try {
    const objet = await s3().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: cle }),
    );

    if ((objet.ContentLength ?? 0) > maxOctets) return null;
    if (!objet.Body) return null;

    return Buffer.from(await objet.Body.transformToByteArray());
  } catch {
    return null;
  }
}

/** Dépose un objet produit par le serveur — un aperçu, jamais un fichier reçu. */
export async function deposerObjet(input: {
  cle: string;
  corps: Buffer;
  contentType: string;
}): Promise<void> {
  await assurerBucket();

  await s3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: input.cle,
      Body: input.corps,
      ContentType: input.contentType,
      // Un aperçu ne change jamais : sa clé porte l'identifiant du média.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function supprimerObjet(cle: string): Promise<void> {
  await s3()
    .send(new DeleteObjectCommand({ Bucket: BUCKET, Key: cle }))
    .catch(() => {});
}

/**
 * URL publique d'un objet.
 *
 * En production, `S3_PUBLIC_URL` pointe le CDN : les médias sont le gros du
 * trafic et n'ont aucune raison de repasser par l'origine (PLAN §8.2).
 */
export function urlPublique(cle: string): string {
  const base = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "";
  const racine = base.replace(/\/+$/, "");

  return process.env.S3_FORCE_PATH_STYLE === "true"
    ? `${racine}/${BUCKET}/${cle}`
    : `${racine}/${cle}`;
}
