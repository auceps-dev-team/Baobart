# Déploiement sur Vercel — mode opératoire

**2 septembre 2026 · application v1.44.0**

> `SPEC_DEPLOIEMENT_SELFHOSTING_BAOBART.md` décrit la stratégie et le
> self-hosting Docker. Ce document-ci est la **procédure**, avec les valeurs qui
> existent aujourd'hui dans le dépôt. Là où les deux divergent, c'est celui-ci
> qui décrit le code.

---

## ⚠️ Quatre choses à ne pas oublier avant la mise en ligne

Elles ne s'écrivent pas dans le code, et aucune n'échoue bruyamment. Le service
démarre, les pages s'affichent, et la faute ne se voit qu'au moment où elle
coûte quelque chose.

### 1. `RATE_LIMIT_DRIVER=redis` et `REDIS_URL`

Sans elles, les compteurs de limitation vivent **dans le processus**. En
serverless, chaque instance a les siens : dix instances autorisent dix fois la
limite.

C'est le pire genre de panne, celle qui a l'air de fonctionner — la page dit
« protégé », les compteurs tournent, et l'attaque passe. L'écran **Système ·
Configuration** l'affiche en avertissement dès qu'on est en production ; encore
faut-il aller le regarder.

### 2. Désactiver l'OTP sur les transferts Paystack

À faire **avant le premier passage de versements**, sur leur tableau de bord,
section Transfers.

Tant qu'il est actif, Paystack réclame un code à usage unique envoyé au
propriétaire du compte pour **chaque** virement. Aucun versement automatique
n'est alors possible, et aucune quantité de code n'y changera quoi que ce soit.
Le passage s'arrête net au premier versement et le journalise en erreur — plutôt
que de faire échouer tous les créateurs pour la même raison — mais personne
n'est payé ce jour-là.


### 3. `SMS_DRIVER` — et surtout, jamais `console`

Les deux derniers rappels d'abonnement avant coupure d'accès passent par SMS
(paliers J+2 et J+5). Trois valeurs, et l'ordre de danger n'est pas celui qu'on
croit :

| Valeur | En production |
|---|---|
| `aucun` (défaut) | **Manque.** Les relances ne partent que par courriel. Ndank rend `false`, ne note rien, et compte l'abonné parmi les injoignables — rien n'est perdu, mais un abonné qui ne lit pas ses courriels sera coupé sans avertissement. |
| `console` | **Panne.** Le message est écrit dans le journal et compté comme envoyé. Ndank note une relance **jamais partie**, ne la renverra pas, et coupera l'accès au terme de la grâce. Aucun compteur ne le signale. |
| `twilio` | Ce qu'il faut, avec `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` et `TWILIO_FROM` (ou `TWILIO_MESSAGING_SERVICE_SID`). |

Un pilote Twilio à moitié configuré retombe sur `aucun` : c'est voulu, mieux
vaut ne rien prétendre. L'écran **Système · Configuration** affiche les trois cas.

Poser aussi `SMS_PLAFOND_JOUR` si le défaut de 500 est mal calibré — c'est le
seul garde-fou qui borne le coût d'une boucle de relance, et il est compté **par
instance** : le vrai plafond se pose chez l'opérateur.


### 4. Les clés VAPID — posées une fois, jamais rechangées

`pnpm push:cles` tire la paire, et l'on pose `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` et `PUSH_DRIVER=web-push`.

Sans elles, le bouton d'activation ne s'affiche pas et les relances des paliers
J+2 et J+5 retombent sur le SMS — qui, lui, se paie à l'unité. Chaque abonné
qui a installé Baobart est un SMS qu'on n'envoie pas.

**Le piège est de les rechanger.** La clé publique est ce à quoi chaque
navigateur s'est abonné : en tirer une nouvelle paire ne casse pas « quelques »
abonnements, elle les rend **tous muets d'un coup**, sans la moindre erreur.
Les gens continuent de croire qu'ils seront prévenus, et ne le sont plus.

Si la paire doit vraiment changer, vider `PushSubscription` dans la même
opération : chacun se réinscrira à sa prochaine visite. L'écran **Système ·
Configuration** classe en **panne** le cas « des appareils enregistrés, aucune
clé », qui est exactement celui-là.

Le service worker (`public/sw.js`) ne met **rien** en cache, délibérément : sur
une application où l'argent circule, un cache mal invalidé sert un prix
d'hier — et un service worker fautif reste chez les visiteurs des semaines,
hors de portée d'un déploiement.

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
| `/api/cron/versements` | lun-ven 6 h | Prépare **et envoie** les versements du cycle |
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

Une seule adresse suffit : l'opérateur y envoie aussi bien les paiements
entrants que les virements sortants, et le pilote les trie. Ce qui ne nous
concerne pas — remboursements, litiges, factures — reçoit un 200 sans effet
et sans trace. Leur répondre par une erreur les ferait rejouer sans fin, et
remplirait le journal des refus au point d'y noyer le seul signal qui
compte : un secret de signature décalé.

**Avant le premier versement réel**, deux réglages à vérifier chez Paystack :
l'OTP sur les transferts doit être **désactivé** (sinon aucun versement
automatique n'est possible), et le solde doit être suffisant — l'argent versé
sort du solde Paystack, pas d'un compte séparé.

**Ne posez pas `CHECKOUT_SIMULATION_ENABLED` à côté.** La simulation prime
quand elle est ouverte ; les faire cohabiter mélangerait dans la même base des
ventes payées et des ventes gratuites, et plus personne ne saurait lesquelles
ont rapporté.

### Pour la limitation du débit

```env
RATE_LIMIT_DRIVER=redis
REDIS_URL=rediss://…
```

Sans elles, les compteurs vivent **dans le processus**. En serverless, chaque
instance a les siens : dix instances autorisent dix fois la limite, et rien ne
le signale — la page affiche « protégé », les compteurs tournent, et l'attaque
passe. L'écran **Système · Configuration** l'affiche en avertissement dès qu'on
est en production.

Ce qui est borné : la connexion (dix essais par quart d'heure et par adresse),
l'inscription (cinq par heure), l'oubli de mot de passe (cinq par quart d'heure,
en plus du plafond de trois **par compte**), et les rappels d'opérateur (trois
cents par minute — large, pour qu'un opérateur qui rattrape un incident ne soit
pas refusé).

**On laisse passer quand le compteur est en panne.** Redis injoignable
n'interdit rien : un limiteur indisponible ne doit pas fermer la connexion à
tout le monde. La contrepartie est réelle — pendant la panne, plus rien n'est
borné — donc l'incident est journalisé en erreur.

**On laisse passer aussi quand l'adresse est inconnue.** Se rabattre sur une
valeur commune serait pire : tous les visiteurs sans adresse identifiable
partageraient un compteur, et le premier robot fermerait la porte aux autres.

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

## 6 bis. Les tests au navigateur

```bash
pnpm db:e2e:setup   # une fois : crée baobart_e2e et applique les migrations
pnpm test:e2e       # construit, démarre, et traverse l'application
```

Ils tournent sur une **base à part** (`baobart_e2e`) et sur le **port 3100**,
pour ne piétiner ni la base d'intégration ni un `pnpm dev` déjà ouvert.

**Ils construisent l'application avant de la traverser**, et ce n'est pas du
zèle. La première version lançait `next dev` : deux parcours y échouaient sur du
code parfaitement correct. En mode développement, la redirection qui suit une
action serveur n'aboutit pas — le serveur répond bien 303 avec sa cible, le
client abandonne la requête qui devait l'y emmener, et le formulaire reste sur
« Un instant… » alors que le compte est créé et la session ouverte. Contre un
build, le même parcours passe.

Une suite qui échoue sur du code correct ne coûte pas seulement du temps : elle
apprend à ne plus la croire. Les deux minutes de construction sont le prix de
sa crédibilité.

Ce qu'ils couvrent : le parcours complet (inscription → achat → espace
acheteur), les gardes des écrans d'exploitation — chacun visité séparément,
parce que Next.js ne réexécute pas un layout entre deux pages sœurs — et la
limitation par l'adresse, frappée sur la vraie route.

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

Neuf rôles. Les six du milieu sont **fonctionnels** : ils donnent leur métier et
rien d'autre, et notamment **jamais les écrans techniques**.

| Rôle | Ce qu'il peut faire |
|---|---|
| `MEMBER` | rien — le défaut |
| `CONTENT_MANAGER` | écrire et publier articles et événements |
| `MARKETING` | mettre en avant, sponsoriser, envoyer une infolettre |
| `MODERATOR` | approuver ou refuser ce que publient les autres |
| `SUPPORT` | rembourser, trancher un litige, répondre à un ticket |
| `ACCOUNTANT` | lire et rejouer les versements |
| `COMPLIANCE` | KYC, états de risque, suspension — et lecture de l'audit |
| `ADMIN` | tout, **sauf** distribuer les pouvoirs |
| `SUPER_ADMIN` | tout |

Quelqu'un qui a besoin de deux fonctions reçoit `ADMIN`. Et un compte d'astreinte
doit pouvoir lire un diagnostic à trois heures du matin sans pouvoir, du même
geste, se nommer super administrateur : c'est toute la distance entre `ADMIN` et
`SUPER_ADMIN`.

La matrice complète vit dans `lib/auth/administration.ts`, et un test vérifie
qu'aucun pouvoir n'y est orphelin — un pouvoir que personne ne porte est une
garde qui refuse tout le monde, donc un écran écrit et inatteignable.

La commande **ferme toutes les sessions** du compte touché. Une rétrogradation
qui mettrait trente jours à prendre effet n'en serait pas une.

L'espace d'administration répond **404** à qui n'y a pas droit — y compris à un
membre connecté. « Accès refusé » confirmerait qu'il y a quelque chose à forcer.

**Tout acte d'administration laisse une trace.** Changement d'état de risque,
versement rejoué, courriel relancé : `AuditLog` retient qui, quoi, quand.
Consigner ne peut jamais faire échouer l'acte — mais une trace perdue crie dans
les journaux, parce qu'un audit troué en silence ne vaut rien.

Aucun écran ne lit encore ce journal. En attendant :

```sql
SELECT "createdAt", "actorId", action, resource, details
FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 50;
```

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

Une fois en ligne, dérouler le parcours complet avec un compte réel. Trois
parcours, et le second est celui qui touche à l'argent :

**Publier**

```
inscription → création d'une ressource → envoi du fichier source →
envoi de l'aperçu → publication → apparition dans la grille →
téléchargement d'une ressource gratuite → historique des téléchargements
```

**Acheter** — avec un vrai paiement de petit montant, pas en simulation :

```
fiche d'une ressource payante → choix du rail → paiement chez l'opérateur →
retour sur /achat/[id] → attente du rappel → « c'est payé » →
reçu reçu par courriel → fichier accessible dans « Mes achats »
```

Si la page de retour reste sur « on attend » plus de quelques minutes, le
rappel de l'opérateur n'arrive pas : vérifier l'URL de webhook chez lui, puis
l'écran **Système · Paiements**, qui liste les rappels reçus et refusés.

**Renouveler un abonnement** :

```
/dashboard/forfait → « Renouveler maintenant » → choix du rail →
paiement → retour sur /abonnement/[id]/paiement/[id] →
« c'est renouvelé » + prochaine échéance → reçu par courriel
```

---

### 8.6 Le pense-bête d'avant-ouverture

Tout ce qui suit est déjà expliqué plus haut. Cette liste existe parce qu'il
faut pouvoir la parcourir une dernière fois sans relire le document, et parce
qu'**aucun de ces oublis ne provoque d'erreur visible** : le service démarre,
les pages s'affichent, et la faute ne se voit qu'au moment où elle coûte
quelque chose.

| | À poser | Ce qui se passe si on l'oublie |
|---|---|---|
| ☐ | `pnpm db:deploy` | Les tables `SubscriptionPayment` et `PushSubscription` n'existent pas : tout renouvellement et toute activation de notification échouent en 500 |
| ☐ | `RATE_LIMIT_DRIVER=redis` + `REDIS_URL` | Les compteurs vivent dans chaque instance : dix instances autorisent dix fois la limite, et la page affiche « protégé » |
| ☐ | OTP désactivé chez Paystack | Le premier passage de versements s'arrête net et personne n'est payé ce jour-là |
| ☐ | `SMS_DRIVER=twilio` + identifiants | Les deux derniers rappels avant coupure ne partent pas. **Jamais `console` :** il compte les relances comme envoyées sans rien envoyer |
| ☐ | `PUSH_DRIVER=web-push` + les trois `VAPID_*` | Les relances J+2 et J+5 retombent sur le SMS, qui se paie à l'unité |
| ☐ | `CRON_SECRET` | Les routes d'ordonnanceur répondent 404 à Vercel : aucun versement préparé, aucune relance envoyée, aucun ménage — et rien ne le signale |
| ☐ | `S3_PUBLIC_URL` en **https** | Les aperçus ne s'affichent pas, et le navigateur bloque le contenu mixte |
| ☐ | `CHECKOUT_SIMULATION_ENABLED` **absent** | Les ressources payantes se prennent sans payer, et les créateurs sont crédités d'un argent qui n'est jamais entré |
| ☐ | La frontière du bucket (§8.2) | Ce qui est vendu se télécharge gratuitement — la seule erreur de cette liste qui coûte de l'argent aux créateurs |
| ☐ | Un administrateur nommé (§7 ter) | Personne ne peut atteindre les écrans Système, y compris pour constater les points ci-dessus |

L'écran **Système · Configuration** rend compte de la moitié de cette liste tout
seul, et classe en **panne** les cas où l'application prétend faire quelque
chose qu'elle ne fait pas. Aller le regarder une fois en ligne est le moyen le
plus rapide de valider ce tableau.

---

### 8.7 Ce qui n'est pas prêt, et qu'il faut savoir avant d'annoncer

Ces points ne bloquent pas un déploiement. Ils bloquent une **promesse**.

- **Le profil public d'un créateur n'existe pas.** Suivre quelqu'un fonctionne,
  mais aucun écran ne montre son travail : les liens renvoient vers
  l'explorateur. Annoncer « suis tes créateurs préférés » serait prématuré.
- **L'appel réel aux opérateurs de versement n'a jamais été exercé.** Le code
  est écrit et testé hors ligne, jamais contre le vrai service. Le premier
  cycle de versements doit être surveillé, et déclenché à la main de préférence.
- **Aucune invitation à installer n'est affichée ailleurs que sur l'écran du
  forfait.** L'application est installable ; peu de gens le découvriront.
- **Le catalogue des rails par pays n'est pas vérifié auprès du compte
  marchand.** Ce sont les opérateurs dominants de chaque marché, pas une liste
  confirmée. Le premier paiement réel de chaque pays doit être essayé rail par
  rail.
