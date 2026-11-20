# Revue des vues avec les skills Halo — relevé du 20 novembre 2026

**Relevé sur `main` v1.108.6 (`19fa33a`) · corrigé dans la PR #66 (v1.108.8 à v1.108.11) · demande d'`aucepsdev` du 14/11**

> « Le design système contient des skills, vérifie chaque vue avec ces skills
> pour éprouver notre design. »
>
> Ce document dit, skill par skill, ce que chaque grille a trouvé sur les vues
> de l'application. Il précise ce que cette PR a corrigé, mesures avant et après
> à l'appui, et ce qui reste ouvert, avec la tâche ou la décision qui le
> traitera. Il complète [`DESIGN_ECARTS_2026-11.md`](DESIGN_ECARTS_2026-11.md)
> (D1b), qui compare les écrans aux maquettes : ici, on les compare aux
> **règles** de la livraison.

---

## En bref

- **Dix corrections pour le mouvement, le mobile et l'accessibilité**, mesurées
  avant et après (tableau plus bas). Exemples : les survols sous le doigt (5 → 0
  règles), les champs qui faisaient zoomer iOS (218 → 0), une boucle qui
  tremblait sous mouvement réduit (1 → 0), trois champs sans nom (3 → 0), et
  l'inscription sans borne haute.
- **Neuf corrections face aux données extrêmes** (`break-ui`) : à 320 px, les
  pages qui débordent passent de 15 à 7 avec le pire cas. Au bureau, un seul
  titre long ne fait plus sortir de l'écran tout le catalogue du créateur.
- **Ce que des tests gardent désormais.**
  - `lib/systeme/mouvement.test.ts` : survols, courbes, boucles en ligne.
  - `e2e/mouvement.spec.ts` : le doigt, les champs, les chiffres, les boucles.
  - `e2e/pire-cas.spec.ts` : les fiches extrêmes à 320 px, le nom sous « Suivre ».
  - `lib/profil/validation.test.ts` : les bornes de l'inscription.

  Le geste de pression écrasé, le soulignement du logo, la trame blanche et les
  étiquettes n'ont pas de test dédié.
- **Les 7 pages qui débordent encore** sont toutes dans le tableau de bord, à
  320 px : des boutons, des filtres et des rappels qui refusent de passer à la
  ligne. Elles reviennent à **D2**, qui redessine ces écrans pour le mobile.
- **Le mouvement de Baobart était déjà au-dessus de la moyenne.** Une courbe
  unique, les boucles arrêtées sous mouvement réduit, le menu « Partager » qui
  suit les recettes des skills presque à la lettre. Les écarts trouvés sont
  ceux où le code s'écartait de **sa propre** règle.
- **Ce qui reste demande une décision, pas du code.** Le rail qui pousse la
  page, le curseur qui clignote sans fin dans l'en-tête, des durées au-delà de
  300 ms : la maquette les dessine ou les a choisis, et les skills les
  déconseillent. Voir « Décisions attendues ».
- **Contraste : 799 nœuds sur 41 pages.** C'est le domaine de Q-30, tenu par
  l'autre session (annoncé dans #61) : le détail lui est transmis, rien n'est
  corrigé ici.

---

## Comment cette revue a été faite

### Les skills, lus en entier

Les 12 skills de `Baobart redesign Halo system/project/skills` ont été lus le
20/11/2026, fichier par fichier : 3 456 lignes. Une seule exception :
`animate/RECIPES.md`, recueil de recettes de construction, dont seuls les titres
ont été lus.

| Portée | Skills | Comment ils ont servi |
| --- | --- | --- |
| **Vue par vue** | `break-ui` · `emil-design-eng` · `apple-design` | données extrêmes posées en base ; finition, repères, typographie |
| **Code entier, une seule fois** | `review-animations` · `improve-animations` · `remove-animations` · `find-animation-opportunities` · `animation-performance` · `mobile-native` | le mouvement et la couche « plateforme » vivent dans `app/globals.css` et une poignée de composants : une vue ne les change pas |
| **Non appliqués** | `animate` · `prototype` · `animation-vocabulary` | voir la dernière section |

### Les mesures

| Outil | Ce qu'il mesure |
| --- | --- |
| `pnpm design:revue` | chaque route de `scripts/design/ecrans.ts`, ouverte deux fois. **Bureau** (1440 × 900) : axe-core, règles WCAG 2.0 à 2.2 A et AA ; règles `:hover` qui bougent un élément hors de `@media (hover: hover)`. **Téléphone** (320 × 640, tactile, mouvement réduit) : débordement horizontal, champs sous 16 px, animations encore en cours et boucles infinies. |
| `pnpm design:pire-cas` + `design:revue -- --pire-cas --captures` | le jeu de données extrêmes de `break-ui`, posé en base comme la démonstration, et une capture par vue |
| `lib/systeme/mouvement.test.ts` | ce qui se lit dans le texte : survols non filtrés, `ease-in`, `transition: all`, boucles écrites en ligne |
| `e2e/mouvement.spec.ts` | ce qui ne se voit qu'au navigateur : le survol au doigt, les champs sous le doigt, les chiffres, les boucles sous mouvement réduit |
| `e2e/pire-cas.spec.ts` | les fiches extrêmes et la page du créateur au plus long nom, à 320 px ; le nom qui ne doit pas passer sous « Suivre » |

Les mesures ont été faites sur un build de production, avec la base de
développement remplie de 30 éléments par liste (`design:remplir-listes`, PR #60).
Elles portent sur **98 routes** :

- **15 routes** n'ont pas pu être mesurées : la démonstration n'a aucune
  donnée pour leur paramètre (une offre d'emploi, un service, un article…).
  Elles sont listées dans `captures-design/*/revue-skills.json`.
- **MinIO était injoignable** pendant la mesure : son image a disparu du
  Docker Hub, et il n'a pas démarré sur ce poste. Les fichiers **téléversés**
  ne répondaient donc pas. Les couvertures de démonstration, elles, sont des
  fichiers statiques (`public/img/demo/`) et s'affichaient. Une première
  version de ce paragraphe disait « les images répondent 404 » : c'était faux
  pour celles-là. Pour `break-ui`, l'image qui ne répond pas est un cas du
  catalogue, posé exprès sur l'avatar du créateur extrême.

### Ce qui ne se mesure pas ici

Les skills le disent eux-mêmes (`mobile-native` §11) : l'émulation de Chrome
ne reproduit ni le survol collé, ni le délai de 300 ms, ni l'encoche, ni le
clavier, ni le geste. Deux mesures du script ne discriminent rien pour cette
raison. Chromium sans écran déclare la surbrillance au toucher
« transparente » et l'ajustement du texte à « 100 % », que la règle soit posée
ou non. Ce qui en relève est marqué **à vérifier sur un vrai téléphone**, pas
« réglé ».

---

## Ce que cette PR corrige — mesuré avant et après

| # | Défaut | Skill | Avant (20/11) | Après | Garde |
| --: | --- | --- | --- | --- | --- |
| 1 | Cinq survols déplaçaient un élément sans `@media (hover: hover)` : au doigt, le bouton touché restait soulevé | `mobile-native` §1, `review-animations` 8 | 5 règles, sur toutes les pages | **0** | unitaire + e2e |
| 2 | Champs sous 16 px sous un pointeur grossier : iOS zoome dessus et ne dézoome pas | `mobile-native` §4 | 218 champs, 57 pages | **0** | e2e |
| 3 | La base des dix maquettes (l. 17-19) n'était pas reprise : surbrillance, pivotement, chiffres tabulaires | `mobile-native` §2, `break-ui` (chiffres qui bougent) | `font-variant-numeric: normal` | `tabular-nums` | e2e |
| 4 | `floaty` tournait à 0,01 ms par tour, sans fin, sous mouvement réduit (accueil) | `review-animations` 8, `apple-design` §14 | 1 page | **0** | unitaire + e2e |
| 5 | La même `floaty` écrasait le `transform` du geste de pression de sa carte | `emil-design-eng` (« buttons must feel responsive ») | lu dans le code | la carte flotte sur une enveloppe | — |
| 6 | `mot-sort` suivait `ease-in`, que l'en-tête de `globals.css` interdit | `review-animations` 3 | 1 | 0 | unitaire |
| 7 | Le soulignement du logo grandissait par `width` | `animation-performance` | 1 | `scaleX` | — |
| 8 | Rail et décalage de l'accueil en `ease` ; la maquette dit `cubic-bezier(.23,1,.32,1)` | traduction à l'identique | `ease` | `--ease-sortie` | — |
| 9 | Trois champs sans nom accessible (`/dashboard/publicites/nouvelle`) | axe `label` | 3 | **0** | — |
| 10 | Aucune longueur maximale à l'inscription : un nom de 120 caractères passait, puis le profil refusait de s'enregistrer | `break-ui` (« frontend et backend en désaccord ») | lu dans le code | bornes du profil appliquées | unitaire |

---

## Constats, skill par skill

### `mobile-native` — la couche plateforme

| Symptôme du skill | Où en est Baobart |
| --- | --- |
| Survol collé après un toucher | **Corrigé** (#1). Restent six survols gérés en JavaScript (`onMouseEnter`) : la carte du fil, la bannière, le rail, les menus de l'en-tête. Ceux de l'en-tête ouvrent des menus : leur comportement au doigt est à reprendre avec **D2**. |
| Voile gris au toucher | **Corrigé** (#3), à vérifier sur un vrai téléphone |
| Hauteur fausse (`100vh`) | Tient. Cherché le 20/11 dans `app/` et `components/` (hors labo) : 43 `min-height: 100vh`, tous des fonds de page ou la barre latérale, qui redevient `min-height: 0` sous 980 px. Aucun ne coupe rien. Un seul `height: 100vh` : la couche de confettis, plein écran et décorative. Rien d'épinglé en bas n'en dépend. |
| Zoom sur un champ | **Corrigé** (#2), à vérifier sur iPhone |
| Toucher qui traîne | Tient : `touch-action: manipulation` et retour à l'appui (`:active`) sur `pression` et `sticker-press` |
| Tirer pour rafraîchir | Tient, par décision : Baobart est un document qui défile, et le rafraîchissement y est bienvenu. Le ruban « Du même créateur » contient déjà son défilement (`overscroll-behavior-x: contain`). |
| Contenu sous l'encoche | Tient : `viewportFit: "cover"` dans `layout.tsx`. Les éléments fixés en bas sont à vérifier avec **D2**. |
| Sélection au doigt long | Tient sur les boutons (`user-select: none` dans `pression`) |
| Carrousel qui défile de travers | Tient : `scroll-snap-type: x mandatory`, défilement natif |
| Barre d'état assortie | Tient : une seule `themeColor` (`#FFD84A`), et pas de mode sombre |
| « Juste dans Chrome » | **Ouvert** : aucune de ces vérifications n'a été faite sur un vrai téléphone. C'est le critère de fin de **D2**. |

### `review-animations` et `improve-animations` — le mouvement entier

**Carte des fréquences.** Elle décide de la sévérité.

| Fréquence | Mouvements |
| --- | --- |
| Plus de 100 fois par jour, ou au clavier | le panneau de résultats de la recherche (il s'ouvre à la frappe) ; le curseur qui clignote dans l'en-tête |
| Des dizaines de fois par jour | geste de pression ; survol des cartes du fil ; rail ; pastille des filtres ; bascule « Suivre / Abonné » ; « j'aime » |
| Occasionnel | menus et modale ; menu « Partager » ; FAQ dépliée ; réorganisation de la mosaïque |
| Rare | compteurs du héros ; frise de commande ; paquet de collections ; mot qui tourne |

Les constats restants, au format exigé par `review-animations` :

| Avant | Après proposé | Pourquoi |
| --- | --- | --- |
| Le panneau de recherche entre par `popin .16s` à la frappe (`components/shell/header.tsx:357`) — **la maquette l'écrit ainsi** (`Baobart Accueil.dc.html`, l. 88) | Aucune animation | Déclenché au clavier : « never animate keyboard-initiated actions ». Décision n° 3 |
| Les menus de l'en-tête entrent par `popin` : ils **montent** de 18 px (`header.tsx:487`, `:651`) — **comme dans la maquette** (`popin .14s`, 5 fois dans l'Accueil) | `translateY(-6px) scale(.97)` → repos, comme `.pop` | Un menu sort de son bouton, au-dessus de lui. Deux trajets différents pour le même geste, c'est une incohérence. Décision n° 6 |
| `.bascule > span` : 350 ms (`globals.css`, « Bascule de libellé ») | 200 à 250 ms | Au-delà de 300 ms, sur un bouton |
| `.pastille-glisse` : `width` en 320 ms avec rebond (`globals.css`) | `transform` seulement, 200 à 250 ms, sans rebond | Indicateur d'onglet, des dizaines de fois par jour : mise en page animée, durée et rebond hors budget |
| `::view-transition-group(*.vt-carte)` : 380 ms | 250 à 300 ms, `ease-in-out` | Déplacement à l'écran, après chaque filtre |
| `.rebond` (420 ms), `.coeur-bat` (380 ms), `.eclat` (520 ms), en `@keyframes` | Plus courts, ou en transitions | « J'aime » est fréquent, et des images clés repartent de zéro si l'on reclique |
| `.incline` : retour en 450 ms | Garder | Décoratif, suit la souris, ignore le doigt et le mouvement réduit (`inclinable.tsx:39`) : conforme |

**Verdict au sens du skill : bloquant, pour un seul point**, le panneau animé à
la frappe. Le reste relève des « simplifications manquées » et du « timing ».

**Ce qui tient** — et qu'il ne faut pas toucher :
- la courbe unique `--ease-sortie` ;
- le geste de pression (140 ms, 97 %), gardé par `e2e/mouvement.spec.ts` ;
- `.pop` (menu « Partager ») : `@starting-style`, 160 ms, `scale(.97)` et
  opacité, ancré sous son bouton. C'est la recette « Dropdown » des skills ;
- les boucles et les cascades arrêtées sous mouvement réduit (les deux blocs
  « Mouvement réduit » de `globals.css`), avec leur raison écrite ;
- le squelette patient : délai de 200 ms, rien ne clignote pour une attente
  imperceptible ;
- la FAQ en `interpolate-size` : `height` y est toléré, c'est un accordéon.

### `remove-animations` — ce qui pourrait partir

Rien n'a été retiré. Le skill dit d'abord de respecter les décisions écrites,
et chaque candidat en a une : un ajout choisi au labo (08/10 pour l'apparition
au défilement, 09/10 pour le curseur), ou un trait de la maquette (le panneau de
recherche). Les candidats, avec la branche du skill qui les condamnerait :

| Où | Branche | Recommandation |
| --- | --- | --- |
| Le curseur qui clignote dans la recherche de l'en-tête (`.curseur-tape`) | « boucle infinie sur un élément permanent » | Une seule fois, ou retiré |
| Le panneau de recherche (`popin` à la frappe) | « déclenché au clavier » | Retiré |
| L'apparition au défilement (`.defil-apparait`), section par section | « fade-in-on-scroll on every section » | À regarder page par page : elle suit le défilement et non le temps, donc ne retient personne ; mais le bas de l'écran reste à moitié transparent |

**Gardés délibérément** :
- les compteurs du héros : page vitrine, rendus justes côté serveur,
  mouvement réduit respecté ;
- la frise de commande : rare, elle dit un état ;
- le menu « Partager » : il relie le menu à son bouton ;
- le défilant « CREATE. SHARE. » : page vitrine, arrêté sous mouvement réduit.

### `find-animation-opportunities` — ce qui manque

| Où | Aujourd'hui | Raison | Fréquence | Proposition |
| --- | --- | --- | --- | --- |
| La légende repliée de « Ventes » (`<details>`, PR #60) | s'ouvre d'un coup | éviter un saut | occasionnel | la classe `details-anime` existe déjà (FAQ des tarifs) : la poser |

**Écartés** :
- un mouvement sur les listes du tableau de bord, refusé : ce sont des données
  qu'on lit ;
- un mouvement au changement de page du tableau de bord, refusé : plus de
  100 fois par jour.

### `animation-performance`

| Élément | Cause | Avant | Proposé | Vérifié |
| --- | --- | --- | --- | --- |
| Le rail de l'accueil et la page entière (`rail.tsx`, `home-shell.tsx`) | mise en page animée, à chaque survol du bord gauche : la page passe de 112 à 268 px de marge, et la mosaïque recalcule ses colonnes | `width` + `padding-left`, 180 ms | Le rail par-dessus la page en `transform`, sans pousser le contenu — **la maquette le dessine pourtant ainsi** : voir « Décisions » | dans le code ; la saccade se mesure sur un ordinateur modeste (le rail n'existe qu'au-dessus de 1180 px), pas sur ce poste |
| Le soulignement du logo | mise en page animée | `width` | `scaleX` | **corrigé** (#7) |
| La pastille des filtres | mise en page animée | `width` | `transform` | dans le code |
| La barre de téléversement (`file-uploader.tsx:372`) | mise en page animée, légère | `width .18s linear` | `scaleX` | dans le code ; faible enjeu |

### `break-ui` — le pire cas réaliste

**La bascule.** Le skill demande de basculer, sur chaque vue, entre les
données de démonstration et les pires données réalistes. Ici, le pire cas
entre par la base, comme la démonstration : rien n'est retouché dans les
composants.

```sh
pnpm design:pire-cas                              # pose le jeu (--purger le retire)
pnpm design:revue -- --pire-cas --captures        # les vues avec ce jeu, une capture par vue
```

**Les valeurs et leurs limites**, lues dans le code le 20/11. Le détail est
dans `scripts/design/pire-cas-donnees.ts`.

| Champ | Limite réelle | Valeur extrême posée |
| --- | --- | --- |
| nom affiché | 80 au profil ; **aucune** à l'inscription (corrigé, #10) | 86 caractères : un nom composé, un nom d'épouse et un studio |
| identifiant | 40, lettres, chiffres et tirets ; **aucune** borne haute à l'inscription (corrigé) | 40 caractères sans tiret, donc rien où couper |
| titre de ressource | **aucune**, ni au formulaire ni au serveur (3 au minimum) | 165 caractères ; un nom de fichier `.zip` de 63 sans espace ; « Zen » ; emoji ; arabe ; `<b>…</b> &amp; **…**` |
| prix | aucune borne haute lue | 12 345 678 F ; 1 F ; gratuit |
| compteurs | entiers | 1 000 000 « j'aime », 1 284 abonnés, 1 seul avis |
| avatar | une adresse | une image qui ne répond pas |
| description | aucune | six paragraphes |

**Mesuré le 20/11** (`captures-design/pire-cas*/`) : à 320 px, **15 pages
débordent** avec le pire cas, contre 9 avec la démonstration ;
**7 après les corrections**, toutes dans le tableau de bord (voir plus bas) ; avec la démonstration, 9 avant, 8 après.

#### Ce qui casse

| # | Gravité | Où | Valeur | Ce qui arrive | Correction |
| --: | --- | --- | --- | --- | --- |
| 1 | **Cassé** | catalogue du créateur, au bureau ; même construction dans 5 autres listes du tableau de bord | titre de 165 caractères | toutes les lignes sortent de la carte et de l'écran, et les actions de chaque ligne ne sont plus visibles. 1 372 px à 320. | **corrigé** : `gridTemplateColumns: minmax(0, 1fr)` (`app/dashboard/{produits,commandes,commissions,apercu,statistiques}/page.tsx`, `app/dashboard/page.tsx`) |
| 2 | **Cassé** | fiche, 320 px | 12 345 678 F | la licence sort de la carte jaune, et la page déborde de 43 px | **corrigé** : `flexWrap` (`components/product/detail.tsx`) |
| 3 | **Cassé** | fiche, carte du créateur, 320 px | nom de 86 caractères | le texte du nom passe **sous** « Suivre » | **corrigé** : `flexWrap` sur la rangée, `overflowWrap: anywhere` sur le nom |
| 4 | **Cassé** | fiche ; « Ma bibliothèque » ; « Remboursements » ; `/a-propos` ; `/createurs` | nom de fichier sans espace | 608, 314, 262, 239 et 152 px de débordement | **corrigé** : `overflowWrap: anywhere` sur chaque titre |
| 5 | Disgracieux | fiche | description en six paragraphes | les paragraphes se fondent en un seul bloc | **corrigé** : `white-space: pre-line` |
| 6 | Disgracieux | boutons « J'aime » et « Suivre » | 1 000 000 ; 1 284 | « 1000000 », « 1284 » | **corrigé** : format `fr-FR`, comme les compteurs du héros |
| 7 | Disgracieux | vignettes des lignes du tableau de bord | une ligne sur cinq | vignette entièrement blanche : la trame tirait « blanc sur blanc » | **corrigé** : `trameDe` sans le blanc (`components/dashboard/ecran.tsx`) |
| 8 | Disgracieux | `/createurs`, miniatures des ressources | six ressources sans couverture | six pastilles de 30 px, dont les titres débordent | **corrigé** : le titre reste dans sa miniature, et se lit au survol |
| 9 | Accessibilité | bouton « J'aime » | un compteur non nul | le nom accessible (« J'aime ») ne contient pas le texte visible (« J'aime · 99 ») : axe `label-content-name-mismatch`, 6 pages | **corrigé** : le nom est le texte visible, l'état est dans `aria-pressed` |
| 10 | Disgracieux | fiche, au bureau | titre de 165 caractères | 9 lignes en grand corps : le prix et l'achat passent sous le premier écran | décision n° 4 (borner le titre) |
| 11 | Disgracieux | fiche sans couverture | titre de 165 caractères | la pastille arrondie à 999 px devient un cercle, et le texte en sort | décision n° 7 |
| 12 | Disgracieux | page du créateur | avatar introuvable | cercle blanc vide, sans initiales ni trame | décision n° 8 |
| 13 | Disgracieux | fiche, bandeau du titre, 320 px | titre de 165 caractères | « RESSOURCE » garde sa colonne, et le titre tient sur 14 lignes dans 120 px | **D2** |
| 14 | Disgracieux | accueil, 320 px (démonstration) | — | la petite carte flottante fait 42 px de large. Sous 900 px, la grille passe à une colonne, mais la grande carte en demande deux (`components/home/hero.tsx:237`, `1 / span 2`) | **D2** |
| 15 | Fragile | titre de ressource | — | aucune borne | décision n° 4 |

#### Ce qui tient

- **L'échappement.** `<b>Promo</b> &amp; **gras**` s'affiche tel quel
  partout : catalogue, ventes, fiche.
- **Les emoji et l'arabe**, y compris mêlé au français, s'affichent sans
  casse ni inversion visible.
- **Les nombres abrégés** (« 98,8 k dl ») et les prix (« 12 345 678 F »)
  sont bien formatés.
- **Les ventes coupent proprement** un titre long, avec des points de
  suspension.
- **La page du créateur** tient à 320 px malgré un nom de 86 caractères : il
  passe à la ligne, ce que le skill préfère pour un nom.
- **« Mes achats »** tient : les lignes s'empilent.
- **Les fiches** au titre court, emoji, arabe et échappé ne débordent pas.

**Non vu.**
- Le créateur au nom court (« Jo ») a répondu 404 : un compte sans ressource
  n'a pas de vitrine, et c'est voulu (`app/createurs/[username]/page.tsx`,
  l. 100). Le jeu devrait lui donner une ressource. Le nom court a été vu sur
  la fiche « Zen », qui tient.
- Le skill demande aussi le **zoom à 200 %**, le **mode sombre** et le
  **sens droite-à-gauche**. Le premier n'a pas été essayé. Les deux autres ne
  s'appliquent pas : Baobart n'a ni mode sombre ni interface en arabe.
- Les **listes à 1 000 lignes** : toutes les listes du tableau de bord sont
  paginées par #60, et leur rendu à 30 éléments a été mesuré là.

### `emil-design-eng` et `apple-design` — finition et repères

| Avant | Après proposé | Pourquoi |
| --- | --- | --- |
| La carte flottante du héros ne répondait ni au survol ni au clic | **Corrigé** (#5) | « Buttons must feel responsive to press » |
| Les cartes du fil se soulèvent au survol, et leur image grossit en 350 ms (`resource-card.tsx:339`, `:381`) | Garder le soulèvement, retirer ou réduire le zoom | Survol des dizaines de fois par jour, sur des cartes qui ne sont pas l'action principale |
| Aucune règle pour `prefers-contrast` ni `prefers-reduced-transparency` | Rien à faire pour la transparence (aucun `backdrop-filter`) ; le contraste renforcé suivra Q-30 | `apple-design` §14 |
| Repères (« où suis-je, comment sortir ») | Tient : écran actif en jaune dans le menu, en-tête qui nomme l'espace | `apple-design` §16, « Wayfinding » |

### axe-core — l'accessibilité, vue par vue

| Règle | Avant | Après | Qui |
| --- | --- | --- | --- |
| `color-contrast` | 799 nœuds, 41 pages | 799 nœuds, 41 pages (inchangé) | **Q-30**, session du responsable (transmis dans #61) |
| `label` | 3 champs, 1 page | **0** | corrigé ici (#9) |

Les couples de couleurs les plus fréquents (sur un échantillon de 3 nœuds par
page) :

| Texte sur fond | Contraste | Pages |
| --- | --: | --: |
| `#7d7d7d` sur blanc | 4,11 | 20 |
| blanc sur `#e2622c` | 3,48 | 19 |
| `#e88156` sur blanc | 2,72 | 4 |
| `#e2622c` sur blanc | 3,48 | 3 |
| `#78757b` sur `#f4eefc` | 3,99 | 3 |

Deux pages concentrent 380 nœuds : `/dashboard/systeme/membres` et
`/dashboard/statuts`, 190 chacune. L'orange **en texte** (`#e2622c` et
`#e88156` sur blanc, 7 pages) contredit la charte : `globals.css`, l. 15-16,
réserve l'orange aux surfaces et n'autorise en texte que `#b34a1f`. Le blanc
sur une surface orange, lui, la respecte : il échoue au contraste, pas à la
charte.

---

## Décisions attendues

| # | Question | Ce que disent les skills | Ce que dit la maquette | Recommandation |
| --: | --- | --- | --- | --- |
| 1 | Le rail de l'accueil doit-il **pousser** la page en s'ouvrant au survol ? | Non : mise en page animée à chaque passage de la souris (`animation-performance`) | Oui (`Baobart Accueil.dc.html`, l. 46 et 50) | Garder le décalage quand le rail est **verrouillé** ouvert, mais ouvrir le rail **par-dessus** la page au simple survol |
| 2 | Le curseur de la recherche doit-il clignoter sans fin, sur toutes les pages ? | Non : boucle sur un élément permanent (`remove-animations`) | Absent des 10 maquettes (cherché le 20/11 : `steps(1)`, `blink`, `clignot`, `caret`, `curseur`) ; ajout du labo, décidé le 09/10 | Trois clignements, puis immobile |
| 3 | Le panneau de recherche s'anime-t-il à la frappe ? | Non : action au clavier (`review-animations`, bloquant) | Oui : `popin .16s` sur les suggestions (`Baobart Accueil.dc.html`, l. 88) | Retirer l'animation de ce panneau seulement |
| 4 | Quelle longueur maximale pour le titre d'une ressource ? | « Unbounded » est un constat en soi (`break-ui`) | — | 120 caractères, au formulaire et au serveur ; les titres d'emploi, de service et d'article ont déjà la leur |
| 5 | Les durées au-delà de 300 ms (bascule, pastille, mosaïque, « j'aime ») | À ramener à 200-250 ms | Choisies au labo le 09/10 | Les ramener d'un bloc, puis juger à l'œil le lendemain, comme le conseille `emil-design-eng` |
| 6 | Les menus de l'en-tête entrent-ils par le bas (`popin`, +18 px) ou depuis leur bouton (comme « Partager », −6 px) ? | Depuis leur bouton (`apple-design` §7, `review-animations` 5) | Par le bas (`popin`, l'Accueil l'écrit 5 fois) | Depuis leur bouton : la recette existe déjà dans `.pop` |
| 7 | La pastille de titre d'une fiche sans couverture : couper ou passer à la ligne ? | Couper à deux lignes (`line-clamp`), puisque le titre complet est juste à côté (« Truncate, wrap, or clamp ») | Une pastille d'une ligne | Deux lignes, rayon de 16 px au lieu de 999 quand elle passe à la ligne |
| 8 | Un avatar qui ne répond pas : trame derrière l'image ? | Repli sur des initiales ou une trame (`break-ui`, « Broken-image icon ») | — | Trame derrière l'image. **Mais** un avatar détouré (logo transparent) laisserait voir la trame à travers : à trancher en le voyant. |

---

## Non appliqués, et pourquoi

| Skill | Raison |
| --- | --- |
| `animate` | Il **construit** une animation demandée ; il ne relit pas. Ses règles « Never Ship » sont celles de `review-animations`, appliquées plus haut. |
| `prototype` | Il ne s'emploie que sur demande explicite (`disable-model-invocation`), pour comparer plusieurs variantes d'un même composant. Aucune n'a été demandée. |
| `animation-vocabulary` | Un glossaire, qui nomme un effet décrit à demi-mot. Il ne produit aucun constat. |
| `animate-expo` | Cité par `mobile-native` pour React Native : **absent de la livraison**. Le dossier `skills` en contient 12, et aucun ne porte ce nom. |

---

## Rejouer ce relevé

```sh
pnpm design:remplir-listes                      # listes pleines (PR #60) : sans elles, rien ne déborde
pnpm build
APP_URL=http://localhost:3300 pnpm exec next start -p 3300
pnpm design:revue -- --sortie=captures-design/demo          # la démonstration
pnpm design:pire-cas                                        # le pire cas, posé en base
pnpm design:revue -- --pire-cas --captures --sortie=captures-design/pire-cas
pnpm design:pire-cas -- --purger                            # et on le retire
```

Deux précautions, apprises en faisant ce relevé :
- **Purger le pire cas avant de mesurer la démonstration.** La première
  mesure « après » a été lancée avec le jeu encore en base, puis arrêtée et
  refaite : elle aurait mêlé l'effet des corrections et celui des données.
- **Arrêter le serveur en tuant le processus qui tient le port.** Arrêter
  l'enveloppe ne suffit pas : `next start` lui survit, comme `CLAUDE.md` le
  dit de `next dev`. Vérifié deux fois le 20/11.
