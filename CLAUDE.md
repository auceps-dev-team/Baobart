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
