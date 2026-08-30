# Déploiement sur Vercel — mode opératoire

**Août 2026 · application v1.17.0**

> `SPEC_DEPLOIEMENT_SELFHOSTING_BAOBART.md` décrit la stratégie et le
> self-hosting Docker. Ce document-ci est la **procédure**, avec les valeurs qui
> existent aujourd'hui dans le dépôt. Là où les deux divergent, c'est celui-ci
> qui décrit le code.

---

## 1. Ce que le dépôt apporte déjà

| Fichier | Rôle |
|---|---|
| `vercel.json` | framework, commandes d'installation et de build, région, ordonnanceur |
| `.github/workflows/ci.yml` | trois jobs : qualité, intégration, migrations rejouées |
| `.env.example` | variables **triées par ce qui est réellement lu** |
| `app/api/cron/versements/route.ts` | le passage hebdomadaire, appelé par Vercel |

### Pourquoi `buildCommand` contient `prisma generate`

Le client Prisma est un paquet **généré**, pas installé. Vercel met
`node_modules` en cache : un `postinstall` peut donc être sauté sur un
déploiement où les dépendances n'ont pas bougé, alors que le schéma, lui, a
changé. Le build servirait un client périmé, et l'erreur ne se verrait qu'à
l'exécution, sur une colonne « inconnue ». Le générer dans le build le rejoue à
chaque fois.

### Pourquoi la région `cdg1`

Paris est la région Vercel la plus proche de l'Afrique de l'Ouest. Mais le
critère qui compte davantage est **la distance à la base** : une page qui fait
six requêtes paie six allers-retours. Si la base est ailleurs, changez cette
valeur pour coller à la base, pas à l'utilisateur.

---

## 2. Variables à poser dans Vercel

### Indispensables — sans elles, rien ne fonctionne

```env
DATABASE_URL       # via le pooler : ?pgbouncer=true&connection_limit=1
DIRECT_URL         # connexion directe, pour les migrations
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_FORCE_PATH_STYLE
S3_PUBLIC_URL      # en HTTPS
APP_URL            # l'adresse publique du site, en HTTPS
```

**Deux URL de base, et ce n'est pas un doublon.** Une fonction serverless ouvre
une connexion par invocation ; sans pooler, Postgres s'épuise à la première
pointe de trafic. Mais un pooler en mode transaction ne sait pas jouer une
migration — un `CREATE TYPE` suivi d'un `ALTER TABLE` doit tenir dans une seule
session. D'où l'une pour l'application, l'autre pour les migrations.

**`S3_PUBLIC_URL`, pas `CDN_URL`.** C'est bien ce nom-là que le code interroge.
`CDN_URL` figurait dans l'ancien `.env.example` sans que rien ne le lise : le
renseigner ne faisait rien, et les aperçus retombaient silencieusement sur
`S3_ENDPOINT`. Le nom mort a été retiré.

En HTTPS obligatoirement : une image en HTTP sur une page en HTTPS est refusée
par le navigateur, et la grille se retrouve vide sans message d'erreur.

**`APP_URL` n'est pas déduite de la requête, et c'est intentionnel.** Il serait
tentant de lire l'en-tête `Host` : le lien pointerait toujours sur le bon
domaine, sans réglage. C'est une faille connue — l'empoisonnement du lien de
réinitialisation. `Host` est fourni par l'appelant : il suffit de demander une
réinitialisation pour le compte d'autrui en annonçant son propre domaine pour
que la victime reçoive un courriel authentique, envoyé par nous, dont le lien
mène chez l'attaquant.

Il y a une seconde raison, moins spectaculaire : le passage qui vide la file
d'envoi tourne la nuit, sans requête HTTP. Il n'y a aucun `Host` à lire.

Absente, l'écran **Système · Configuration** l'affiche en PANNE, et la
réinitialisation du mot de passe refuse franchement au lieu d'afficher
« vérifie ta boîte » sur un courriel qui ne partira pas.

### Pour l'ordonnanceur

```env
CRON_SECRET        # openssl rand -base64 32
```

Vercel signe ses appels de cron avec ce jeton. Les trois routes d'ordonnanceur
répondent **404** à tout ce qui ne le porte pas — y compris quand le secret est
vide. C'est délibéré : mieux vaut ne rien faire que laisser l'URL ouverte.

`vercel.json` en déclare trois :

| Route | Cadence | Rôle |
|---|---|---|
| `/api/cron/versements` | lun-ven 6 h | Prépare les versements du cycle |
| `/api/cron/courriels` | toutes les 5 min | Vide la file d'envoi |
| `/api/cron/commandes` | chaque jour 4 h 30 | Referme les commandes qu'aucun rappel n'a conclues |

Le troisième est né du mobile money. Une commande s'ouvre puis attend le rappel
de l'opérateur ; beaucoup d'acheteurs n'iront pas au bout. Sans ce ménage,
chaque tentative abandonnée reste ouverte à jamais et le compteur « commandes
bloquées » de l'écran Système ne redescend plus — il finit par afficher un grand
nombre permanent et cesse de signaler quoi que ce soit.

### Pour l'encaissement

```env
PAYMENTS_DRIVER            # bac-a-sable — ou vide
PAYMENTS_SANDBOX_SECRET    # openssl rand -hex 24
```

Vide ou inconnu, le tunnel d'achat **refuse franchement** plutôt que d'ouvrir
une commande qui n'aboutira jamais. Un opérateur à moitié branché encaisse
peut-être, mais personne ne sait dire si l'argent est arrivé.

Aucun opérateur réel n'est encore intégré : le substrat existe — interface de
pilote, vérification de signature, route de rappel, anti-rejeu, confrontation
des montants — et le seul pilote livré est un bac à sable qui parcourt cette
chaîne en entier, signature comprise. Brancher Orange Money, Wave, MTN ou Moov
consiste à écrire un pilote de plus dans
`lib/payments/encaissement/pilotes.ts` ; rien d'autre ne bouge.

**L'URL de rappel à déclarer chez l'opérateur** est
`https://<domaine>/api/paiements/<pilote>/webhook`. Elle est publique par
nature : c'est la signature qui la protège, jamais son secret.

**Ne posez pas `CHECKOUT_SIMULATION_ENABLED` à côté.** La simulation prime
quand elle est ouverte ; les faire cohabiter mélangerait dans la même base des
ventes payées et des ventes gratuites, et plus personne ne saurait lesquelles
ont rapporté.

### Optionnelles

```env
SLOW_QUERY_MS=200
AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET / …   # voir lib/auth/providers.ts
```

Un fournisseur de connexion devient actif quand **toutes** ses variables sont
renseignées ; sinon le bouton répond « Bientôt disponible ».

### À ne surtout pas poser

```env
BUILD_STANDALONE=1
```

Cette sortie sert à l'image Docker. Sur Vercel, elle produit un build que la
plateforme ne sait pas servir.

### Ce qui n'aura aucun effet

Redis, IA, Sentry. Ces modules **n'existent pas**. Les variables restent
documentées en fin de `.env.example` parce que les noms sont arrêtés, mais les
poser dans Vercel ne branchera rien.

Les courriels et les paiements, eux, existent désormais — voir `EMAIL_DRIVER`
et `PAYMENTS_DRIVER` ci-dessus. Leur cas est différent : ce ne sont pas des
variables mortes, ce sont des variables dont il manque encore l'opérateur en
face.

---

## 3. Stockage : MinIO ne convient pas

MinIO tourne sur `localhost:9000` : Vercel ne l'atteindra jamais. Il faut un
stockage S3-compatible joignable publiquement — Cloudflare R2, AWS S3 ou
Supabase Storage.

### Deux préfixes, deux visibilités

Le code range les fichiers ainsi :

```
produits/<id>/…            privé  — ce que l'acheteur paie
public/apercus/<id>.webp   public — la vignette de la grille
public/extraits/<id>/…     public — l'extrait audio ou vidéo
```

Au premier envoi, l'application tente de poser une politique de lecture
anonyme sur le seul préfixe `public/`. **R2 et certains fournisseurs refusent
cette API** : la pose échoue en silence, par choix — un envoi ne doit pas
échouer pour une politique. Il faut alors ouvrir l'accès public à la main, sur
`public/*` uniquement.

Vérification, une fois déployé :

```bash
curl -o /dev/null -w "%{http_code}\n" "$S3_PUBLIC_URL/public/apercus/ID.webp"
curl -o /dev/null -w "%{http_code}\n" "$S3_PUBLIC_URL/produits/ID/fichier.zip"
```

Le premier doit répondre 200, le second **403**. S'il répond 200, le fichier
vendu est téléchargeable gratuitement : arrêtez tout et corrigez la politique.

### CORS

Le navigateur dépose les fichiers directement sur le stockage, avec une URL
signée. Sans CORS, l'envoi échoue :

```json
[
  {
    "AllowedOrigins": ["https://votre-domaine"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

`DELETE` n'est pas nécessaire : les suppressions passent par le serveur.

---

## 4. Migrations

Vercel n'exécute pas `prisma migrate deploy`, et c'est heureux : une migration
lancée par plusieurs instances de build en parallèle est un moyen sûr de
corrompre un schéma.

À jouer depuis un poste ou une étape de déploiement dédiée, avant de basculer
le trafic :

```bash
pnpm db:deploy
```

Le job `migrations` de la CI rejoue toute la suite depuis une base vide à
chaque poussée : si une migration écrite à la main casse, on l'apprend avant la
production, pas pendant.

---

## 5. Limites connues du mode serverless

**La fabrique d'aperçus travaille en ligne.** Confirmer un envoi rapatrie
l'image et en tire une vignette, dans la requête. Un fichier de quarante
mégaoctets frôle la limite de temps ; la page déclare `maxDuration = 60` pour
s'en accommoder. La vraie réponse est une tâche de fond, qui n'existe pas
encore.

**Rien n'encaisse.** Pas de panier, pas de passage en caisse, pas de webhook de
paiement. Une ressource gratuite se télécharge ; une ressource payante ne
s'achète pas.

**L'ordonnanceur prépare, il n'envoie pas.** Les versements sortent en état
`CREATING`, soldes réservés. L'appel à l'opérateur mobile money n'existe pas.
C'est sans danger : un versement `CREATING` s'annule et rend ses soldes.

---

## 6. Ordre des opérations

1. Créer la base (Neon, Supabase, Vercel Postgres) et relever **les deux** URL.
2. Créer le bucket, ouvrir `public/*` en lecture, poser le CORS.
3. Poser les variables dans Vercel — les trois environnements ont leurs
   propres valeurs ; ne faites pas pointer la préproduction sur la base de
   production.
4. Appliquer les migrations avec `pnpm db:deploy`.
5. Connecter le dépôt à Vercel. `vercel.json` fournit déjà les commandes.
6. Vérifier après le premier déploiement :
   - la page d'accueil répond ;
   - `/explore` affiche des cartes ;
   - un envoi de fichier aboutit et sa vignette s'affiche ;
   - un fichier source répond 403 en accès direct ;
   - `/api/cron/versements` répond 404 sans le secret.

---

## 7. Intégration continue

`ci.yml` tourne sur chaque pull request et sur `main` :

| Job | Ce qu'il protège |
|---|---|
| `qualite` | types, style, 259 décideurs purs, build — sous deux minutes |
| `integration` | argent, fichiers, social contre un vrai Postgres — 140 tests |
| `migrations` | la suite rejouée depuis une base vide, puis contrôle de dérive |

Les deux derniers sont séparés du premier volontairement : attendre cinq
minutes pour apprendre qu'une virgule manque décourage de lancer la CI.

Le script `db:test:setup` sert dans les deux mondes : en local il recrée la
base via Docker, en CI il s'aperçoit qu'aucun Docker n'est joignable et se
contente d'appliquer les migrations sur la base que le service a déjà créée.

Vercel fournit de son côté les déploiements de prévisualisation sur pull
request et la production sur `main` — il n'y a pas de workflow de déploiement à
écrire.

---

## 7 bis. Surveiller une fois en ligne

### Le point de santé

```
GET /api/health
```

Public, sans secret, et volontairement avare : il ne nomme ni hôte, ni bucket,
ni version. Il répond **200** tant que la base répond, **503** sinon — c'est ce
code que les sondes lisent.

```json
{
  "etat": "ok",
  "base": "ok",
  "stockage": "configure",
  "fonctionnalites": { "envoi_fichiers": "ouverte", "versements": "ouverte" }
}
```

Un stockage absent ne fait pas basculer en 503 : on ne peut plus envoyer de
fichiers, mais parcourir, se connecter et télécharger l'existant fonctionne
toujours. Sortir l'application du service pour autant priverait tout le monde
de ce qui marche encore.

À brancher sur la sonde de l'hébergeur, avec la réserve habituelle : une seule
sonde depuis une seule région ne prouve rien de plus que la santé de cette
région.

### Les journaux

Un événement, une ligne JSON, filtrable par champ dans l'interface de Vercel.
Les champs dont le nom évoque un secret sortent en `[caviardé]`, à tous les
niveaux d'imbrication : un agrégateur de logs conserve des mois, et bien plus
de gens le lisent que la base.

Avertissements et erreurs partent sur `stderr` — beaucoup d'hébergeurs ne
déclenchent d'alerte que sur ce canal.

### Les interrupteurs

Quand le stockage se met à répondre de travers un dimanche soir, on ferme sans
redéployer :

```env
FEATURE_ENVOI_FICHIERS=0    # coupe l'envoi de fichiers
FEATURE_VERSEMENTS=0        # suspend la préparation des versements
```

Ferment aussi : `false`, `off`, `non`. **Absente, une variable laisse ouvert** —
l'inverse ferait qu'un oubli coupe une fonctionnalité en silence.

Un drapeau ne sait que fermer. `FEATURE_QUELQUE_CHOSE=1` n'ouvrira jamais un
module qui n'est pas écrit ; l'état renvoyé par `/api/health` dit alors pourquoi.

Et **la livraison n'a pas d'interrupteur**, délibérément : le couper retirerait
à des acheteurs ce qu'ils ont déjà payé. Un test empêche d'en ajouter un sans
que la question soit posée.

---

## 7 ter. Nommer un administrateur

Aucun écran ne le fait, et c'est délibéré : un formulaire capable d'élever un
compte est une cible — il suffit d'une faille d'autorisation pour que
n'importe qui devienne super administrateur. La promotion exige donc un accès
à la base, que quelqu'un de malveillant n'a par définition pas.

```bash
pnpm admin:promouvoir untel@exemple.com ADMIN
```

Trois rôles : `MEMBER` (le défaut), `ADMIN` (consulte et agit) et `SUPER_ADMIN`
(distribue les pouvoirs). Un compte d'astreinte doit pouvoir lire un diagnostic
à trois heures du matin sans pouvoir, du même geste, se nommer super
administrateur.

La commande **ferme toutes les sessions** du compte touché. Une rétrogradation
qui mettrait trente jours à prendre effet n'en serait pas une.

L'espace d'administration répond **404** à qui n'y a pas droit — y compris à un
membre connecté. « Accès refusé » confirmerait qu'il y a quelque chose à forcer.

Un seul écran existe aujourd'hui : `/dashboard/systeme/configuration`, qui
répond à « le déploiement ne marche pas, pourquoi ». Il classe chaque
dépendance — base, stockage, connexion, interrupteurs — en OK / À VOIR /
PANNE, et dit quoi faire quand il y a quelque chose à faire.

---

## 8. Ce qu'il reste à faire hors du dépôt

Tout ce qui précède est versionné. Ce qui suit ne l'est pas, et ne peut pas
l'être : ce sont des ressources à provisionner et des secrets à poser. Aucune
de ces étapes n'est optionnelle — sans elles, le déploiement démarre puis
échoue à la première requête.

### 8.1 Base de données managée

Créer une base chez Neon, Supabase ou Vercel Postgres, **dans la même région
que celle déclarée dans `vercel.json`** — sinon chaque requête paie la
traversée. Relever les deux URL : celle du pooler et la connexion directe.

Ce ne sont pas deux orthographes de la même chose. Voir §2 : l'une survit au
serverless, l'autre sait jouer une migration.

### 8.2 Stockage objet joignable publiquement

MinIO tourne sur `localhost` : Vercel ne l'atteindra jamais. Il faut un bucket
S3-compatible — R2, S3 ou Supabase Storage.

Trois choses à faire dessus, dans cet ordre :

1. **Ouvrir `public/*` en lecture anonyme**, et rien d'autre. L'application
   tente de poser la politique elle-même, mais certains fournisseurs refusent
   cette API ; l'échec est silencieux par choix (§3).
2. **Poser le CORS** (§3) : sans lui, le navigateur ne peut pas déposer les
   fichiers, et l'envoi échoue sans message clair.
3. **Vérifier la frontière**, une fois déployé :

```bash
curl -o /dev/null -w "%{http_code}\n" "$S3_PUBLIC_URL/public/apercus/ID.webp"
curl -o /dev/null -w "%{http_code}\n" "$S3_PUBLIC_URL/produits/ID/fichier.zip"
```

`200` puis `403`. Si le second répond `200`, **ce qui est vendu est
téléchargeable gratuitement** : c'est la seule erreur de cette liste qui coûte
de l'argent aux créateurs. À vérifier avant d'annoncer l'ouverture.

### 8.3 Secret de l'ordonnanceur

```bash
openssl rand -base64 32
```

À poser en `CRON_SECRET` chez Vercel. Sans lui la route répond 404 à tout le
monde, y compris à Vercel : aucun versement ne serait préparé, et rien ne le
signalerait — le cycle passerait simplement sans rien faire.

### 8.4 Migrations, avant de basculer le trafic

```bash
pnpm db:deploy
```

Depuis un poste ou une étape dédiée, **jamais pendant le build** : plusieurs
builds parallèles joueraient la même migration.

Attention au piège : `prisma migrate deploy` lit `DIRECT_URL` et **ignore**
`DATABASE_URL`. Vérifiez laquelle est chargée avant de lancer la commande —
c'est elle qui décide de la base migrée, et une erreur ici s'applique
directement en production.

### 8.5 Vérification de bout en bout

Une fois en ligne, dérouler le parcours complet avec un compte réel :

```
inscription → création d'une ressource → envoi du fichier source →
envoi de l'aperçu → publication → apparition dans la grille →
téléchargement d'une ressource gratuite → historique des téléchargements
```

Ce parcours est celui qui fonctionne aujourd'hui de bout en bout. Il n'inclut
pas d'achat : le passage en caisse n'existe pas (§5). Une ressource payante se
publie et s'affiche, mais ne s'achète pas — c'est le prochain chantier, pas un
défaut de configuration.
