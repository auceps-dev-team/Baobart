import { S3Client } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { deposerObjet } from "./storage";

/**
 * Un bucket qu'on ne peut pas créer.
 *
 * Fichier à part : la préparation des buckets est mémorisée par module, et
 * celle de `storage.test.ts` réussit dès son premier envoi.
 */

const AVANT = { ...process.env };

beforeAll(() => {
  Object.assign(process.env, {
    S3_ENDPOINT: "http://stockage.test:9000",
    S3_ACCESS_KEY_ID: "cle",
    S3_SECRET_ACCESS_KEY: "secret",
    S3_FORCE_PATH_STYLE: "true",
    S3_BUCKET: "prive",
  });
});

afterAll(() => {
  for (const nom of ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_FORCE_PATH_STYLE", "S3_BUCKET"]) {
    if (AVANT[nom] === undefined) delete process.env[nom];
    else process.env[nom] = AVANT[nom];
  }
  vi.restoreAllMocks();
});

function stockageQui(refusDeCreation: unknown) {
  const envoyees: string[] = [];
  vi.spyOn(S3Client.prototype, "send").mockImplementation(async (commande: unknown) => {
    const nom = (commande as { constructor: { name: string } }).constructor.name;
    envoyees.push(nom);
    if (nom === "HeadBucketCommand") throw Object.assign(new Error("Forbidden"), { name: "403", $metadata: { httpStatusCode: 403 } });
    if (nom === "CreateBucketCommand") throw refusDeCreation;
    return {} as never;
  });
  return envoyees;
}

describe("la préparation d'un bucket qu'on ne peut pas créer", () => {
  // Ordre voulu : l'échec d'abord. Il remet la mémoïsation à zéro ; un succès
  // la figerait, et le second cas ne repréparerait rien.
  it("échoue encore quand le stockage est injoignable", async () => {
    stockageQui(Object.assign(new Error("connect ECONNREFUSED"), { name: "Error" }));
    await expect(
      deposerObjet({ cle: "public/apercus/m1-v3.webp", corps: Buffer.from("x"), contentType: "image/webp" }),
    ).rejects.toThrow("ECONNREFUSED");
  });

  it("dépose quand même si la clé n'a pas le droit de créer — un jeton R2 « Object Read & Write »", async () => {
    const envoyees = stockageQui(Object.assign(new Error("Access Denied"), { name: "AccessDenied", $metadata: { httpStatusCode: 403 } }));
    await deposerObjet({ cle: "public/apercus/m1-v3.webp", corps: Buffer.from("x"), contentType: "image/webp" });
    expect(envoyees).toContain("CreateBucketCommand");
    expect(envoyees.at(-1)).toBe("PutObjectCommand");
  });
});
