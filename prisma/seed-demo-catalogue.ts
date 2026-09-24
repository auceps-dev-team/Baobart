/**
 * Sème le catalogue de démonstration.
 *
 *   pnpm db:seed:catalogue                      # dimensions par défaut
 *   pnpm db:seed:catalogue "C:/chemin/source"   # dimensions réelles
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL SUPPOSE QUE LES VISUELS SONT DÉJÀ DANS MINIO
 *
 * `scripts/medias-demo.mjs` les y met. Ce seed ne fait qu'écrire des lignes
 * qui pointent dessus : lancé seul, il produira autant de fiches aux vignettes
 * vides qu'il y a d'entrées au catalogue, ce qui se voit tout de suite et ne
 * casse rien.
 *
 * L'ordre est donc : `docker compose up -d`, puis le script de médias, puis
 * celui-ci.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES APERÇUS SONT DES FICHIERS, PAS UNE GALERIE
 *
 * La fiche produit n'affiche qu'une couverture — voir `lib/products/queries.ts`,
 * qui lit `files[0]` pour le panneau « Détails » et `coverUrl` pour l'image.
 * Il n'y a pas de galerie.
 *
 * Les `apercus` du catalogue deviennent donc des `ProductFile` supplémentaires :
 * c'est ce qu'on télécharge quand on prend un pack de vingt-deux éclairages.
 * En faire des images d'illustration aurait demandé une galerie qui n'existe
 * pas, et personne ne les aurait jamais vues.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IDEMPOTENT PAR LE SLUG
 *
 * Relancer ne duplique rien : chaque produit est retrouvé par son slug, et ses
 * fichiers ne sont recréés que s'il n'en a aucun. On peut donc corriger un nom
 * dans le catalogue et rejouer sans nettoyer la base — ce qui est exactement
 * ce qu'on fait pendant qu'on ajuste un jeu de démonstration.
 */

import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";

import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

import {
  CATALOGUE_DEMO,
  ECARTES,
  apercuOuOriginal,
  cleDemo,
  estUneVideo,
  visuelsContradictoires,
  type EntreeDemo,
} from "./demo-catalogue";

const db = new PrismaClient();

/**
 * Les créateurs qui portent le catalogue.
 *
 * Six villes, parce qu'un feed dont toutes les ressources viennent de la même
 * personne ne montre pas ce qu'on veut regarder — ni la pagination, ni les
 * pastilles d'auteur, ni les liens « du même créateur ».
 *
 * Les quatre premiers sont ceux de `seed-demo.ts` : on les retrouve par leur
 * adresse plutôt que d'en créer des doublons.
 */
const CREATEURS = [
  { username: "awa-diallo", displayName: "Awa Diallo", city: "Dakar", country: "SN" },
  { username: "kwame-mensah", displayName: "Kwame Mensah", city: "Accra", country: "GH" },
  {
    username: "fatoumata-gnahore",
    displayName: "Fatoumata Gnahoré",
    city: "Abidjan",
    country: "CI",
  },
  { username: "chidi-okonkwo", displayName: "Chidi Okonkwo", city: "Lagos", country: "NG" },
  {
    username: "aya-kouassi",
    displayName: "Aya Kouassi",
    city: "Abidjan",
    country: "CI",
  },
  {
    username: "moussa-traore",
    displayName: "Moussa Traoré",
    city: "Bamako",
    country: "ML",
  },
];

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

/** L'URL publique d'une clé, selon la même règle que `lib/upload/storage.ts`. */
function urlPublique(cle: string): string {
  const base = (process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "").replace(
    /\/+$/,
    "",
  );
  const bucket = process.env.S3_BUCKET ?? "baobart-media";

  return process.env.S3_FORCE_PATH_STYLE === "true"
    ? `${base}/${bucket}/${cle}`
    : `${base}/${cle}`;
}

function slugifier(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface Mesures {
  octets: number;
  largeur: number | null;
  hauteur: number | null;
}

/**
 * Ce qu'on sait d'un fichier.
 *
 * Mesuré quand le dossier source est fourni, estimé sinon. La différence est
 * visible : le panneau « Détails » de la fiche affiche ces dimensions, et des
 * valeurs inventées y mentiraient sans que rien ne le signale.
 *
 * Une vidéo n'est jamais mesurée — `sharp` ne lit pas de `.mov`, et prétendre
 * le contraire ferait échouer le seed sur les cinq dernières lignes.
 */
async function mesurer(
  fichier: string,
  dossier: string | null,
): Promise<Mesures> {
  const ext = extname(fichier).toLowerCase();
  const estVideo = ext === ".mp4" || ext === ".mov";

  if (!dossier) {
    return { octets: 2_000_000, largeur: null, hauteur: null };
  }

  const chemin = join(dossier, fichier);
  const infos = await stat(chemin);

  if (estVideo) return { octets: infos.size, largeur: null, hauteur: null };

  try {
    const meta = await sharp(await readFile(chemin)).metadata();
    return {
      octets: infos.size,
      largeur: meta.width ?? null,
      hauteur: meta.height ?? null,
    };
  } catch {
    // Illisible par sharp : on garde au moins le poids réel plutôt que de
    // faire échouer tout le passage pour une vignette.
    return { octets: infos.size, largeur: null, hauteur: null };
  }
}

async function creerLesCreateurs() {
  const crees = [];

  for (const c of CREATEURS) {
    const user = await db.user.upsert({
      where: { email: `${c.username}@baobart.demo` },
      update: {},
      create: {
        email: `${c.username}@baobart.demo`,
        riskState: "COMPLIANT",
        kycStatus: "VERIFIED",
        profile: {
          create: {
            username: c.username,
            displayName: c.displayName,
            city: c.city,
            country: c.country,
            isVerified: true,
          },
        },
      },
      select: { id: true },
    });
    crees.push(user);
  }

  return crees;
}

async function semerUn(
  entree: EntreeDemo,
  createurId: string,
  creeLe: Date,
  dossier: string | null,
): Promise<"créé" | "déjà là"> {
  const slug = slugifier(entree.nom);
  // L'APERÇU, pas l'original : `coverUrl` est affiché dans une mosaïque qui en
  // charge une trentaine par page. Les originaux montent à 28 Mo.
  const cle = apercuOuOriginal(entree.fichier);

  // ══════════════════════════════════════════════════════════════════════════
  // UNE VIDÉO N'A PAS DE COUVERTURE, ELLE A UN EXTRAIT
  //
  // Première version : `coverUrl` portait le `.mp4`. La carte l'injecte dans
  // un `background: url(…)`, et un navigateur ne sait pas peindre une vidéo
  // ainsi — la vignette restait vide, sans la moindre erreur.
  //
  // Extraire une image de première frame demanderait ffmpeg, absent de cette
  // machine. Mais la carte sait DÉJÀ jouer un extrait : `resource-card.tsx`
  // affiche `<ApercuVideo>` quand `coverUrl` est nul et que `previewKind` vaut
  // « video ». On lui donne donc ce qu'elle attend, au lieu d'ajouter un
  // chemin de plus.
  const video = estUneVideo(entree.fichier);
  const couverture = video ? null : urlPublique(cle);
  const extrait = video
    ? { previewUrl: urlPublique(cleDemo(entree.fichier)), previewKind: "video" }
    : {};

  const produit = await db.product.upsert({
    where: { slug },
    // La couverture est remise à jour, elle seule : c'est la valeur qu'on a
    // corrigée après avoir vu qu'un original de 12 Mo ne peut pas servir de
    // vignette. Le reste garde ce qu'il avait, pour ne pas écraser une
    // retouche faite à la main dans la base de démonstration.
    update: { coverUrl: couverture, ...extrait },
    create: {
      sellerId: createurId,
      slug,
      name: entree.nom,
      description: entree.note ?? null,
      family: entree.famille,
      price: entree.prix,
      currency: "XOF",
      status: "PUBLISHED",
      coverUrl: couverture,
      ...extrait,
      isStaffPicked: entree.staffPicked ?? false,
      staffPickedAt: entree.staffPicked ? creeLe : null,
      createdAt: creeLe,
    },
    select: { id: true, createdAt: true },
  });

  const dejaLa = await db.productFile.findFirst({
    where: { productId: produit.id },
    select: { id: true },
  });
  if (dejaLa) return "déjà là";

  // La couverture d'abord, puis les aperçus. `position` porte cet ordre : la
  // fiche lit `files[0]` pour son panneau « Détails ».
  const fichiers = [entree.fichier, ...(entree.apercus ?? [])];

  for (const [position, nom] of fichiers.entries()) {
    const mesures = await mesurer(nom, dossier);
    const ext = extname(nom).toLowerCase();

    // `upsert` et non `create` : c'est `s3Key` qui porte l'unicité, et un
    // passage interrompu en plein milieu laisserait des médias sans produit.
    // Le suivant échouerait alors sur la première clé déjà prise — au tiers du
    // catalogue, avec une erreur Prisma qui ne dirait pas pourquoi.
    const media = await db.mediaAsset.upsert({
      where: { s3Key: cleDemo(nom) },
      update: {},
      create: {
        ownerId: createurId,
        purpose: "product",
        s3Key: cleDemo(nom),
        // Pas un vrai condensat : on ne relit pas 985 Mo pour un jeu de
        // démonstration. La clé est stable d'un passage à l'autre, ce qui
        // suffit à ce que la colonne sert ici.
        checksum: cleDemo(nom),
        sizeBytes: mesures.octets,
        contentType: TYPES[ext] ?? "application/octet-stream",
        width: mesures.largeur,
        height: mesures.hauteur,
        status: "READY",
      },
      select: { id: true },
    });

    await db.productFile.create({
      data: {
        productId: produit.id,
        mediaId: media.id,
        filename: nom,
        sizeBytes: mesures.octets,
        position,
      },
    });
  }

  return "créé";
}

async function main() {
  const dossier = process.argv[2] ?? null;

  if (!dossier) {
    console.log(
      "Aucun dossier source : les dimensions et les poids seront estimés.\n" +
        "Passe le chemin du dossier pour des valeurs mesurées.\n",
    );
  }

  /*
    ══════════════════════════════════════════════════════════════════════════
    LES DEUX LISTES NE PEUVENT PAS SE CONTREDIRE

    `ECARTES` ne servait qu'à afficher un nombre à la fin de ce script : rien
    ne l'empêchait de contenir un visuel que `CATALOGUE_DEMO` reprenait par
    ailleurs. Les deux listes se seraient contredites sans que rien ne le dise,
    et ce qu'on a refusé pour marque réelle serait remonté dans le fil.

    Le contrôle est ici, et pas seulement dans `verif-catalogue.mjs` : une
    vérification qu'on lance à part est une vérification qu'on saute. Celle-ci
    est sur le chemin qu'on ne peut pas éviter.

    Il refuse plutôt qu'il ne filtre. Si un visuel est des deux côtés, c'est
    qu'une décision a été prise deux fois en sens contraire — la trancher
    silencieusement dans un sens ou dans l'autre serait plus grave que de
    s'arrêter.
  */
  const contradictions = visuelsContradictoires();

  if (contradictions.length > 0) {
    throw new Error(
      `${contradictions.length} visuel(s) à la fois catalogué(s) et écarté(s) :\n` +
        contradictions.map((f) => `  ${f}`).join("\n") +
        `\n\nChaque écarté porte sa raison dans ECARTES. La lire avant de trancher.`,
    );
  }

  const createurs = await creerLesCreateurs();
  console.log(`${createurs.length} créateurs prêts.`);

  // Étalées dans le temps : la pagination par curseur n'a de sens que si les
  // dates diffèrent réellement, et le feed trie par date.
  const depart = Date.now() - CATALOGUE_DEMO.length * 3_600_000;

  let crees = 0;
  let dejaLa = 0;

  for (const [i, entree] of CATALOGUE_DEMO.entries()) {
    const createur = createurs[i % createurs.length]!;
    const suite = await semerUn(
      entree,
      createur.id,
      new Date(depart + i * 3_600_000),
      dossier,
    );

    if (suite === "créé") crees += 1;
    else dejaLa += 1;

    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${CATALOGUE_DEMO.length}…`);
  }

  const fichiers = CATALOGUE_DEMO.reduce(
    (n, e) => n + 1 + (e.apercus?.length ?? 0),
    0,
  );

  console.log(
    `\n${crees} produits créés, ${dejaLa} déjà présents.\n` +
      `${fichiers} fichiers rattachés · ${ECARTES.length} visuels écartés — voir ECARTES pour la raison de chacun.`,
  );
}

main()
  .catch((cause) => {
    console.error(cause);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
