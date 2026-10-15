import { S3Client } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bucketPublicSepare,
  bucketSelon,
  deposerObjet,
  listerObjets,
  signerDepot,
  signerTelechargement,
  supprimerObjet,
  urlPublique,
  urlPubliqueSelon,
} from "./storage";

/**
 * Le routage entre bucket privé et bucket public.
 *
 * Aucun stockage réel ici : on intercepte `S3Client.send` et on lit le bucket
 * que chaque commande vise. Les URL signées, elles, se calculent sans réseau —
 * on lit le bucket dans leur chemin (`S3_FORCE_PATH_STYLE=true`).
 */

const AVANT = { ...process.env };

beforeAll(() => {
  Object.assign(process.env, {
    S3_ENDPOINT: "http://stockage.test:9000",
    S3_ACCESS_KEY_ID: "cle",
    S3_SECRET_ACCESS_KEY: "secret",
    S3_FORCE_PATH_STYLE: "true",
    S3_BUCKET: "prive",
    S3_BUCKET_PUBLIC: "vitrine",
  });
});

afterAll(() => {
  for (const nom of ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_FORCE_PATH_STYLE", "S3_BUCKET", "S3_BUCKET_PUBLIC"]) {
    if (AVANT[nom] === undefined) delete process.env[nom];
    else process.env[nom] = AVANT[nom];
  }
  vi.restoreAllMocks();
});

const envoyees: Array<{ commande: string; bucket: string | undefined }> = [];

beforeEach(() => {
  envoyees.length = 0;
  vi.spyOn(S3Client.prototype, "send").mockImplementation(async (commande: unknown) => {
    const c = commande as { constructor: { name: string }; input: { Bucket?: string } };
    envoyees.push({ commande: c.constructor.name, bucket: c.input.Bucket });
    return { Contents: [], IsTruncated: false } as never;
  });
});

describe("le bucket d'une clé", () => {
  it("range le public à part quand S3_BUCKET_PUBLIC est posé", () => {
    const env = { S3_BUCKET: "prive", S3_BUCKET_PUBLIC: "vitrine" };
    expect(bucketSelon(env, "public/apercus/m1-v3.webp")).toBe("vitrine");
    expect(bucketSelon(env, "public/extraits/p1/a.mp3")).toBe("vitrine");
    expect(bucketSelon(env, "produits/p1/pack.zip")).toBe("prive");
    expect(bucketSelon(env, "candidatures/c1/cv.pdf")).toBe("prive");
  });

  it("ne se laisse pas tromper par un « public » qui n'est pas le préfixe", () => {
    // `produits/public/…` est le fichier d'un produit, pas un aperçu.
    expect(bucketSelon({ S3_BUCKET: "prive", S3_BUCKET_PUBLIC: "vitrine" }, "produits/public/pack.zip")).toBe("prive");
  });

  it("garde un seul bucket quand S3_BUCKET_PUBLIC manque ou est vide", () => {
    for (const env of [{ S3_BUCKET: "unique" }, { S3_BUCKET: "unique", S3_BUCKET_PUBLIC: "  " }]) {
      expect(bucketSelon(env, "public/apercus/x.webp")).toBe("unique");
      expect(bucketPublicSepare(env)).toBe(false);
    }
    expect(bucketSelon({}, "produits/x.zip")).toBe("baobart-media");
  });

  it("ne compte pas comme séparé un bucket public qui est le même", () => {
    expect(bucketPublicSepare({ S3_BUCKET: "meme", S3_BUCKET_PUBLIC: "meme" })).toBe(false);
    expect(bucketPublicSepare({ S3_BUCKET: "prive", S3_BUCKET_PUBLIC: "vitrine" })).toBe(true);
  });
});

describe("l'adresse publique d'un aperçu", () => {
  it("porte le bucket public dans le chemin, en style chemin", () => {
    const env = { S3_ENDPOINT: "http://localhost:9000", S3_FORCE_PATH_STYLE: "true", S3_BUCKET: "prive", S3_BUCKET_PUBLIC: "vitrine" };
    expect(urlPubliqueSelon(env, "public/apercus/m1-v3.webp")).toBe("http://localhost:9000/vitrine/public/apercus/m1-v3.webp");
  });

  it("se rattache au domaine du bucket public sur R2, sans le nom du bucket", () => {
    const env = { S3_PUBLIC_URL: "https://media.baobart.ci/", S3_FORCE_PATH_STYLE: "false", S3_BUCKET_PUBLIC: "vitrine" };
    expect(urlPubliqueSelon(env, "public/apercus/m1-v3.webp")).toBe("https://media.baobart.ci/public/apercus/m1-v3.webp");
  });

  it("retombe sur l'endpoint quand S3_PUBLIC_URL est vide, comme l'écrit .env.example", () => {
    // Avec `??`, la chaîne vide l'emportait : l'adresse perdait son hôte.
    const env = { S3_PUBLIC_URL: "", S3_ENDPOINT: "http://localhost:9000", S3_FORCE_PATH_STYLE: "true", S3_BUCKET: "baobart-media" };
    expect(urlPubliqueSelon(env, "public/apercus/m1.webp")).toBe("http://localhost:9000/baobart-media/public/apercus/m1.webp");
  });

  it("se passe telle quelle à .map(), comme le font service.ts et regeneration.ts", () => {
    // Mesuré le 15/10 : avec un `env` en second paramètre, `map` y glissait
    // l'indice, et l'adresse perdait son hôte. `tsc` l'a vu ; ce test le garde.
    expect(["public/apercus/a.webp", "public/apercus/b.webp"].map(urlPublique)).toEqual([
      "http://stockage.test:9000/vitrine/public/apercus/a.webp",
      "http://stockage.test:9000/vitrine/public/apercus/b.webp",
    ]);
  });
});

describe("chaque opération vise le bucket de sa clé", () => {
  it("dépose un aperçu dans le public, et ne prépare la politique que là", async () => {
    await deposerObjet({ cle: "public/apercus/m1-v3.webp", corps: Buffer.from("x"), contentType: "image/webp" });

    const politiques = envoyees.filter((e) => e.commande.includes("BucketPolicy"));
    expect(politiques.length).toBeGreaterThan(0);
    expect(politiques.every((e) => e.bucket === "vitrine")).toBe(true);
    expect(envoyees.at(-1)).toEqual({ commande: "PutObjectCommand", bucket: "vitrine" });
  });

  it("supprime et liste là où l'objet a été rangé", async () => {
    await supprimerObjet("produits/p1/pack.zip");
    await supprimerObjet("public/extraits/p1/a.mp3");
    await listerObjets("public/apercus/");
    expect(envoyees.filter((e) => e.commande !== "HeadBucketCommand" && !e.commande.includes("Policy"))).toEqual([
      { commande: "DeleteObjectCommand", bucket: "prive" },
      { commande: "DeleteObjectCommand", bucket: "vitrine" },
      { commande: "ListObjectsV2Command", bucket: "vitrine" },
    ]);
  });

  it("signe le retrait d'un fichier vendu sur le bucket privé", async () => {
    const url = new URL(await signerTelechargement({ cle: "produits/p1/pack.zip", nomFichier: "pack.zip", dureeSecondes: 600 }));
    expect(url.pathname).toBe("/prive/produits/p1/pack.zip");
  });

  it("signe le dépôt d'un extrait sur le bucket public, et d'une source sur le privé", async () => {
    const extrait = new URL((await signerDepot({ cle: "public/extraits/p1/a.mp3", contentType: "audio/mpeg" })).url);
    const source = new URL((await signerDepot({ cle: "produits/p1/pack.zip", contentType: "application/zip" })).url);
    expect(extrait.pathname).toBe("/vitrine/public/extraits/p1/a.mp3");
    expect(source.pathname).toBe("/prive/produits/p1/pack.zip");
  });
});
