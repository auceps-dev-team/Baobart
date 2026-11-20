import { createHash, randomBytes } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { db, nouveauCompte, ressourceVendable, unique } from "./fixtures/donnees";

/**
 * Les défauts majeurs de la recette par personas du 14/11/2026, un test chacun.
 *
 * Le détail de chaque défaut — qui l'a rencontré, comment le rejouer à la
 * main, ce qu'il coûte — est dans `Doc/QA_PERSONAS_2026-11-14.md` (§ 6) et sa
 * suite `Doc/QA_PERSONAS_2026-11-14-suite.md`. Les numéros Q-xx y renvoient.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CES TESTS SONT VERTS TANT QUE LES DÉFAUTS SONT LÀ
 *
 * Chaque test décrit le comportement **attendu**, celui qu'aurait une
 * application corrigée. Aujourd'hui ce comportement n'est pas tenu : un test
 * écrit normalement serait rouge, et la CI avec lui, jusqu'à la correction.
 *
 * On enferme donc la seule vérification du défaut dans `defautOuvert()` :
 *   - le défaut est là      → le test passe ;
 *   - le défaut est corrigé → le test échoue, avec un message qui dit de
 *     retirer l'enveloppe. Le test devient alors le garde-fou de la correction.
 *
 * Les préparatifs — créer un compte, acheter, ouvrir la page — restent en
 * dehors de l'enveloppe : s'ils cassent, le test échoue normalement. C'est ce
 * que `test.fail()` ne sait pas faire : il avale n'importe quel échec, y
 * compris celui d'un préparatif, et un test vert pour une mauvaise raison ne
 * garde plus rien.
 *
 * Pour VOIR les défauts, en rouge, avec le message de chacun :
 *
 *     QA_DEFAUTS_STRICTS=1 pnpm test:e2e qa-personas
 *
 * Mesuré le 14/11/2026, sur `main` v1.107.0 (132c75e) : onze rouges sur onze
 * avec ce réglage, chacun pour la raison que son commentaire annonce.
 * Rejoué le 15/11/2026 sur `main` + #57 (v1.108.2) : les mêmes onze rouges,
 * aux mêmes valeurs ; sans le réglage, la suite navigateur complète passe
 * (43 verts, 1 désactivé).
 *
 * Le mode d'emploi pour rejouer tout cela sans l'auteur, régie comprise :
 * `Doc/QA_PERSONAS_2026-11-14/REJOUER.md`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUI N'EST PAS ICI, ET POURQUOI
 *
 * Q-01 (l'inscription fermée après cinq envois) est écrit mais éteint, plus
 * bas : voir son commentaire. Q-39 et Q-41 (l'arbitrage sans alerte, le
 * remboursement non déduit du versement) dépendent du temps : leur place est
 * dans les tests d'intégration des versements, pas dans un navigateur.
 *
 * Ce fichier s'appelle « qa-personas » pour passer en dernier : Q-02 envoie un
 * formulaire d'inscription, et le quota d'inscription est partagé par tous les
 * tests d'un même serveur (voir `sujetAnonyme` dans `lib/securite/adresse.ts`).
 */

/** L'anti-bot refuse une inscription envoyée moins de deux secondes après l'ouverture. */
const PAUSE_HUMAINE_MS = 2_200;

/** Le téléphone d'Awa : Android milieu de gamme, 360 × 740. */
const TELEPHONE = {
  viewport: { width: 360, height: 740 },
  hasTouch: true,
  isMobile: true,
} as const;

const STRICT = process.env.QA_DEFAUTS_STRICTS === "1";

/**
 * Un défaut connu et encore ouvert.
 *
 * `attendu` décrit le BON comportement. Tant qu'il échoue, le défaut est là et
 * le test passe. Le jour où il réussit, le test échoue pour qu'on retire
 * l'enveloppe.
 */
async function defautOuvert(numero: string, attendu: () => Promise<void>): Promise<void> {
  if (STRICT) {
    await attendu();
    return;
  }
  let tenu = true;
  try {
    await attendu();
  } catch {
    tenu = false;
  }
  expect(
    tenu,
    `${numero} semble corrigé : le comportement attendu est tenu. Retirer defautOuvert() autour de cette vérification, pour que le test garde la correction.`,
  ).toBe(false);
}

async function seConnecter(context: BrowserContext, userId: string, baseURL: string) {
  await context.clearCookies();
  const jeton = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      userId,
      token: createHash("sha256").update(jeton).digest("hex"),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  await context.addCookies([{ name: "baobart_session", value: jeton, url: baseURL }]);
}

async function nouveauMembre(prefixe: string): Promise<{ id: string; marque: string }> {
  const marque = unique(prefixe);
  const membre = await db.user.create({
    data: {
      email: `${marque}@baobart.test`,
      profile: { create: { username: marque, displayName: `Membre ${marque}` } },
    },
    select: { id: true },
  });
  return { id: membre.id, marque };
}

/** Le bandeau de cookies couvre le bas de l'écran tant qu'on n'a pas répondu. */
async function fermerLeBandeau(page: Page) {
  // Dans le bandeau seulement : l'écran des remboursements a lui aussi un
  // bouton « Refuser », et ce n'est pas celui-là qu'on veut toucher.
  const refuser = page.getByRole("dialog", { name: /cookie/i }).getByRole("button", { name: "Refuser" });
  if (await refuser.count()) await refuser.click();
}

/** L'achat simulé, tel que `achat.spec.ts` le joue. */
async function acheter(page: Page, slug: string) {
  await page.goto(`/acheter/${slug}`);
  await fermerLeBandeau(page);
  await page.getByRole("button", { name: "Côte d'Ivoire" }).click();
  await page.getByText("Orange Money").first().click();
  await page.getByRole("button", { name: /^payer/i }).click();
  await expect(page).toHaveURL(/achat=ok/, { timeout: 30_000 });
}

test.describe("l'inscription", () => {
  // Q-01 — Cinq envois par heure et par adresse, formulaires vides ou faux
  // compris : le sixième visiteur de la même connexion est refusé, même avec
  // un formulaire juste (mesuré le 14/11 : 4 comptes créés sur 30 élèves).
  //
  // Éteint, et pas seulement enveloppé. Pour le jouer il faut six envois, et
  // le compteur est commun à tous les tests d'un même serveur : ce test
  // fermerait l'inscription à `achat.spec.ts` pendant une heure sur le poste
  // de qui relance la suite. `limitation.spec.ts` s'en sort en posant
  // lui-même une adresse par test (`x-real-ip`) ; ce procédé touche à une
  // défense, et le responsable du dépôt a retiré tout test de sécurité du
  // périmètre de la recette. À rallumer par quelqu'un qui en a le mandat.
  //
  // Rallumé le 16/11/2026, avec la correction : les envois refusés ne
  // consomment plus le quota des comptes, mais une enveloppe de trente envois
  // par heure. Ce test en prend six et crée un compte : il ne ferme plus rien
  // aux autres. Décidé par le responsable du dépôt.
  test("Q-01 — cinq formulaires refusés ne ferment pas l'inscription au visiteur suivant", async ({ browser }) => {
    const premier = await browser.newContext();
    const page = await premier.newPage();
    for (let essai = 0; essai < 5; essai += 1) {
      await page.goto("/inscription");
      await page.waitForTimeout(PAUSE_HUMAINE_MS);
      await page.getByRole("button", { name: /créer mon compte/i }).click();
    }
    const suivant = await (await browser.newContext()).newPage();
    const compte = nouveauCompte();
    await suivant.goto("/inscription");
    await suivant.getByLabel("Prénom").fill(compte.prenom);
    await suivant.getByLabel("Nom", { exact: true }).fill(compte.nom);
    await suivant.getByLabel(/nom d.utilisateur/i).fill(compte.username);
    await suivant.getByLabel("Email").fill(compte.email);
    await suivant.getByLabel("Mot de passe").fill(compte.motDePasse);
    await suivant.getByRole("checkbox").check();
    await suivant.waitForTimeout(PAUSE_HUMAINE_MS);
    await suivant.getByRole("button", { name: /créer mon compte/i }).click();
    await expect(suivant).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  });

  test("Q-02 — un mot de passe trop court ne vide pas les autres champs", async ({ page }) => {
    const compte = nouveauCompte();
    await page.goto("/inscription");
    await fermerLeBandeau(page);
    await page.getByLabel("Prénom").fill(compte.prenom);
    await page.getByLabel("Nom", { exact: true }).fill(compte.nom);
    await page.getByLabel(/nom d.utilisateur/i).fill(compte.username);
    await page.getByLabel("Email").fill(compte.email);
    await page.getByLabel("Mot de passe").fill("abc1234");
    await page.getByRole("checkbox").check();
    await page.waitForTimeout(PAUSE_HUMAINE_MS);
    await page.getByRole("button", { name: /créer mon compte/i }).click();

    // Le quota d'inscription est commun à toute la suite : relancée deux fois
    // dans l'heure sur le même serveur, elle peut l'avoir épuisé. Ce n'est
    // alors pas ce défaut-ci qu'on regarde.
    const refus = page.getByText(/au moins 8 caractères|Trop de tentatives/).first();
    await expect(refus).toBeVisible();
    test.skip(
      /Trop de tentatives/.test(await refus.innerText()),
      "quota d'inscription épuisé sur ce serveur (Q-01) : rejouer après redémarrage",
    );

    // Q-02 corrigé le 16/11/2026 : l'enveloppe defautOuvert() est retirée, ce
    // test garde désormais la correction.
    await expect(page.getByLabel("Email")).toHaveValue(compte.email, { timeout: 3_000 });
    await expect(page.getByLabel("Prénom")).toHaveValue(compte.prenom, { timeout: 3_000 });
  });
});

test.describe("sur un téléphone", () => {
  test.use(TELEPHONE);

  test("Q-03 — les rubriques des sous-menus s'atteignent au toucher", async ({ page }) => {
    await page.goto("/");
    await fermerLeBandeau(page);
    // Depuis D2b (#70), les menus se rangent sous 620 px derrière « Menu » : on
    // l'ouvre d'abord, comme le ferait la personne. Ce que le test prouve ne
    // change pas — les rubriques s'atteignent au doigt.
    const ouvrirLesMenus = async () => {
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      if (await menu.isVisible()) await menu.tap();
    };
    await ouvrirLesMenus();
    const entrees = page.getByRole("navigation").first().getByRole("link", { name: /▼/ });
    await expect(entrees.first()).toBeVisible();
    const nombre = await entrees.count();
    expect(nombre, "le menu doit porter des entrées à sous-menu").toBeGreaterThan(0);

    // Sur ordinateur, ces sous-menus s'ouvrent au survol et contiennent, entre
    // autres, Jobs, Services et Concours. On touche chaque entrée et on relève
    // tous les liens alors visibles.
    const atteints = new Set<string>();
    for (let i = 0; i < nombre; i += 1) {
      await page.goto("/");
      await ouvrirLesMenus();
      await page.getByRole("navigation").first().getByRole("link", { name: /▼/ }).nth(i).tap();
      await page.waitForTimeout(600);
      const liens = await page.locator("a:visible").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
      for (const lien of liens) atteints.add(lien);
    }

    // Q-03 corrigé le 20/11/2026 (D2a, #69 : au doigt, le premier toucher ouvre
    // le sous-menu) : l'enveloppe defautOuvert() est retirée, ce test garde
    // désormais la correction.
    expect([...atteints]).toEqual(expect.arrayContaining(["/jobs", "/services", "/evenements"]));
  });

  test("Q-04 — le contenu du tableau de bord commence dans le premier écran", async ({ page, context, baseURL }) => {
    const membre = await nouveauMembre("q04");
    await seConnecter(context, membre.id, baseURL!);
    await page.goto("/dashboard/apercu");
    const titre = page.getByRole("heading", { level: 1 }).first();
    await expect(titre).toBeAttached();
    const boite = await titre.boundingBox();
    expect(boite, "le titre de la page doit avoir une place à l'écran").not.toBeNull();

    // Mesuré le 14/11 : 942 px, pour un écran haut de 740 (982 le 20/11). Le
    // premier écran après la connexion était entièrement le menu.
    // Q-04 corrigé le 20/11/2026 (D2a, #69 : le menu se replie sous 980 px) :
    // l'enveloppe defautOuvert() est retirée, ce test garde désormais la correction.
    expect(boite!.y).toBeLessThan(TELEPHONE.viewport.height);
  });

  test("Q-07 — un refus du profil de boutique s'affiche là où la personne regarde", async ({ page, context, baseURL }) => {
    const membre = await nouveauMembre("q07");
    await seConnecter(context, membre.id, baseURL!);
    await page.goto("/dashboard/boutique");
    await fermerLeBandeau(page);
    // Le pays est une liste depuis Q-32 : on ne peut plus y écrire « Sénégal ».
    // Le refus vient d'une adresse en http, que le serveur refuse toujours.
    await page.getByLabel(/^portfolio/i).first().fill("http://mon-site.ci");
    await page.getByRole("button", { name: "Enregistrer mon profil" }).tap();

    const message = page.getByText(/commencer par https/i).first();
    await expect(message, "le serveur doit refuser une adresse en http").toBeAttached();

    // Mesuré le 14/11 : le message est à 1 155 px, le bouton à 4 055 px, et
    // rien ne défile. À l'écran, il ne se passe rien.
    // Q-07 corrigé le 16/11/2026 : l'enveloppe defautOuvert() est retirée, ce
    // test garde désormais la correction.
    await expect(message).toBeInViewport({ timeout: 3_000 });
  });
});

test.describe("les offres d'emploi", () => {
  test("Q-05 — après un refus, le contrat, le mode et le pays choisis restent choisis", async ({ page, context, baseURL }) => {
    const membre = await nouveauMembre("q05");
    await seConnecter(context, membre.id, baseURL!);
    await page.goto("/jobs/deposer");
    await fermerLeBandeau(page);

    const cloture = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    await page.locator("input[name=titre]").fill("Stagiaire en design graphique — campagnes télécom");
    await page
      .locator("textarea[name=description]")
      .fill("Stage de six mois au sein du studio : déclinaisons de campagnes, préparation des fichiers pour l'impression, participation aux présentations clients. Convention de stage obligatoire.");
    await page.locator("select[name=type]").selectOption("INTERN");
    await page.locator("select[name=mode]").selectOption("HYBRID");
    await page.locator("select[name=pays]").selectOption("CI");
    await page.locator("input[name=ville]").fill("Abidjan");
    await page.locator("input[name=salaireMin]").fill("300000");
    await page.locator("input[name=salaireMax]").fill("100000");
    await page.locator("input[name=echeance]").fill(cloture);
    await page.waitForTimeout(PAUSE_HUMAINE_MS);
    await page.getByRole("button", { name: "Envoyer en relecture" }).click();

    await expect(page.getByText(/minimum dépasse le maximum/i).first()).toBeVisible();
    await expect(page.locator("input[name=ville]"), "les champs de texte, eux, sont conservés").toHaveValue("Abidjan");

    // Mesuré le 14/11 : les trois listes reviennent à Freelance / À distance /
    // Non précisé, et l'offre corrigée part avec ces valeurs-là.
    // Q-05 corrigé le 16/11/2026 : l'enveloppe defautOuvert() est retirée, ce
    // test garde désormais la correction.
    await expect(page.locator("select[name=type]")).toHaveValue("INTERN", { timeout: 3_000 });
    await expect(page.locator("select[name=mode]")).toHaveValue("HYBRID", { timeout: 3_000 });
    await expect(page.locator("select[name=pays]")).toHaveValue("CI", { timeout: 3_000 });
  });
});

test.describe("les collections partagées", () => {
  test("Q-06 — une collection partagée dans une communauté s'ouvre depuis cette communauté", async ({ page, context, baseURL }) => {
    const auteur = await nouveauMembre("q06a");
    const membre = await nouveauMembre("q06m");
    const marque = unique("q06");
    const titre = `Affiches et motifs ${marque}`;
    const communaute = await db.community.create({
      data: {
        creatorId: auteur.id,
        name: `Studio ${marque}`,
        slug: `studio-${marque}`,
        memberCount: 2,
        members: { create: [{ userId: auteur.id, role: "ADMIN" }, { userId: membre.id }] },
      },
      select: { id: true, slug: true },
    });
    await db.board.create({
      data: { ownerId: auteur.id, title: titre, isPublic: true, communityId: communaute.id },
    });

    await seConnecter(context, membre.id, baseURL!);
    await page.goto(`/communautes/${communaute.slug}`);
    await expect(page.getByText(titre).first(), "la collection partagée doit être annoncée").toBeVisible();

    // Mesuré le 14/11 : le bloc affiche le titre, le nombre de membres et de
    // ressources, et aucun lien. Un clic sur le titre ne fait rien.
    // Q-06 corrigé le 20/11/2026 : l'enveloppe defautOuvert() est retirée, ce
    // test garde désormais la correction.
    await expect(page.getByRole("link", { name: new RegExp(marque) }).first()).toBeVisible({ timeout: 3_000 });
  });
});

test.describe("le paiement", () => {
  test("Q-09 — le bouton « Payer » affiche le montant que l'acheteur vient de choisir", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(1_500);
    await db.product.update({
      where: { id: ressource.produitId },
      data: { pricingMode: "LIBRE", minPrice: 500, suggestedPrices: [1_000, 1_500, 2_500] },
    });
    const acheteur = await nouveauMembre("q09");
    await seConnecter(context, acheteur.id, baseURL!);
    await page.goto(`/acheter/${ressource.slug}`);
    await fermerLeBandeau(page);
    await page.getByRole("button", { name: /^2\s500\sF$/ }).click();
    await expect(page.locator("input[name=montant]")).toHaveValue("2500");

    // Mesuré le 14/11 : « Payer 1 500 F » quel que soit le montant choisi ;
    // et « Payer 3 500 F » après un code promo qui ramène le prix à 2 800 F.
    // Le montant débité, lui, est le bon.
    // Q-09 corrigé le 16/11/2026 : l'enveloppe defautOuvert() est retirée, ce
    // test garde désormais la correction.
    await expect(page.getByRole("button", { name: /^payer/i })).toHaveText(/2\s500/, { timeout: 3_000 });
  });

  test("Q-10 — un code promo inconnu ne fait pas sortir du paiement", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(3_500);
    const acheteur = await nouveauMembre("q10");
    await seConnecter(context, acheteur.id, baseURL!);
    await page.goto(`/acheter/${ressource.slug}`);
    await fermerLeBandeau(page);
    await page.locator("input[name=codePromo]").fill("CODEQUINEXISTEPAS");
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page.getByText(/ce code n.existe pas/i).first()).toBeVisible();
    await page.getByRole("button", { name: "Côte d'Ivoire" }).click();
    await page.getByText("Orange Money").first().click();
    await page.getByRole("button", { name: /^payer/i }).click();
    await page.waitForLoadState("networkidle");

    // Mesuré le 14/11 : retour sur la fiche avec « Ce code promo n'a pas pu
    // être appliqué », pays et moyen de paiement perdus. Attendu : l'achat
    // aboutit sans le code, ou la page de paiement reste ouverte.
    // Q-10 corrigé le 16/11/2026 : l'enveloppe defautOuvert() est retirée, ce
    // test garde désormais la correction.
    await expect(page).toHaveURL(/achat=ok|\/acheter\//, { timeout: 5_000 });
  });
});

test.describe("après la vente", () => {
  test("Q-08 — un seul appui sur « Rembourser » ne rembourse pas", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(4_000);
    const acheteur = await nouveauMembre("q08");
    await seConnecter(context, acheteur.id, baseURL!);
    await acheter(page, ressource.slug);

    await page.goto("/dashboard/remboursements");
    await page.getByRole("button", { name: "Demander un remboursement" }).first().click();
    await page.locator("textarea").first().fill("Le fichier ne correspond pas à ce que la fiche annonce.");
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByText(/en attente du créateur/i).first()).toBeVisible();

    await seConnecter(context, ressource.vendeurId, baseURL!);
    await page.goto("/dashboard/ventes/remboursements");
    await fermerLeBandeau(page);
    const rembourser = page.getByRole("button", { name: "Rembourser", exact: true }).first();
    await expect(rembourser).toBeVisible();
    await rembourser.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_500);

    // Mesuré le 14/11 : le remboursement part au premier appui, sans
    // confirmation, alors que le bouton voisin « Refuser » ouvre un champ.
    // (Une boîte de confirmation native serait refermée par Playwright sans
    // être acceptée : le remboursement ne partirait pas, et c'est bien ce
    // qu'on attend d'un seul appui.)
    const ligne = await db.orderItem.findFirstOrThrow({
      where: { productId: ressource.produitId },
      select: { refundedAmount: true },
    });
    // Q-08 corrigé le 16/11/2026 : l'enveloppe defautOuvert() est retirée, ce
    // test garde désormais la correction.
    expect(ligne.refundedAmount).toBe(0);

    // Et la confirmation, elle, rembourse : sans ce second temps, un bouton
    // qui ne ferait plus rien du tout passerait le test ci-dessus.
    await page.getByRole("button", { name: "Confirmer le remboursement" }).click();
    await expect
      .poll(async () => (await db.orderItem.findFirstOrThrow({ where: { productId: ressource.produitId }, select: { refundedAmount: true } })).refundedAmount)
      .toBe(4_000);
  });

  test("Q-37 — l'acheteur d'une ressource dépubliée retrouve ses fichiers depuis sa bibliothèque", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(2_000);
    const acheteur = await nouveauMembre("q37");
    await seConnecter(context, acheteur.id, baseURL!);
    await acheter(page, ressource.slug);

    // La créatrice dépublie ; l'acheteur n'avait pas encore téléchargé.
    await db.product.update({ where: { id: ressource.produitId }, data: { status: "DRAFT" } });

    await page.goto("/dashboard/bibliotheque");
    const titre = page.getByRole("link", { name: ressource.nom }).first();
    await expect(titre, "l'achat doit rester dans la bibliothèque").toBeVisible();
    await titre.click();
    await page.waitForLoadState("networkidle");

    // Mesuré le 14/11 : tous les liens de la bibliothèque mènent à la fiche
    // publique, qui répond « Cette page n'existe pas ». Les règles de
    // publication promettent : « ceux qui l'ont achetée gardent leurs fichiers ».
    // Q-37 corrigé le 20/11/2026 : l'enveloppe defautOuvert() est retirée, ce
    // test garde désormais la correction.
    await expect(page.getByRole("heading", { name: /n.existe pas/i })).toHaveCount(0, { timeout: 3_000 });
  });

  test("Q-38 — après l'enregistrement, la liste du délai de remboursement affiche le délai enregistré", async ({ page, context, baseURL }) => {
    const ressource = await ressourceVendable(2_000);
    await seConnecter(context, ressource.vendeurId, baseURL!);
    await page.goto("/dashboard/ventes/remboursements");
    await fermerLeBandeau(page);
    const liste = page.locator("select[name=jours]");
    await expect(liste).toHaveValue("30");
    await liste.selectOption("7");
    await liste.locator("xpath=ancestor::form[1]").getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText(/Délai réglé à 7 jours/).first()).toBeVisible();

    // Mesuré le 14/11 : le message dit « 7 jours », la liste réaffiche
    // « 30 jours » jusqu'au rechargement. Même mécanisme que Q-05.
    // Q-38 corrigé le 16/11/2026 : l'enveloppe defautOuvert() est retirée, ce
    // test garde désormais la correction.
    await expect(liste).toHaveValue("7", { timeout: 3_000 });
  });
});
