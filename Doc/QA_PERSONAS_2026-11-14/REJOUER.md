# Rejouer la recette par personas — mode d'emploi

> **Pour qui.** L'administrateur du dépôt, ou toute personne qui doit vérifier
> un défaut de la recette du 14/11/2026, confirmer une correction ou montrer un
> défaut à quelqu'un, sans l'auteur de la recette.
>
> **Ce qu'il faut avoir lu avant.** Rien. Les deux comptes rendus expliquent le
> *pourquoi* ; ce fichier ne donne que le *comment* :
>
> - [`../QA_PERSONAS_2026-11-14.md`](../QA_PERSONAS_2026-11-14.md) : la première
>   campagne, 36 défauts (Q-01 à Q-36), l'avis de chaque persona ;
> - [`../QA_PERSONAS_2026-11-14-suite.md`](../QA_PERSONAS_2026-11-14-suite.md) :
>   les six pistes, 8 défauts de plus (Q-37 à Q-44), le protocole d'une vraie
>   séance d'utilisateurs.

Trois niveaux, du plus rapide au plus complet. Le premier suffit pour savoir
si un défaut est encore là.

| Niveau | Ce qu'on obtient | Durée | Ce qu'il faut |
| --- | --- | --- | --- |
| 1. Les tests automatiques | Pour 11 défauts : présent ou corrigé | ~10 min, compilation comprise | Le dépôt et PostgreSQL |
| 2. La régie | Voir quatre personas rejouer des défauts, en direct | ~1 h la première fois | Un environnement de recette complet |
| 3. Les pistes | Rejouer la salle de classe, l'horloge, la traduction | Variable | Le niveau 2 |

Règles qui valent pour les trois (`CLAUDE.md`) :

- **Jamais sur la base de développement.** Chaque URL de base se nomme en
  clair, sur un nom à soi.
- **Une seule suite de tests à la fois** sur la machine.
- **Aucun mot de passe recopié** : ni dans un fichier suivi par git, ni dans un
  commit, ni dans un message.
- **Aucun test de sécurité.** Le responsable du dépôt les a retirés du périmètre
  de cette recette.

---

## Niveau 1 — Les tests automatiques

Le fichier est [`e2e/qa-personas.spec.ts`](../../e2e/qa-personas.spec.ts). Il
couvre Q-02 à Q-10, Q-37 et Q-38. Q-01 y est écrit mais désactivé (voir son
commentaire).

### Comment ils se lisent

Chaque test décrit le **bon** comportement, et l'enferme dans `defautOuvert()` :

| Ce qu'affiche le test | Ce que ça veut dire | Quoi faire |
| --- | --- | --- |
| Vert, en mode normal | Le défaut est toujours là | Rien |
| Rouge, en mode normal, message « Q-xx semble corrigé » | Le défaut a disparu | Retirer `defautOuvert()` autour de la vérification : le test devient le garde-fou de la correction |
| Rouge, en mode normal, autre message | Un préparatif a cassé (page renommée, bouton déplacé) | Lire le message : c'est le test qu'il faut adapter, pas le défaut qui a changé |
| Rouge, en mode strict | Le défaut est là, et le message dit lequel | C'est le mode pour **voir** les défauts |

### Les commandes

Depuis la racine d'une copie de travail à soi, dépendances installées
(`pnpm install`), PostgreSQL du projet démarré (`docker compose up -d postgres`,
port 5433) :

```sh
# Une base et un port à soi. Remplacer <prenom>.
export DATABASE_URL_E2E="postgresql://baobart:baobart@localhost:5433/baobart_e2e_<prenom>?schema=public"
export E2E_PORT=3410

# Une base neuve se crée à la main AVANT le premier lancement (piège connu, CLAUDE.md).
node scripts/setup-test-db.mjs e2e

# Le lanceur compile puis démarre l'application tout seul (quelques minutes la première fois).
pnpm exec playwright test qa-personas                         # mode normal : tout vert
QA_DEFAUTS_STRICTS=1 pnpm exec playwright test qa-personas    # mode strict : un rouge par défaut
pnpm exec playwright test qa-personas -g "Q-37"               # un seul défaut
```

Sous PowerShell, les variables s'écrivent `$env:E2E_PORT = "3410"`.

### Ce qui a été mesuré

| Date | Version | Mode strict | Suite navigateur complète, mode normal |
| --- | --- | --- | --- |
| 14/11/2026 | `main` v1.107.0 (`132c75e`) | 11 rouges sur 11 | 11 verts, 1 désactivé (fichier seul) |
| 15/11/2026 | `main` + #57 (v1.108.2) | 11 rouges sur 11, valeurs identiques | 43 verts, 1 désactivé, en 1,9 min |

**Si un test échoue au premier lancement avec « Trop de tentatives »** : le
quota d'inscription (5 envois par heure) est partagé par tous les tests d'un
même serveur. C'est Q-01. Redémarrer le serveur remet le compteur à zéro.

---

## Niveau 2 — La régie

Une page qui montre les quatre personas en direct : les deux téléphones à
gauche, les deux ordinateurs à droite, une légende sous chacun. On lance une
scène, on regarde le défaut se produire.

### 2.1 Préparer l'environnement de recette, une fois

Tout se fait dans une **copie de travail à part**, jamais dans la copie
principale :

```sh
git worktree add ../Baobart-qa origin/main
cd ../Baobart-qa
corepack pnpm install --frozen-lockfile
cp -r Doc/QA_PERSONAS_2026-11-14/outils qa      # les outils, là où ils s'attendent à être
```

**Deux conteneurs**, en plus de PostgreSQL :

```sh
# Stockage des fichiers. L'image officielle refuse le téléchargement anonyme (mesuré le 14/11) ;
# celle-ci est la remplaçante citée dans docker-compose.yml. Choisir son propre mot de passe.
docker run -d --name baobart-minio-qa -p 9100:9000 \
  -e MINIO_ROOT_USER=<utilisateur> -e MINIO_ROOT_PASSWORD=<mot de passe> \
  bitnamilegacy/minio:2025.7.23-debian-12-r5

# Courriels : une boîte de test, pour lire les codes et les liens reçus.
docker run -d --name baobart-mailpit-qa -p 1125:1025 -p 8125:8025 axllent/mailpit:v1.21
```

**Le `.env` de cette copie** (non suivi par git) : partir de `.env.example`, et
poser au moins ceci. Chaque base est écrite en clair, sur un nom à soi.

| Variable | Valeur | Pourquoi |
| --- | --- | --- |
| `DATABASE_URL`, `DIRECT_URL`, `DATABASE_URL_E2E` | `postgresql://baobart:baobart@localhost:5433/baobart_recette_<prenom>?schema=public` | Les trois, pour qu'aucun script ne retombe sur la base de développement |
| `APP_URL` | `http://127.0.0.1:3400` | Le port de la recette |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | `http://127.0.0.1:9100`, et l'utilisateur et le mot de passe choisis plus haut | |
| `S3_BUCKET`, `S3_FORCE_PATH_STYLE`, `S3_REGION` | un nom à soi, `true`, `auto` | L'application crée le seau elle-même |
| `EMAIL_DRIVER`, `SMTP_URL` | `smtp`, `smtp://127.0.0.1:1125` | Le pilote « console » n'écrit que le sujet, pas les liens |
| `CRON_SECRET` | une longue chaîne au hasard | Sans elle, aucun courriel ne part de la file |
| `CHECKOUT_SIMULATION_ENABLED`, `PAYMENTS_DRIVER` | `1`, vide | Paiement simulé, aucun opérateur |
| `RATE_LIMIT_DRIVER` | `memoire` | Pas besoin de Redis |

Puis :

```sh
node scripts/setup-test-db.mjs e2e      # crée la base nommée dans DATABASE_URL_E2E
pnpm exec prisma generate && pnpm db:seed
NODE_ENV=production pnpm exec next build
```

### 2.2 Créer les personas, à la main

**Chaque compte s'inscrit par la page `/inscription`, un par un, jamais par
script** : l'inscription fait partie de ce qu'on éprouve. Les identités sont
celles de la recette (premier compte rendu, section 3.2) : Awa Diallo, Serge
Nkosi, Yao Mensah, Fatou Sow. Les adresses peuvent être celles de la recette
(`awa.diallo@studio-dakar.test`…) ; **les mots de passe, chacun choisit les
siens**.

Seule exception : le rôle d'administratrice, qu'aucun écran n'accorde, se pose
sur un compte déjà inscrit avec `pnpm comptes:test --qualifier <adresse> admin`.

Les scènes de la régie se connectent avec ces comptes. Leurs adresses et mots
de passe se mettent dans `qa/demo/.comptes`, qui ne quitte pas le poste :

```sh
AWA_COURRIEL='…'; AWA_MDP='…'
SERGE_COURRIEL='…'; SERGE_MDP='…'
FATOU_COURRIEL='…'; FATOU_MDP='…'
```

**Les scènes supposent les données de la recette** : une ressource vendue par
Awa puis dépubliée, le pack « Pack motifs wax — 12 planches » à acheter, etc.
Sur une base neuve, jouer d'abord à la main les parcours du premier compte
rendu (section 5), ou adapter les scènes.

### 2.3 Lancer la régie

Trois processus, chacun dans son terminal, depuis la racine de la copie :

```sh
# 1. L'application, comme en production
NODE_ENV=production node node_modules/next/dist/bin/next start -p 3400

# 2. Le pilote, en mode régie (il garde un navigateur par persona)
QA_REGIE=1 node qa/pilote.mjs

# 3. Les quatre scènes, jouées en même temps (37 secondes)
sh qa/demo/jouer.sh
```

Puis ouvrir **http://127.0.0.1:3499/regie** dans un navigateur.

| Écran | Ce qu'on voit | Défaut |
| --- | --- | --- |
| Yao, téléphone | Mot de passe de 7 caractères : les six champs de l'inscription se vident | Q-02 |
| Awa, téléphone | Elle change son délai de remboursement ; le site confirme, la liste affiche l'ancien | Q-38 |
| Serge, ordinateur | Les fichiers d'une ressource achetée : « Cette page n'existe pas ». Puis un code promo faux le fait sortir du paiement | Q-37, Q-10 |
| Fatou, ordinateur | Depuis Paris : quatre pays de facturation, pas la France | Piste 1 |

**Écrire sa propre scène** : un fichier de gestes Playwright (`page`,
`context`), où `h.dire("…")` écrit la légende sous l'écran du persona. On
l'envoie avec `node qa/c.mjs <persona> < ma-scene.js`. Plusieurs envois lancés
ensemble se jouent en parallèle.

**Ce que la régie ne montre pas** : le doigt et le curseur (ce sont les
légendes qui disent ce qui est touché). Environ trois images par seconde. Les
scènes prennent leur temps exprès, pour qu'on puisse suivre : une scène de
régie ne mesure pas une durée.

**Si un écran reste vide** : le pilote s'arrête avec le terminal qui l'a
lancé. Le relancer, puis recharger la page de la régie.

---

## Niveau 3 — Les pistes de la seconde campagne

Toutes supposent le niveau 2 en place (application sur 3400, pilote sur 3499).

### La salle de classe (Q-01 chiffré)

```sh
node qa/classe.mjs 1 30 a     # trente élèves, série « a » ; changer de lettre à chaque passe
```

Le scénario est fixé dans l'en-tête de `classe.mjs` : 18 élèves sans erreur,
12 avec une erreur chacun. Les élèves tapent à vitesse humaine : l'anti-automate
du site refuse un formulaire envoyé moins de deux secondes après l'ouverture de
la page. **Redémarrer l'application avant chaque passe** : les compteurs de
tentatives vivent dans sa mémoire.

Mesuré le 14/11/2026 : 4 comptes créés sur 30, attente annoncée de 22 à 108 minutes.

### L'horloge (Q-39 à Q-42)

```powershell
powershell -File qa/serveur-a.ps1 -Jours 8    # l'application croit être 8 jours plus tard
sh qa/etape.sh                                # les tâches planifiées, dans l'ordre d'une nuit
sh qa/lire.sh awa "[['/dashboard/gains','REVENUS',400]]"
powershell -File qa/serveur-a.ps1 -Jours 0    # revenir à l'heure vraie
```

Seul le serveur vieillit. La base, le stockage et le navigateur restent à
l'heure vraie : ne rien conclure d'un téléchargement fait sous décalage.

### La traduction automatique (Q-43, Q-44)

```sh
node qa/vrai-traducteur.mjs <dossier de profil neuf>
QA_COURRIEL='…' QA_MDP='…' node qa/vrai-traducteur.mjs <dossier>   # avec un membre connecté
```

Il lance le Chrome installé sur le poste, réglé pour toujours traduire le
français en anglais. **Le texte des pages part chez le service de traduction de
Google** : uniquement sur des données fictives. Pour éprouver le mécanisme sans
rien envoyer, `qa/traducteur.js` le reproduit dans la page (injecté par
`page.addScriptTag`).

---

## Tout retirer

```sh
docker rm -f baobart-minio-qa baobart-mailpit-qa
docker exec baobart-postgres psql -U baobart -d postgres -c "DROP DATABASE baobart_recette_<prenom>;"
git worktree remove ../Baobart-qa
```

Avant le `DROP DATABASE`, relire le nom : c'est lui qui sera détruit.
