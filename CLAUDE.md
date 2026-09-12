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
| Base d'intégration | verrou de fichier par URL de base : un seul passage à la fois | `vitest.setup.ts` |
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

### Lire un échec d'intégration

Sur cette machine, un `TRUNCATE` complet prend environ **55 secondes** — c'est
Docker Desktop sous Windows, pas le code. Un fichier de 24 tests met donc une
vingtaine de minutes, et la connexion peut lâcher en route.

`Can't reach database server at localhost:5433` **n'est pas un échec de test** :
c'est le port-forward de Docker qui a cédé sous la charge. Vérifier
`docker ps` et rejouer, ne rien corriger dans le code.

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
