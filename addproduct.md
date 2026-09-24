# Ajouter des ressources à Baobart

Tu as reçu un dossier de fichiers et on te demande de les faire apparaître sur
Baobart. Ce document dit comment, dans quel ordre, et surtout **ce qui échoue
sans rien dire** — parce que c'est le mode d'échec normal de ce pipeline.

Relevé en montant le catalogue de 239 fichiers, les 22 et 23 septembre 2026.
Cinq défauts, **aucun n'a levé d'erreur** :

1. trois packshots d'une marque réelle, dont deux nommés
   `generation_1772732929804.jpg` — invisibles à la lecture des noms ;
2. la politique MinIO écrasée par un second écrivain — toutes les vignettes en
   `403`, sans rien dans les journaux ;
3. les cartes vidéo affichées en rectangle noir — `readyState = 0` ;
4. une vidéo que Chromium ne décode pas du tout ;
5. **le script de vérification lui-même**, dont l'expression régulière ne
   trouvait que les citations sur plusieurs lignes. Il annonçait « 128 cités,
   111 non cités » là où les vrais chiffres étaient 150 et 89 — et j'ai relayé
   ces nombres avant de m'en apercevoir. Une vérification qui se trompe est
   pire qu'aucune : on lui fait confiance.

Quatre sur cinq ont été trouvés en **regardant l'écran**, pas en lisant du
code.

### Ce que la relecture du 24 septembre a trouvé en plus

Chacun des cinq avait un correctif dans le code. Deux étaient **plus étroits
que ce qu'on croyait** — et dans les deux cas, ce qui manquait était la portée
du correctif, pas le correctif.

**Le n° 1 s'arrêtait au catalogue.** `ECARTES` empêchait un visuel d'avoir une
fiche. Il n'empêchait rien d'autre : `medias-demo.mjs` prenait le dossier
entier par extension, et le préfixe `demo/` est en lecture anonyme. Mesuré le
24 septembre sur la MinIO locale, les dix écartés répondaient **HTTP 200**,
original et aperçu — dix-neuf objets, à une URL dérivée de leur nom, donc
devinable. Aucune fiche ne les citait ; ils étaient servis.

« Écarté du catalogue » ne voulait pas dire « pas en ligne », et rien ne le
disait.

**Le n° 5 avait échangé un mauvais compte contre un autre.** La nouvelle
expression prenait *toute* chaîne finissant par une extension d'image, bloc
`ECARTES` compris. Elle annonçait « 239 cités, 239 dans le dossier » — j'ai
publié ce nombre aussi. Le vrai compte est **229 catalogués et 10 écartés**.
Sous-compte le 22, sur-compte le 23 : la même erreur retournée.

Ce qui manquait n'était pas une meilleure expression régulière, c'était le
**troisième ensemble**. Un fichier est catalogué, écarté, ou sans avis — et
seul le troisième cas demande une décision. Deux ensembles n'ont jamais pu
dire ça.

**Ce qui les tient désormais** (mesuré le 24 septembre) :

| Garde | Où | Ce qu'elle refuse |
| --- | --- | --- |
| Lecture unique des deux listes | `scripts/lire-catalogue.mjs` | Un `fichier:` dont l'extension échappe à la lecture ; le bloc `ECARTES` introuvable ou vide |
| Écarté = non téléversé, **et retiré s'il est déjà là** | `scripts/medias-demo.mjs` | Un visuel refusé qui reste servi par MinIO |
| Catalogué **et** écarté | `prisma/seed-demo-catalogue.ts` | Le seed s'arrête avant d'écrire quoi que ce soit |
| Trois ensembles, pas deux | `scripts/verif-catalogue.mjs` | Sort en `1` sur contradiction, doublon ou fichier introuvable |

La garde du seed est là plutôt que dans la seule vérification pour une raison
simple : **une vérification qu'on lance à part est une vérification qu'on
saute.** Le seed, non.

---

## 1. La question à poser avant tout

**Ces fichiers sont-ils un jeu de démonstration, ou des ressources à vendre ?**

Les deux chemins ne se ressemblent pas, et se tromper coûte cher.

| | Démonstration | Vraies ressources |
| --- | --- | --- |
| Où | `prisma/demo-catalogue.ts` | Le dépôt d'un créateur, via `/dashboard/produits/nouveau` |
| Stockage | MinIO, préfixe `demo/`, lisible sans signature | MinIO, préfixe `public/` pour les aperçus, privé pour le vendu |
| Prix | `0` — voir plus bas | Ce que le créateur décide |
| Propriétaire | Six créateurs fictifs semés par le script | Le compte qui téléverse |
| Effacé par | `db:demo:catalogue` rejoué | Rien : ce sont des données réelles |

La suite de ce document traite le **premier** cas. Pour le second, il n'y a pas
de script : on passe par l'application, parce que le téléversement réel
éprouve la chaîne que la production emprunte — URL signée, réservation,
confirmation.

### Pourquoi tout le catalogue de démonstration est à zéro franc

Ce n'est pas une paresse de jeu d'essai. Un prix inventé sur une ressource
qu'on n'a pas le droit de vendre serait une fausse transaction, et le tunnel
d'achat de la démo crédite un solde qui n'existe pas.

Conséquence à connaître : **une ressource à zéro ne s'achète pas**.
`lib/checkout/achat.ts` répond `GRATUITE` — elle se télécharge directement.
Les parcours qui ont besoin d'un prix ont leurs propres montages
(`prisma/seed-demo.ts`, `e2e/fixtures/donnees.ts`).

Depuis v1.67.0, une ressource en `pricingMode: LIBRE` échappe à ce refus : zéro
y veut dire « pas de montant suggéré », et l'acheteur en donne un.

---

## 2. L'ordre des opérations

Il ne se permute pas. Le seed n'écrit que des lignes qui *pointent* vers MinIO :
lancé avant le téléversement, il produit autant de fiches aux vignettes vides.

```sh
# 0 · L'infrastructure doit tourner
docker compose up -d
docker ps          # baobart-postgres, baobart-minio, baobart-redis

# 1 · Regarder les fichiers. Vraiment les regarder — voir §4.
node scripts/planche-contact.mjs "C:/chemin/source" planche.jpg $(ls "C:/chemin/source")

# 2 · Écrire ECARTES, avec la raison de chacun   (§3)
#     AVANT le téléversement : depuis le 24/09, l'étape 3 lit cette liste
#     et refuse de mettre en ligne ce qui s'y trouve.

# 3 · Téléverser : originaux + aperçus 1400 px
node --env-file=.env scripts/medias-demo.mjs "C:/chemin/source"

# 4 · Écrire les entrées dans prisma/demo-catalogue.ts   (§3)

# 5 · Vérifier : catalogué, écarté, ou sans avis
npm run db:demo:verif -- "C:/chemin/source"

# 6 · Semer
npm run db:demo:catalogue -- "C:/chemin/source"
```

L'étape 2 est passée devant l'étape 3 le 24 septembre. Avant, on décidait des
exclusions au moment d'écrire les entrées — donc **après** que tout était déjà
en ligne. Décider tard ne coûtait rien tant que la décision ne servait qu'au
catalogue ; elle sert maintenant aussi au téléversement.

Un oubli reste rattrapable : `medias-demo.mjs` retire à chaque passage ce que
`ECARTES` nomme, même si un passage précédent l'avait mis en ligne.

### Le piège du chemin avec espaces

`npm run db:demo:catalogue -- C:/Users/X Y/Downloads/Baobart` passe **deux**
arguments. Le seed ne lit que le premier, ne trouve pas le dossier, et retombe
sur des dimensions estimées — sans le dire, parce qu'il prévoit ce cas.

Symptôme : le panneau « Détails » d'une fiche annonce des dimensions rondes qui
ne sont pas celles du fichier. Toujours guillemeter.

---

## 3. Écrire une entrée

```ts
{
  fichier: "Black History Month Flyer Layout.jpg",  // le nom EXACT du dossier
  nom: "Affiche — Black History Month",
  famille: "ART",
  prix: 0,
  staffPicked: true,          // facultatif : pastille « Sélection éditoriale »
  apercus: ["autre-1.png"],   // facultatif : les autres visuels d'un pack
  note: "Deux lignes au plus.",
}
```

`famille` vient de l'enum `ProductFamily` : `ILLUSTRATION`, `PHOTO`, `MOCKUP`,
`FONT`, `ICONE`, `LOGO`, `PACK`, `ART`, `AUDIO`, `VIDEO`. Le rail latéral et
les filtres du fil s'en servent — une famille mal choisie rend la ressource
introuvable par le chemin que l'acheteur emprunte.

### Les fichiers qu'on n'ajoute pas

`ECARTES`, dans le même fichier, liste ce qu'on a refusé **avec la raison**.
Une exclusion sans raison écrite sera réintroduite par le prochain passage.

À la date de ce document, dix exclusions : neuf pour marque réelle, une pour un
fichier que Chromium ne sait pas décoder.

Cette liste n'est plus un commentaire. Depuis le 24 septembre, elle fait trois
choses :

- `medias-demo.mjs` ne téléverse pas ce qu'elle nomme, et **retire** ce qui a
  été mis en ligne par un passage antérieur ;
- `seed-demo-catalogue.ts` **s'arrête** si un visuel est des deux côtés, avant
  d'écrire la moindre ligne ;
- `verif-catalogue.mjs` sort en `1` sur la même contradiction.

Le refus plutôt que le filtrage, dans les trois cas. Un visuel des deux côtés,
c'est une décision prise deux fois en sens contraire : la trancher en silence
dans un sens ou dans l'autre serait pire que de s'arrêter.

---

## 4. Regarder les images, pas leurs noms

C'est le point le plus important de ce document.

Trois packshots CeraVe — une marque réelle — ont failli entrer au catalogue.
Deux s'appelaient `generation_1772732929804.jpg` et
`generation_1772744361442.jpg`. **Aucune lecture de nom de fichier ne les
aurait trouvés.**

Un quatrième, `packshot-soin.png`, était déjà en ligne sur la page d'accueil
depuis le premier jour : il venait de la maquette, il était commité dans le
dépôt, et la liste `ECARTES` ne regarde pas là.

D'où `scripts/planche-contact.mjs` : il fabrique une planche numérotée de
toutes les images, quatre par ligne. On la lit, on note les numéros à écarter.
Le numéro sert à désigner une image sans recopier un nom de quatre-vingts
caractères.

```sh
node scripts/planche-contact.mjs "C:/chemin/source" planche.jpg $(ls "C:/chemin/source")
```

Ce qu'on cherche : marques réelles, logos d'entreprises, packshots de produits
du commerce, filigranes de banques d'images, et tout ce qui sort de la ligne
éditoriale (Baobart est ivoirienne — Abidjan, pas Dakar).

---

## 5. Les vidéos ont leur propre chemin

Une vidéo n'a **pas** de couverture, elle a un extrait. C'est le seul cas où
`coverUrl` reste nul.

`prisma/seed-demo-catalogue.ts` s'en charge : `estUneVideo()` décide, et la
ligne reçoit `previewUrl` + `previewKind: "video"` au lieu d'une couverture.
La carte du fil (`components/feed/resource-card.tsx`) affiche alors un
`<video>`.

Deux choses à savoir :

- **La vignette vient d'un fragment `#t=0.5`**, pas d'un fichier `poster`. Sans
  lui, `preload="none"` ne décode aucune image et la carte est un rectangle
  noir. Mesuré : `readyState = 0`, `videoWidth = 0`. La demi-seconde plutôt que
  zéro, parce que beaucoup de vidéos ouvrent sur un fondu au noir.
- **Chromium ne décode pas tout.** Une 4K de 251 Mo a rendu
  `MEDIA_ELEMENT_ERROR: Format error`. Les quatre autres portaient `avc1`
  (H.264) et se lisaient. Avant d'ajouter une vidéo, ouvrir son URL MinIO dans
  un navigateur et vérifier que l'image apparaît.

Il n'y a pas de ffmpeg sur cette machine : aucune extraction de première image
n'est possible localement.

---

## 6. La politique MinIO a deux écrivains

`PutBucketPolicy` **remplace** le document entier. Deux endroits en posent un :

- `scripts/medias-demo.mjs` ouvre `demo/*` ;
- `lib/upload/storage.ts` ouvre `public/*`.

Depuis v1.58.1, les deux **fusionnent** au lieu d'écraser : chacun relit la
politique en place et ne remplace que son propre `Sid`.

Si des vignettes sont vides après un passage, vérifier avant de chercher
ailleurs :

```sh
# L'alias `mc` n'est pas posé d'avance dans le conteneur : il se crée à chaque
# fois. L'oublier donne « Unable to find alias », qu'on lirait à tort comme une
# panne de MinIO.
docker exec baobart-minio mc alias set loc http://localhost:9000 \
  "$(grep S3_ACCESS_KEY_ID .env | cut -d= -f2)" \
  "$(grep S3_SECRET_ACCESS_KEY .env | cut -d= -f2)"

docker exec baobart-minio mc anonymous get-json loc/baobart-media
```

Deux `Sid` doivent apparaître : `ApercusPublics` (`public/*`) et
`LectureAnonymeDesVisuelsDeDemonstration` (`demo/*`). Un seul des deux = un
écrivain a écrasé l'autre.

Puis l'épreuve qui compte — une vraie clé, prise en base :

```sh
URL=$(docker exec baobart-postgres psql -U baobart -d baobart -t -A \
  -c "SELECT \"coverUrl\" FROM \"Product\" WHERE \"coverUrl\" LIKE '%demo/apercu%' LIMIT 1;")
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$URL"
```

`403` = politique. `404` = clé absente, donc faute de frappe dans le catalogue
— c'est ce que `verif-catalogue.mjs` attrape.

---

## 7. Pourquoi MinIO et pas `public/img/`

Mesuré le 24 septembre 2026 : `public/img/demo/` contient seize fichiers pour
32 Mo, et le dossier source du catalogue en pèse 985. Commiter le second ferait
d'un `git clone` un téléchargement d'un gigaoctet, pour des images que personne
ne relit dans un diff.

MinIO est par ailleurs le chemin réel : en production, une couverture est une
clé S3 servie par `urlPublique()`.

Le prix est dit franchement : **sur un clone frais, les vignettes sont vides
tant que `medias-demo.mjs` n'a pas tourné.** C'est pour cela qu'il est
idempotent et qu'il tient en une commande.

### Les couvertures sont des dérivées, jamais les originaux

Les originaux vont de 30 Ko à 28 Mo. Une page de mosaïque en charge une
trentaine : douze mégaoctets par vignette font trois cent soixante mégaoctets à
l'écran. Le script produit donc des JPEG de 1400 px (`demo/apercu/`), et
`apercuOuOriginal()` choisit le bon selon le type.

Mesuré : 5,2 Mo pour trente vignettes, au lieu d'environ 150.

---

## 8. Après le seed, vérifier avec les yeux

Le seed annonce « 90 produits créés ». Ce nombre ne dit rien de ce qui
s'affiche.

```sh
npm run dev              # port 3100, pas 3000
# ouvrir /explore, filtrer sur chaque famille ajoutée
```

À regarder :

- les vignettes chargent (pas de rectangle gris ni noir) ;
- les vidéos montrent une image fixe au repos et jouent au survol ;
- les noms et les familles correspondent ;
- aucune marque réelle n'est passée.

**Ne jamais lancer `npm run build` pendant que `next dev` tourne** : les deux
écrivent dans `.next`, et la page s'affiche alors sans styles. Ce n'est pas un
défaut de l'application, c'est un artefact de mesure — j'y ai cru une fois.

---

## 9. Quand ça ne marche pas

| Symptôme | Cause la plus probable |
| --- | --- |
| Vignette grise sur une carte | Clé absente → faute de frappe. `verif-catalogue.mjs` |
| Vignette grise sur **toutes** les cartes | Politique MinIO écrasée, ou script de médias jamais lancé |
| Vidéo noire au repos | Codec non décodable, ou `previewKind` absent |
| Dimensions rondes dans « Détails » | Chemin source non guillemeté |
| `Can't reach database at localhost:5433` | Port-forward Docker, pas un défaut. `docker ps` et rejouer |
| Produit invendable (`SANS_FICHIER`) | Aucun `ProductFile` de rôle `SOURCE` — le défaut du champ, mais un produit créé à la main peut n'en avoir aucun |
| Produit invendable (`GRATUITE`) | Prix à zéro en mode `FIXED`. Normal pour la démo |
| Le seed s'arrête, « à la fois catalogué et écarté » | Les deux listes se contredisent — lire la raison dans `ECARTES` avant de trancher |
| `verif` annonce des fichiers « sans avis » | Ni catalogués ni écartés : personne ne s'est prononcé. C'est le seul cas qui demande une décision |
| Une URL `demo/…` que rien n'affiche répond `200` | Visuel téléversé avant son exclusion. Rejouer `db:demo:medias`, qui le retire |

---

## 10. Ce qui a changé récemment

Deux réglages sont apparus après l'écriture du catalogue, et ils changent ce
qu'on peut faire d'une ressource à zéro franc.

- **`pricingMode: LIBRE`** (v1.67.0) : l'acheteur choisit son montant
  au-dessus d'un plancher. C'est le seul mode où un prix nul se vend — il y
  veut dire « pas de montant suggéré ». Se règle sur la fiche produit, panneau
  « Montant et pourboire ».
- **`tipsEnabled`** (v1.67.0) : un pourboire facultatif s'ajoute au prix. Il
  vit dans `OrderItem.tipAmount`, à côté du prix et non dedans.
- **`pppEnabled`** (v1.68.0) : le prix s'ajuste au pays déclaré. Sans effet
  aujourd'hui — la table `PppFactor` est livrée vide, et le rester tant que
  personne n'y charge de coefficients sourcés.

Aucun des trois n'est employé par le catalogue de démonstration. Ils sont
mentionnés ici parce qu'un agent qui ajoute des ressources se demandera
pourquoi elles ne s'achètent pas.

---

## 11. Ce que ce document ne couvre pas

- **Les ressources réelles d'un créateur.** Elles passent par l'application,
  pas par un script.
- **Les fichiers vendus.** Le catalogue de démonstration ne pose que des
  visuels publics ; un vrai pack téléchargeable vit dans un préfixe privé et
  ne se sert que contre une URL signée.
- **La suppression d'un produit.** `db:demo:catalogue` est idempotent par le
  slug : il corrige et ajoute, il n'efface pas. Retirer une ressource déjà
  semée demande un `DELETE` explicite — et de vérifier qu'aucune commande ne
  la désigne.

  Une seule exception, et elle ne concerne que MinIO : `db:demo:medias` retire
  les objets d'un visuel nommé dans `ECARTES`. Ajouter un fichier à cette
  liste après coup suffit donc à le sortir du stockage, mais **pas** à
  supprimer la fiche qui le citait — c'est précisément le cas que le seed
  refuse désormais.
- **Le poids du dossier source.** 985 Mo tiennent hors du dépôt, mais rien ne
  le garantit : personne n'empêche de commiter une image par mégarde.
  `public/img/demo/` en contient seize pour 32 Mo, et c'est déjà beaucoup.
