# Mesures de performance — Octobre 2026

> Mesures effectuées le **30/10/2026** sur la branche `gemini/performance` (issue de `origin/main` au commit `5763e91`, `v1.102.6`) sous Windows 11, Node.js `v24.16.0`, Next.js `15.5.28`, Prisma `6.19.3` et PostgreSQL 16 dans Docker Desktop.

---

## 1. État de la machine avant toute mesure (A0 — mesuré le 30/10/2026)

### Conteneurs Docker en cours d'exécution

```text
NAMES              STATUS
baobart-postgres   Up 6 hours (healthy)
baobart-redis      Up 6 hours (healthy)
baobart-minio      Up 6 hours (healthy)
refferq-db         Up 6 hours (healthy)
```

### Charge instantanée des conteneurs (`docker stats --no-stream`, mesurée le 30/10/2026)

```text
CONTAINER ID   NAME               CPU %     MEM USAGE / LIMIT     MEM %     NET I/O           BLOCK I/O        PIDS
1aadac233429   baobart-postgres   0.01%     39.15MiB / 3.825GiB   1.00%     1.56kB / 126B     16.6MB / 315kB   6
41666623ca81   baobart-redis      3.14%     6.523MiB / 3.825GiB   0.17%     1.82kB / 126B     10.7MB / 0B      6
ad37e1e2ca7d   baobart-minio      0.21%     107.4MiB / 3.825GiB   2.74%     7.71kB / 3.03kB   154MB / 5.4MB    10
d981ae5264ad   refferq-db         0.00%     33.2MiB / 3.825GiB    0.85%     1.77kB / 126B     21.2MB / 315kB   6
```

Aucun conteneur étranger à Baobart ne consomme de processeur (`refferq-db` est à `0.00 %`).

### Processus `node.exe` actifs avant mesure (mesuré le 30/10/2026)

Douze processus `node.exe` liés aux extensions de l'environnement de développement (serveurs MCP `rea-agents`, `wacopilote`, `googlecloudtools.datacloud`, `dak`) tournaient au repos. **Aucun `next dev` ni `next start` ne tournait** sur les ports 3100, 3200 ou 3300.

### Espace disque sur `C:` (`Get-PSDrive C`, mesuré le 30/10/2026)

- **Utilisé (`Used`)** : `300 712 550 400` octets (~280,06 Gio)
- **Libre (`Free`)** : `57 299 603 456` octets (~53,36 Gio)

---

## 2. Tableau comparatif des routes (A1–A5 & Phase B — mesuré le 30/10/2026)

Ressource publiée utilisée pour la fiche produit : `portrait-wax-editorial` (« Portrait Wax Éditorial »).

- **C1 (Avant — `pnpm dev` avec webpack)** : `SLOW_QUERY_MS=0 pnpm exec next dev -p 3300` → démarrage serveur `✓ Ready in 17.7s` (second démarrage : `7.0s`).
- **C2 (Après — `pnpm dev` avec Turbopack)** : `SLOW_QUERY_MS=0 pnpm exec next dev --turbopack -p 3300` → démarrage serveur `✓ Ready in 5.1s` (second démarrage : `4.3s`). Aucune erreur ni avertissement de compatibilité Turbopack ; toutes les pages rendent un HTML complet (`HTTP 200`).
- **C3 (Production locale)** : `NEXT_DIST_DIR=".next-verif" pnpm build` (compilé en 2,5 min) puis `NEXT_DIST_DIR=".next-verif" SLOW_QUERY_MS=0 pnpm exec next start -p 3300` → démarrage serveur `✓ Ready in 1.74s`.

> **Note de lecture** : dans un serveur de développement (`C1` ou `C2`), la **toute première route visitée** après le démarrage compile le socle partagé (`app/layout.tsx`, polices Google, en-tête, pied de page, client Prisma), tandis que les routes visitées ensuite ne compilent que leur différentiel. Pour `/products/portrait-wax-editorial`, les deux cas ont été mesurés le 30/10/2026 : visitée après `/` dans la même session, et visitée comme **toute première route** à froid après le démarrage du serveur.

| Route | C1 1er appel (Avant — webpack) | C1 à chaud (appels 2 / 3) | C2 1er appel (Après — Turbopack) | C2 à chaud (appels 2 / 3) | C3 1er appel / à chaud (prod `next start`) | Requêtes SQL (C3) | Temps base cumulé (C3 1er appel / à chaud) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Démarrage serveur (`Ready`)** | `17,7 s` (`7,0 s` au 2e lancement) | — | **`5,1 s`** (`4,3 s` au 2e lancement, **-71 %**) | — | **`1,74 s`** | 0 | 0 ms |
| `/` | `46,65 s` (`ttfb=46,55 s`, compile `39,3 s` / 2 171 modules + timeout 3 s `next/font`) | `0,92 s` / `1,33 s` | **`29,69 s`** (`ttfb=29,55 s`, compile `22,5 s`, **-36 %**) | `1,32 s` / `1,25 s` | `0,571 s` (1er) / **`0,143 s` – `0,168 s`** (chaud) | 30 | `692 ms` (1er, en `Promise.all`) / **`192 ms` – `129 ms`** (chaud) |
| `/explore` | `7,42 s` (`ttfb=6,88 s`, compile `5,7 s` / 2 151 modules) | `0,61 s` / `0,72 s` | **`4,02 s`** (`ttfb=3,10 s`, compile `2,1 s`, **-46 % total / -63 % compile**) | `1,43 s` / `1,27 s` | **`0,065 s`** (1er) / **`0,067 s` – `0,160 s`** (chaud) | 8 | `11 ms` (1er) / **`16 ms` – `12 ms`** (chaud) |
| `/products/portrait-wax-editorial` *(visitée après `/`)* | `8,67 s` (`ttfb=8,64 s`, compile `4,2 s` / 2 255 modules) | `0,75 s` / `0,93 s` | **`5,52 s`** (`ttfb=5,50 s`, compile `1,58 s`, **-36 % total / -62 % compile**) | `1,22 s` / `1,11 s` | `0,130 s` (1er) / **`0,066 s` – `0,145 s`** (chaud) | 12 *(17 en dev C1/C2)* | `43 ms` (1er) / **`14 ms` – `29 ms`** (chaud) |
| `/products/portrait-wax-editorial` *(1re route à froid après démarrage)* | **`20,05 s`** (`ttfb=19,99 s`, compile `11,8 s` / 1 071 modules) | `0,56 s` / `0,59 s` | `22,12 s` (`ttfb=22,04 s`, compile `15,0 s`) | `0,92 s` / `0,74 s` | `0,130 s` (1er) / **`0,066 s`** (chaud) | 12 *(17 en dev C1/C2)* | `43 ms` (1er) / **`14 ms`** (chaud) |
| `/createurs` | `3,72 s` (`ttfb=3,68 s`, compile `1,66 s` / 2 263 modules) | `0,68 s` / `0,43 s` | **`2,70 s`** (`ttfb=2,64 s`, compile `1,15 s`, **-27 % total / -31 % compile**) | `0,77 s` / `0,76 s` | `0,062 s` (1er) / **`0,049 s` – `0,043 s`** (chaud) | 4 | `11 ms` (1er) / **`6 ms` – `7 ms`** (chaud) |
| `/connexion` | `6,23 s` (`ttfb=6,17 s`, compile `3,50 s` / 2 303 modules) | `0,41 s` / `0,27 s` | **`2,64 s`** (`ttfb=2,63 s`, compile `1,12 s`, **-58 % total / -68 % compile**) | `0,60 s` / `0,58 s` | `0,033 s` (1er) / **`0,025 s` – `0,017 s`** (chaud) | 0 | `0 ms` |

### Détail du temps passé en base en C3 sur `/products/portrait-wax-editorial` (A4 — mesuré le 30/10/2026)

En production locale (`C3`, sans compilation à la volée), l'affichage d'une fiche produit exécute **12 requêtes SQL**, contre 17 en développement (`C1`/`C2`).

L'explication suivante est **supposée, pas vérifiée** : Prisma regroupe les `findUnique` lancés dans le même tour de boucle. En production, les deux appels à `obtenirProduit(slug)`, venus de `generateMetadata` et de `FicheProduitPage`, tomberaient ensemble, d'où le `SELECT ... WHERE "Product"."slug" IN ($1, $2)` observé. En développement, ils seraient séparés.

- **Nombre de requêtes SQL (C3)** : **12 requêtes** par visite de fiche.
- **Durée totale cumulée des 12 requêtes (C3)** :
  - 1er appel : **43 ms** (temps de réponse HTTP total : `130 ms`) ;
  - 2e appel (à chaud) : **14 ms** (10 requêtes à `1 ms` et 2 requêtes à `2 ms`, temps de réponse HTTP total : **`66 ms`**) ;
  - 3e appel (à chaud) : **29 ms** (temps de réponse HTTP total : `145 ms`).
- **Les 3 requêtes les plus lentes sur la fiche en C3** :
  1. `SELECT "id", "filename", "sizeBytes", "externalUrl", "mediaId", "productId" FROM "ProductFile" WHERE "role" = 'SOURCE' AND "deletedAt" IS NULL AND "productId" IN ($2) ORDER BY "sizeBytes" DESC NULLS LAST` : **`10 ms`** au 1er appel (`1 ms` à chaud) ;
  2. `SELECT "id", "filename", "externalUrl", "productId" FROM "ProductFile" WHERE "role" = 'SOURCE' AND "deletedAt" IS NULL AND "productId" IN ($2) ORDER BY "position" ASC` : **`11 ms`** au 3e appel (`1 ms` à `3 ms` aux appels 1–2) ;
  3. `SELECT "id", "authorId", "parentId", "body", "deletedAt", "isFlagged", "createdAt" FROM "Comment" WHERE "productId" = $1 ORDER BY "createdAt" ASC LIMIT $2` : **`7 ms`** au 1er appel (`2 ms` à `5 ms` à chaud).

### Coût d'un aller-retour Prisma (`20 × SELECT 1`) : `localhost:5433` vs `127.0.0.1:5433` (A4 — mesuré le 30/10/2026)

Script exécuté hors du dépôt en deux passes indépendantes par hôte :

| Hôte | Passe | 1re requête (connexion TCP + pool Prisma) | Total des 20 `SELECT 1` | Moyenne sur les 19 requêtes à chaud | Min / Max à chaud |
| --- | --- | --- | --- | --- | --- |
| `localhost:5433` | Passe 1 | `86,62 ms` | `123,89 ms` | **`1,96 ms`** | `1,52 ms` / `2,80 ms` |
| `127.0.0.1:5433` | Passe 1 | `71,27 ms` | `116,66 ms` | **`2,39 ms`** | `2,00 ms` / `3,10 ms` |
| `localhost:5433` | Passe 2 | `80,64 ms` | `116,59 ms` | **`1,89 ms`** | `1,61 ms` / `2,50 ms` |
| `127.0.0.1:5433` | Passe 2 | `86,53 ms` | `135,16 ms` | **`2,56 ms`** | `1,70 ms` / `4,20 ms` |

L'hypothèse d'une pénalité IPv6 (`::1`) sur `localhost` sous Windows est **infirmée par la mesure** : `localhost:5433` répond en **`1,89–1,96 ms`** par aller-retour à chaud, au même niveau que `127.0.0.1:5433` (`2,39–2,56 ms`).

---

## 3. Où part le temps (Conclusion — A5)

1. **La latence de 20 s sur une fiche produit et de 15 à 46 s au changement de page provient à plus de 97 % de la compilation à la demande du serveur de développement (`next dev`) sous Windows, et non de l'application ni de PostgreSQL** : en production locale pré-compilée (`C3`), la fiche `/products/portrait-wax-editorial` répond en **`0,066 s` (`66 ms`)** à chaud (`0,130 s` au 1er appel) contre **`20,05 s`** à froid en développement webpack (`C1`).
2. **Sur l'accueil (`/`), le 1er appel en `C1` (webpack) culmine à `46,65 s`** parce que webpack compile 2 171 modules (`39,3 s`) et subit en prime un délai d'expiration réseau de `3 000 ms` (`Request timed out after 3000ms / Retrying 1/3...`) lors du téléchargement initial des polices `next/font/google`, alors que la même page pré-compilée en `C3` répond en **`0,143 s` (`143 ms`)** à chaud.
3. **La base de données PostgreSQL est hors de cause dans le symptôme observé** : un aller-retour `SELECT 1` sur `localhost:5433` coûte **`1,9 ms`** à chaud, et l'ensemble des 12 requêtes SQL de la fiche produit en `C3` s'exécute en **`14 ms` à `43 ms`** au total (`11 à 16 ms` pour les 8 requêtes de `/explore`, `6 à 11 ms` pour les 4 requêtes de `/createurs`).
4. **Le passage du serveur de développement à Turbopack (`C2`) réduit fortement le coût de démarrage et de navigation entre pages** : le démarrage du serveur tombe de **`17,7 s` à `5,1 s` (`-71 %`)**, la 1re compilation de `/` passe de **`46,65 s` à `29,69 s` (`-17 s`)**, et la compilation lors d'un changement de page diminue de **62 à 68 %** (`/explore` : `5,7 s → 2,1 s` ; `/products/[slug]` après `/` : `4,2 s → 1,58 s` ; `/connexion` : `3,5 s → 1,12 s`).
5. **Deux mesures vont dans l'autre sens, et Turbopack ne règle donc pas tout** (ajouté le 30/10/2026 à la relecture, mêmes chiffres que le tableau) :
   - **la fiche ouverte comme toute première page** après le démarrage n'est pas plus rapide : `20,05 s` avec webpack, `22,12 s` avec Turbopack. Le symptôme rapporté, « une fiche met plus de 20 s », reste entier dans ce cas ;
   - **les rechargements à chaud sont plus lents** avec Turbopack, de l'ordre de `0,3 à 0,7 s` de plus par appel : la fiche passe de `0,75 / 0,93 s` à `1,22 / 1,11 s`, `/explore` de `0,61 / 0,72 s` à `1,43 / 1,27 s`.

   Chaque case du tableau ne repose que sur **un seul passage**. Des écarts de cette taille peuvent venir du bruit de la machine, et il faudrait plusieurs passages pour trancher. Le passage à Turbopack reste justifié par le démarrage et la navigation, qui représentent l'essentiel d'une séance de travail, et `pnpm dev:webpack` reste disponible en secours.

---

## 4. Ce qui a été corrigé (Phase B)

Conformément à l'arbre de décision de la section 4 du guide (*« Si la compilation domine (C1 lent au premier appel, C3 rapide) : Si C2 (Turbopack) affiche toutes les pages correctement et va nettement plus vite, passe le script `dev` de `package.json` à `next dev --turbopack -p 3100`. Ajoute un `dev:webpack` qui garde l'ancien comportement en secours »*) :

1. **[`package.json`](../package.json)** :
   - **Avant** :
     ```json
     "dev": "next dev -p 3100",
     ```
   - **Après** :
     ```json
     "dev": "next dev --turbopack -p 3100",
     "dev:webpack": "next dev -p 3100",
     ```
   - **Gain mesuré le 30/10/2026** : démarrage `Ready` de `17,7 s` → `5,1 s` (`4,3 s` au 2e lancement) ; 1er accès `/` de `46,65 s` → `29,69 s` ; navigation vers `/explore` de `7,42 s` → `4,02 s` ; navigation vers `/products/portrait-wax-editorial` (après `/`) de `8,67 s` → `5,52 s` ; navigation vers `/createurs` de `3,72 s` → `2,70 s` ; navigation vers `/connexion` de `6,23 s` → `2,64 s`.
2. **[`README.md`](../README.md)** :
   - Documentation du passage de `pnpm dev` à Turbopack avec les mesures du 30/10/2026 et ajout de la ligne `pnpm dev:webpack` dans le tableau des commandes utiles.

---

## 5. Ce qui est proposé sans être fait (avec mesures à l'appui)

### 5.1. Déduplication par requête (`React.cache`) et mutualisation SQL sur la fiche produit (`/products/[slug]`)

- **Constat mesuré le 30/10/2026** :
  - Dans [`app/products/[slug]/page.tsx`](../app/products/%5Bslug%5D/page.tsx), `generateMetadata` (ligne 20) et `FicheProduitPage` (ligne 67) appellent tous deux `obtenirProduit(slug)` ([`lib/products/queries.ts`](../lib/products/queries.ts#L233)) au cours de la même requête HTTP.
  - Contrairement à `sessionCourante` ([`lib/auth/session.ts`](../lib/auth/session.ts)), `obtenirProduit` n'est pas enveloppée dans `cache()` de `"react"`.
  - **Effet mesuré en `C1`/`C2` (`next dev`)** : les 6 requêtes SQL de `obtenirProduit` (`Product`, `User`, `Profile`, `ProductFile`, `MediaAsset` et `Product.findMany` pour `duMemeCreateur`) sont exécutées **deux fois** à chaque affichage de fiche (12 requêtes au lieu de 6, soit **`35 à 130 ms`** de requêtes redondantes).
  - **Effet mesuré en `C3` (`next start`)** : le moteur Prisma fusionne le `findUnique` sur `Product` (`WHERE "Product"."slug" IN ($1, $2)`), mais la requête `db.product.findMany` (`duMemeCreateur`) reste exécutée **deux fois** (lignes 129–130 du journal C3).
  - De plus, `FicheProduitPage` appelle ensuite `droitDeTelecharger(produit.id)` (qui relit `Product` et `ProductFile` : 2 requêtes) et `etatSocial` (qui relit `Product.likesCount, commentsCount` et `User.followersCount` : 2 requêtes).
- **Remède proposé** : envelopper `obtenirProduit` dans `cache()` de `"react"` (gain immédiat : **-6 requêtes SQL par fiche en dev, -1 requête en prod**, soit ~15–60 ms gagnés sans aucun changement de comportement ni mise en cache inter-requêtes).

### 5.2. Requêtes en doublon sur la page d'accueil (`/`, 30 requêtes SQL par visite)

- **Constat mesuré le 30/10/2026** :
  - Chaque visite de `/` exécute **30 requêtes SQL** (`692 ms` cumulés en parallèle au 1er appel C3, `129 à 192 ms` à chaud).
  - Trois requêtes identiques y sont lancées **en double** au sein du même rendu :
    1. `SELECT COUNT(*) AS "_count$_all", "family"::text FROM "Product" WHERE status = 'PUBLISHED' AND "family" IS NOT NULL GROUP BY "family"` (exécutée 2 fois : `50 ms` + `17 ms` au 1er appel C3) ;
    2. `SELECT ... FROM "Profile" LEFT JOIN "User" WHERE suspendedAt IS NULL AND EXISTS (SELECT sellerId FROM "Product" WHERE status = 'PUBLISHED' ...) ORDER BY "followerCount" DESC, "displayName" ASC LIMIT ...` (exécutée 2 fois : `65 ms` + `30 ms` au 1er appel C3) ;
    3. `SELECT ... FROM "Product" WHERE status = 'PUBLISHED' AND "isStaffPicked" = true ORDER BY "staffPickedAt" DESC, "id" DESC` (exécutée 2 fois : `55 ms` + `39 ms` au 1er appel C3).
- **Remède proposé** : mutualiser ces lectures dans le chargement de `app/page.tsx` ou via `React.cache` par requête (gain estimé : passage de 30 à ~24 requêtes SQL sur `/` et réduction d'environ `30 à 50 ms` sur le TTFB à chaud).

### 5.3. Index PostgreSQL (`EXPLAIN ANALYZE` mesuré le 30/10/2026)

1. **Fichiers sources d'un produit (`ProductFile` sur `/products/[slug]`)** :
   ```text
   Sort  (cost=8.18..8.19 rows=1 width=163) (actual time=0.139..0.141 rows=1 loops=1)
     Sort Key: "sizeBytes" DESC NULLS LAST
     Sort Method: quicksort  Memory: 25kB
     Buffers: shared hit=5
     ->  Index Scan using "ProductFile_productId_role_deletedAt_idx" on "ProductFile"
           (cost=0.15..8.17 rows=1 width=163) (actual time=0.039..0.040 rows=1 loops=1)
           Index Cond: (("productId" = '...') AND (role = 'SOURCE') AND ("deletedAt" IS NULL))
   Execution Time: 0.206 ms
   ```
   L'index composite `ProductFile_productId_role_deletedAt_idx` est **déjà présent et utilisé** (`0,206 ms`). Aucun index supplémentaire n'est requis sur `ProductFile`.

2. **Couverture par famille sur l'accueil (`DISTINCT ON ("family")` sur `Product`)** :
   ```text
   Unique  (cost=11.73..12.16 rows=10 width=87) (actual time=0.250..0.266 rows=8 loops=1)
     Buffers: shared hit=15
     ->  Sort  (cost=11.73..11.94 rows=86 width=87) (actual time=0.250..0.256 rows=102 loops=1)
           Sort Key: family, "createdAt" DESC
           Sort Method: quicksort  Memory: 36kB
           Buffers: shared hit=15
           ->  Seq Scan on "Product"  (cost=0.00..8.96 rows=86 width=87) (actual time=0.012..0.065 rows=102 loops=1)
                 Filter: ((family IS NOT NULL) AND ("coverUrl" IS NOT NULL) AND (status = 'PUBLISHED'))
                 Rows Removed by Filter: 29
   Execution Time: 0.301 ms
   ```
   Sur le jeu de développement (131 produits), le `Seq Scan` + `Sort` ne prend que `0,301 ms`. Si le catalogue dépasse plusieurs dizaines de milliers de produits publiés, un index `@@index([status, family, createdAt(sort: Desc)])` permettra d'éviter le tri complet en mémoire.

### 5.4. Les `export const dynamic = "force-dynamic"` et le cache (lu le 30/10/2026)

- **Lu dans `app/` le 30/10/2026** : 110 fichiers déclarent `export const dynamic = "force-dynamic"`.
- Pourquoi même les pages documentaires (`app/conditions/page.tsx`, `app/confidentialite/page.tsx`, `app/cookies/page.tsx`, `app/licences/page.tsx`, `app/a-propos/page.tsx`, `app/tarifs/page.tsx`, `app/fonctionnalites/page.tsx`, `app/documentation/page.tsx`, `app/regles-de-publication/page.tsx`, `app/support/page.tsx`) sont dynamiques : elles appellent toutes `await sessionCourante()` côté serveur afin de passer `visiteur` à `<PageDocument visiteur={visiteur}>` (qui affiche l'avatar ou le bouton « Se connecter » dans `<Header>`). Comme `sessionCourante()` lit `cookies()`, Next.js les rendrait dynamiquement même sans la constante `force-dynamic`.
- En production locale (`C3`), ces pages légères répondent en **`17 à 33 ms`** (exemple mesuré sur `/connexion` : `17 ms` à chaud). Le retrait de `force-dynamic` n'apporterait de gain que si l'état connecté du `<Header>` était lu côté client ou dans un sous-composant dédié sur les pages institutionnelles.

### 5.5. Réglages de la machine et du réseau local en développement

- **Téléchargement des polices Google (`next/font/google`)** : lors du 1er appel sur `/` en `C1`, le serveur a enregistré `Request timed out after 3000ms / Retrying 1/3...` (3 s perdues sur l'appel externe vers Google Fonts). Si la connexion réseau locale fluctue, embarquer les 3 fichiers `.woff2` dans `assets/polices/` avec `next/font/local` éliminerait tout appel réseau externe au démarrage de `next dev`.
- **Système de fichiers Windows 11 / Windows Defender** : la première compilation d'une route lourde (`/` ou `/products/[slug]` visitée en 1re route) ouvre et analyse plus de 2 000 fichiers sous `node_modules/.pnpm`. L'utilisateur peut, s'il le souhaite, exclure le dossier du dépôt ou `node_modules` de l'analyse temps réel de Windows Defender (aucun réglage système n'a été touché par cette mission).

---

## 6. Ce qui n'a pas été mesuré, et pourquoi

- **Les écrans du tableau de bord (`/dashboard/*`)** : conformément à la consigne A1 du guide (*« Les pages du tableau de bord demandent une session. Mesure-les seulement si tu peux le faire proprement : avec un cookie de session d'un compte de test, obtenu par une connexion dans le navigateur. [...] Si tu ne peux pas le faire proprement, saute-les et dis-le »*), ces pages n'ont pas été mesurées avec `curl.exe` faute de session ouverte dans un navigateur. La cause principale des 15–20 s au premier affichage (compilation à la demande de chaque route par webpack dans `next dev`) s'applique toutefois de la même manière aux 39 routes sous `app/dashboard/`.

