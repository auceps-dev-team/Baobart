# Instructions — Baobart

## Comptes rendus de fin de tâche

Quand une tâche est terminée, le compte rendu s'adresse à un **étudiant de première
année en informatique** : quelqu'un d'intelligent, mais qui ne connaît ni le projet,
ni le vocabulaire spécialisé. Le ton est celui d'un professeur qui explique, pas
d'un expert qui résume entre pairs.

**Structure attendue**

```
### 🌱 Explication simplifiée
Le problème et la solution en langage courant. Chaque terme technique est défini
la première fois qu'il apparaît : « RLS (Row Level Security) = une règle qui
limite ce qu'un utilisateur peut voir dans la base ».

### 🛠️ Ce que ça implique
Les conséquences concrètes : ce qui change, ce que ça coûte, ce que ça ne règle pas.

### 🚀 Ce qui a été fait
Les étapes réellement livrées, numérotées.

### ❓ Question clé   (seulement s'il reste une décision à prendre)
Les options, avec ce que chacune implique.

👉 Pour t'entraîner : une question ouverte qui fait reformuler l'idée centrale.
```

**Règles de rédaction**

- Expliquer le *pourquoi* avant le *comment*. Un étudiant retient un raisonnement,
  pas une liste de commandes.
- Un terme non défini est un terme perdu : `IDOR`, `RLS`, `lockfile`, `HMAC`,
  `tenant` — tous se définissent en passant, en une demi-phrase.
- Les chiffres se commentent. « 652 appels » ne dit rien ; « 652 appels, soit trois
  fois plus que le client sécurisé » dit quelque chose.
- Dire ce qui **ne** marche **pas** et ce qui reste ouvert. Un compte rendu qui ne
  mentionne que les succès n'apprend rien et induit en erreur.
- Garder les sections courtes. Mieux vaut cinq phrases claires qu'un paragraphe
  exhaustif.

Cette consigne concerne le compte rendu **final**. Pendant le travail, les messages
intermédiaires restent brefs et factuels.

## Ce qu'on a le droit d'affirmer

Trois fois en une semaine, sur un autre chantier, une affirmation confiante
s'est révélée fausse. Les trois fois, **l'observation était juste et la
conclusion ne l'était pas**. Cette section existe pour que ça ne recommence pas
ici — et elle a déjà servi une fois, le 17 septembre 2026, sur ce dépôt.

### Une affirmation négative coûte plus cher qu'une positive

« Cette fonction rend `null` quand X » se prouve par un appel. « Ce projet ne
fait jamais Y » ne se prouve par **aucun** nombre d'appels : elle exige d'avoir
épuisé les sources, et on ne les épuise jamais.

**Avant d'écrire qu'une chose n'existe pas, écrire d'abord ce qu'il faudrait
avoir lu pour en être sûr.** Souvent, la phrase s'arrête là.

Le cas de ce dépôt : « ce projet ne rend d'HTML nulle part » a été écrit dans
l'en-tête de `lib/blog/corps.ts` et dans §28 de la spec, et toute la conception
du blog repose dessus. La preuve tenait en **un grep, quatre termes, un glob
qui excluait `.mjs` et `.js`**.

Revérifiée correctement, la conclusion tenait — mais pas telle qu'écrite :
`innerHTML` apparaît cinq fois dans `Baobart Design/support.js`. Ce fichier
n'est pas servi, donc la propriété vaut ; mais le prochain qui grep aurait
trouvé ces cinq occurrences et cru que l'en-tête mentait.

### Le silence d'une source n'est pas une preuve

« La documentation n'en parle pas » veut presque toujours dire « la
documentation **que j'ai lue** n'en parle pas ». Ce sont deux phrases
différentes, et seule la seconde est vérifiable.

Le cas de ce dépôt : « Gumroad n'a pas de centre de notifications in-app » a
été publié comme un constat, et a décidé de l'architecture des notifications.
Il reposait sur le listing de **deux répertoires** — `app/models` et
`app/services` — résumés par un outil. Ni `app/controllers`, ni les routes, ni
le front n'ont été ouverts.

La conclusion reste cohérente avec le reste des indices, et la spec le dit
maintenant en nommant ce qui n'a pas été consulté.

### Avant de contredire, chercher d'où ça vient

Une fiche, un commentaire, un test, le code de quelqu'un d'autre : **personne
ne l'a écrit sans raison.** Contredire sans avoir cherché la raison, c'est
parier que l'auteur était négligent — un pari qu'on perd la plupart du temps.

La question à poser n'est pas « est-ce faux ? » mais « qu'est-ce qui pourrait
le rendre vrai que je ne vois pas ? ».

### Une incohérence remarquée est une piste, pas une note de bas de page

Quand on écrit « cette source se trompe ici », on vient de la disqualifier
ailleurs aussi — il faut le tirer tout de suite, pas six mois après.

Une source périmée dans un paragraphe ne redevient pas fraîche au suivant.

### Distinguer ce qui est mesuré de ce qui est lu, dans le texte

Pas dans sa tête : **dans le commentaire, le message de commit, la note.** Les
deux mots coûtent trois secondes et changent ce qu'un lecteur — soi-même dans
six mois — a le droit d'en faire.

```
Mesuré le 14/09 : 37 tests, ~55 s chacun avant recréation, ~3 s après.
Lu dans la spec, non vérifié : §4.3 veut une publication planifiée.
```

Un fait mesuré porte sa date. Un fait lu porte sa source.

C'est déjà ce qui a permis de corriger le commentaire de `vitest.config.ts` :
la mesure des 55 secondes était juste, l'explication — « Docker Desktop sous
Windows » — était fausse, et seule la mesure avait été écrite avec sa date.

### Chercher le succès silencieux

Un défaut qui plante se corrige. Un défaut qui **réussit en ne faisant rien**
ne se corrige jamais, parce que personne ne le voit.

Deux cas rencontrés ici :

- un commentaire affirmait que `JSON.stringify` rendait `</script>` inoffensif
  dans le JSON-LD. Faux — il échappe les guillemets, pas les chevrons. Aucune
  erreur nulle part : la page se rendait, simplement ouverte ;
- une garde « le corps ne contient aucun texte affichable » ne pouvait jamais
  se déclencher. Elle ne cassait rien ; elle laissait croire qu'un cas était
  couvert.

Sur un chemin de succès, **demander explicitement ce qui manque** : un montant
à zéro, un tableau vide, un identifiant `null`, une garde inatteignable. Le
chemin d'erreur crie ; le chemin de succès chuchote.

### Ce que cela ne veut pas dire

Ni prudence paralysante, ni précautions oratoires. On continue d'affirmer —
c'est le travail. Mais une affirmation porte son niveau de preuve avec elle, et
une affirmation négative en porte un plus lourd.

Se corriger vite et nettement vaut mieux que ne jamais se tromper.

## Isolation des tests — ce qui est propre à Baobart

Les règles générales — une suite à la fois, borner les processus, rejouer seul
avant de conclure à une régression — vivent dans le `CLAUDE.md` global. Elles
traitent le cas le plus fréquent : des suites qui se **ralentissent** jusqu'à
dépasser leur délai.

Cette section traite l'autre cas, celui que le global dit ne pas couvrir : les
ressources que deux exécutions se **corrompent** vraiment.

### Les ressources partagées, et comment chacune est isolée

| Ressource | Isolation | Où c'est écrit |
| --- | --- | --- |
| Base d'intégration | verrou de fichier par URL de base : un seul passage à la fois | `vitest.global-setup.ts` |
| Base de test / e2e | deux bases distinctes, `baobart_test` et `baobart_e2e` | `scripts/setup-test-db.mjs` |
| PostgreSQL | port hôte **5433**, jamais 5432 | `docker-compose.yml` |
| Serveur de développement | port **3100**, fixé | `package.json` |
| Serveur e2e | port **3200**, distinct du précédent | `playwright.config.ts` |
| Redis | préfixe `baobart:` sur toutes les clés | `lib/securite/pilotes.ts` |

**Le verrou plutôt qu'un schéma par exécution.** Un schéma PostgreSQL par
passage permettrait d'en lancer deux à la fois ; il demande de migrer à chaque
fois et complique le nettoyage. Le verrou fait l'inverse — il rend le second
passage impossible, avec un message qui dit pourquoi. C'est le bon compromis
tant que la règle est « une suite à la fois » : le verrou ne fait qu'empêcher
de l'enfreindre par distraction.

Redis (6379) et MinIO (9000/9001) écoutent encore sur leurs ports par défaut.
Si un conteneur voisin les occupe, celui de Baobart ne démarre pas **et
l'application se connecte quand même à celui du voisin**, sans rien signaler.
Le préfixe Redis protège les clés ; les objets MinIO, non. Vérifier
`docker compose up -d` avant d'incriminer un test de téléversement.

### Une base d'ombre mal écrite détruit la base de développement

`prisma migrate dev` est interactif et ne tourne pas ici. On passe donc par
`prisma migrate diff --from-migrations … --shadow-database-url …`, puis on
applique le SQL à la main.

**La base d'ombre est détruite et reconstruite à chaque appel.** C'est son
rôle : Prisma la vide, y rejoue toutes les migrations, compare, et rend le
SQL. Elle pointe donc sur ce que dit l'URL — et sur rien d'autre.

Mesuré le 23 septembre 2026. L'URL avait été fabriquée ainsi :

```sh
--shadow-database-url "$(grep '^DATABASE_URL' .env | cut -d= -f2-)_shadow"
```

`DATABASE_URL` vaut `postgresql://…/baobart?schema=public`. Le suffixe est
donc tombé **sur la chaîne de requête**, pas sur le nom de la base :

```
postgresql://…/baobart?schema=public_shadow
                ^^^^^^^ la base de développement
```

Deux appels, et `baobart` s'est retrouvée avec ses quatre-vingt-deux tables et
zéro ligne. Rien n'a échoué : le SQL attendu est sorti correctement les deux
fois, et la perte ne s'est vue que vingt minutes plus tard, quand une connexion
de test a répondu « adresse ou mot de passe incorrect ».

**La règle : nommer la base d'ombre en clair, jamais par concaténation.**

```sh
--shadow-database-url "postgresql://baobart:baobart@localhost:5433/baobart_shadow"
```

La base `baobart_shadow` existe déjà sur ce poste. Et avant d'appuyer,
**relire l'URL** : ce qui suit le dernier `/` et précède le `?` est ce qui sera
détruit.

Le coût réel a été d'une dizaine de minutes — tout se resème :

```sh
npm run db:seed && npm run db:seed:demo
npm run db:demo:catalogue        # 90 produits, suppose MinIO déjà rempli
npm run comptes:test             # les quatre comptes, mot de passe Baobart2026!
```

C'est précisément ce qui rend l'incident peu coûteux et facile à répéter : rien
n'était irremplaçable, donc rien n'a alerté.

### Après toute migration : remigrer la base de test

`pnpm db:migrate` (`prisma migrate dev`) applique la migration à la base de
**développement** et à elle seule. `baobart_test` ne bouge pas.

Le symptôme arrive quinze minutes plus tard, au milieu d'un passage
d'intégration, sous la forme d'une erreur Prisma qui ressemble à un bogue de
code :

```
The column `Event.refusedReason` does not exist in the current database.
```

Le réflexe : après toute migration, avant tout passage d'intégration,

```sh
node scripts/setup-test-db.mjs        # ou : pnpm db:test:setup
```

Il détruit `baobart_test`, la recrée et rejoue toutes les migrations. C'est
rapide — il n'y a rien dedans entre deux passages, le `TRUNCATE` s'en charge.

### Un `next dev` oublié ralentit la suite d'un facteur neuf

Mesuré le 20 septembre 2026, au milieu d'un même passage d'intégration, sur une
base pourtant recréée juste avant :

```
117 s, 88 s, 48 s      TRUNCATE, avec un « next dev » orphelin
 13 s, 13 s, 11 s      les suivants, après l'avoir tué
```

La cause n'est pas la base : c'est la **surveillance de fichiers** de Next, qui
parcourt le projet en continu pendant que la suite vide quarante tables entre
chaque test. Deux processus sur le même disque, et le plus lent gagne.

Le symptôme se lit exactement comme une base fragmentée — des `TRUNCATE` à deux
chiffres, puis à trois. Avant de recréer `baobart_test` une seconde fois,
vérifier qu'aucun serveur ne tourne :

```sh
# Windows
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'next dev|start-server' }
```

**Arrêter `npm run dev` ne suffit pas.** La commande n'est qu'une enveloppe :
tuer le processus `npm` laisse `next dev` et son `start-server` vivants, et ils
ne se signalent nulle part. C'est ainsi que celui-ci a survécu à un arrêt
explicite, puis à trois campagnes Playwright, avant qu'on ne cherche pourquoi
la suite rampait.

Même chose pour le serveur que Playwright lance lui-même : il s'arrête
normalement avec la campagne, mais une campagne interrompue peut le laisser
derrière.

### Une base de test fraîche va dix-huit fois plus vite

Mesuré le 14 septembre 2026, les mêmes 37 tests d'intégration :

```
~55 s par test      sur une base vieille de plusieurs semaines
 ~3 s par test      après node scripts/setup-test-db.mjs
```

Soit **107 secondes au lieu de plus d'une demi-heure**. Le coupable n'était pas
Docker : c'est la fragmentation de `baobart_test`. Chaque `TRUNCATE` recrée les
fichiers d'une table, et une base qu'on vide des milliers de fois finit par
traîner derrière elle des fichiers que personne ne relit.

Le commentaire de `vitest.config.ts` attribuait ces 55 secondes à « Docker
Desktop sous Windows ». C'était une mesure juste et une explication fausse : le
`SELECT 1` lent qu'on avait mesuré à côté disait le coût de `docker exec`, pas
celui de PostgreSQL.

**Recréer la base de test fait donc partie de la routine**, pas seulement après
une migration. Les délais de 150 s restent en place : ils ne coûtent rien quand
tout va vite, et ils évitent un échec aléatoire le jour où la base a vieilli.

### Lire un échec d'intégration

`Can't reach database server at localhost:5433` **n'est pas un échec de test** :
c'est le port-forward de Docker qui a cédé sous la charge. Vérifier
`docker ps` et rejouer, ne rien corriger dans le code.

Distinguer aussi, dans les vrais échecs, **ce qui accuse le test** de **ce qui
accuse le code**. Les deux sont arrivés le même jour :

- `expected { ok: true } to equal { ok: false, motif: "MOTIF_REQUIS" }` — le
  test passait « trop court » (onze caractères) à une règle qui en exige huit.
  Le code avait raison.
- `expected 2026-09-14T09:57:22Z to be null` — le code posait « relu le… » au
  moment où l'organisateur ENVOYAIT sa fiche, le nommant relecteur de son
  propre travail. Le test avait raison.

Rien dans la forme des deux messages ne les distingue. Seule la relecture de
l'intention le fait.

### Écrire un test qui ne dépendra pas de la charge

- Un test qui appelle une fonction **délibérément lente** — scrypt, un
  `TRUNCATE`, un build — déclare son propre délai, et dit pourquoi. Voir
  `lib/auth/password.test.ts` (30 s) et le bloc `integration` de
  `vitest.config.ts` (150 s). Le délai par défaut reste serré partout
  ailleurs : une vraie boucle infinie doit se signaler vite.
- Un test ne suppose jamais une base vide qu'il n'a pas vidée lui-même, ni un
  compteur Redis qu'il n'a pas posé.
- Les identifiants de fixture portent un discriminant (`redac-${n}@…`), jamais
  une constante partagée entre fichiers.
