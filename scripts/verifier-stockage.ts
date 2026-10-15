/**
 * Vérifie le stockage configuré, pour de vrai : `pnpm stockage:verifier`.
 *
 * Ce que la documentation de R2 dit ou tait ne vaut pas une mesure. Ce script
 * dépose deux petits objets — un public, un privé —, les relit comme le
 * feraient un visiteur, un acheteur et un navigateur, puis les supprime.
 *
 *   1. l'aperçu se lit sans signature ;
 *   2. le fichier vendu ne se lit PAS à son adresse publique — s'il répond 200,
 *      il est téléchargeable gratuitement ;
 *   3. l'URL signée le livre, avec le nom d'origine (`Content-Disposition`) :
 *      lu le 15/10/2026, la documentation de R2 ne dit pas si
 *      `response-content-disposition` est honoré ;
 *   4. le CORS laisse le navigateur déposer, sur chacun des buckets.
 *
 * Il écrit dans le stockage configuré : deux objets sous `_verification/`,
 * retirés à la fin, même en cas d'échec.
 */

import { randomUUID } from "node:crypto";

import {
  bucketDe,
  bucketPublicSepare,
  deposerObjet,
  PREFIXE_PUBLIC,
  signerDepot,
  signerTelechargement,
  stockageConfigure,
  supprimerObjet,
  urlPublique,
} from "@/lib/upload/storage";

type Verdict = { ok: boolean; libelle: string; detail: string };

const verdicts: Verdict[] = [];
const noter = (ok: boolean, libelle: string, detail: string) => verdicts.push({ ok, libelle, detail });

async function statut(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { redirect: "manual", ...init });
  } catch {
    return null;
  }
}

async function principal(): Promise<number> {
  if (!stockageConfigure()) {
    console.error("Stockage non configuré : S3_ENDPOINT, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY.");
    return 2;
  }

  const origine = process.env.APP_URL ?? "http://localhost:3100";
  const jeton = randomUUID();
  const clePublique = `${PREFIXE_PUBLIC}_verification/${jeton}.txt`;
  const clePrivee = `produits/_verification/${jeton}.txt`;
  const contenu = `baobart-verification-${jeton}`;

  console.log(`Endpoint      ${new URL(process.env.S3_ENDPOINT!).host}`);
  console.log(`Bucket privé  ${bucketDe(clePrivee)}`);
  console.log(`Bucket public ${bucketDe(clePublique)}${bucketPublicSepare() ? "" : " (le même : un seul bucket)"}`);
  console.log(`Adresse publique ${process.env.S3_PUBLIC_URL || "(vide : retombe sur S3_ENDPOINT)"}`);
  console.log(`Origine CORS  ${origine}\n`);

  try {
    await deposerObjet({ cle: clePublique, corps: Buffer.from(contenu), contentType: "text/plain" });
    await deposerObjet({ cle: clePrivee, corps: Buffer.from(contenu), contentType: "text/plain" });

    // 1. L'aperçu, comme un visiteur.
    const apercu = await statut(urlPublique(clePublique));
    noter(apercu?.status === 200, "L'aperçu se lit sans signature", `${urlPublique(clePublique)} → ${apercu?.status ?? "injoignable"}`);

    // 2. Le fichier vendu, à l'adresse qu'un curieux essaierait.
    const curieux = [urlPublique(clePrivee)];
    if (process.env.S3_PUBLIC_URL) curieux.push(`${process.env.S3_PUBLIC_URL.replace(/\/+$/, "")}/${clePrivee}`);
    for (const url of new Set(curieux)) {
      const r = await statut(url);
      noter(r !== null && r.status !== 200, "Le fichier vendu ne se lit pas à son adresse publique", `${url} → ${r?.status ?? "injoignable"}`);
    }

    // 3. Le fichier vendu, comme un acheteur.
    const nom = "Pack d'essai été.txt";
    const signee = await signerTelechargement({ cle: clePrivee, nomFichier: nom, dureeSecondes: 120 });
    const acheteur = await statut(signee);
    const corps = acheteur?.status === 200 ? await acheteur.text() : "";
    noter(acheteur?.status === 200 && corps === contenu, "L'URL signée livre le fichier vendu", `→ ${acheteur?.status ?? "injoignable"}`);
    const disposition = acheteur?.headers.get("content-disposition") ?? "";
    noter(
      disposition.startsWith("attachment") && disposition.includes(encodeURIComponent(nom)),
      "Le téléchargement porte le nom d'origine",
      disposition ? `Content-Disposition: ${disposition}` : "aucun Content-Disposition : le fichier arrivera sous sa clé technique",
    );

    // 4. Le CORS, comme le navigateur avant un dépôt — sur chaque bucket.
    for (const cle of new Set([`produits/_verification/${jeton}-depot.zip`, `${PREFIXE_PUBLIC}extraits/_verification/${jeton}.mp3`])) {
      const depot = await signerDepot({ cle, contentType: "application/octet-stream" });
      const r = await statut(depot.url, {
        method: "OPTIONS",
        headers: { Origin: origine, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" },
      });
      const autorise = r?.headers.get("access-control-allow-origin");
      noter(
        autorise === origine || autorise === "*",
        `Le navigateur peut déposer dans « ${bucketDe(cle)} »`,
        `pré-vol depuis ${origine} → ${r?.status ?? "injoignable"}, Access-Control-Allow-Origin: ${autorise ?? "absent"}`,
      );
    }
  } finally {
    await supprimerObjet(clePublique);
    await supprimerObjet(clePrivee);
  }

  for (const v of verdicts) console.log(`${v.ok ? "✔" : "✘"} ${v.libelle}\n    ${v.detail}`);
  const echecs = verdicts.filter((v) => !v.ok).length;
  console.log(echecs === 0 ? "\nTout est en ordre." : `\n${echecs} vérification(s) en échec.`);
  return echecs === 0 ? 0 : 1;
}

// `exitCode` et non `process.exit()` : mesuré le 15/10/2026 sous Windows,
// couper le processus avec des sockets encore ouvertes le faisait planter
// (« Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) ») après le
// verdict, et le code de sortie ne disait plus rien.
principal().then(
  (code) => {
    process.exitCode = code;
  },
  (erreur) => {
    console.error(erreur);
    process.exitCode = 2;
  },
);
