# Écarts maquettes ↔ écrans — relevé du 14 novembre 2026 (D1b)

**Application v1.108.0 (PR #52) · livraison « Halo » versée le 13/11** · ligne D1b de `TACHES.md`, PR #54

> Ce document compare, **écran par écran**, ce que dessinent les maquettes
> `Baobart Design/*.dc.html` et ce qu'affiche l'application, à 360, 768 et
> 1440 px de large. Il sert de point de départ à D2 (mobile) et D3/D4
> (Dashboard) : chaque écart y porte la tâche qui le traitera.
>
> Il complète [`MAQUETTES_A_FAIRE.md`](MAQUETTES_A_FAIRE.md) (31/08), qui
> relevait l'inverse — les écrans codés sans maquette — avant la livraison Halo.

---

## Comment ce relevé a été fait

**La liste des écrans vient du source des maquettes, pas de leurs noms.** Sauf
`Baobart Mobile`, les maquettes ne sont pas des planches fixes mais des
composants à état : un clic dans le menu change d'écran. Les écrans ont donc été
comptés dans le code de chaque maquette — le menu `NAV` et la table
`SUB_PARENT` du Dashboard, les valeurs de `screen` de l'Accueil, les options de
`mode` (Auth) et d'`ecran` (Parcours), les `data-screen-label` du Mobile.

| Maquette | Écrans | Comment ils sont repérés |
| --- | --: | --- |
| Accueil | 25 | 14 valeurs de `screen`, 10 pages de documentation (`DOCS`), la fiche produit en modale |
| Auth | 6 | options de la propriété `mode` |
| Parcours Achat | 8 | options de la propriété `ecran` |
| Dashboard | 68 | 59 entrées de menu (11 acheteur, 20 créateur, 28 administration) et 9 sous-écrans |
| Mobile | 10 | `data-screen-label` |
| Badges | 1 | une planche |
| **Total** | **118** | |

Les sous-écrans du Dashboard ont d'abord été lus dans les onglets (`…_TABS`) :
sept. Le croisement avec `Baobart Design/github.md` — la carte du designer, qui
range « Notifications (+ réglages) » parmi les écrans — en a fait trouver deux
de plus, définis ailleurs. Ils sont maintenant lus dans `SUB_PARENT`, la table
que le rendu consulte réellement pour accepter un écran hors du menu. Les états
internes d'une page (un détail ouvert, une confirmation) ne sont pas des écrans
et ne sont pas capturés.

Les quatre autres fichiers — `Design System`, `Icons`, `Logo`, `LinkedIn` — sont
des planches de référence, pas des écrans de l'application.

**La table qui relie chaque écran à sa route est du code** :
[`scripts/design/ecrans.ts`](../scripts/design/ecrans.ts). Un test
([`maquettes.test.ts`](../scripts/design/maquettes.test.ts)) la confronte à ses
deux sources, dans les deux sens : aucun écran inventé ni oublié par rapport au
source des maquettes, chaque route citée existe, et chaque route de `app/` est
soit associée à un écran, soit déclarée sans maquette. Cinq casses volontaires
ont été attrapées (14/11).

**Les captures sont rejouables** : `pnpm design:captures` (mode d'emploi en tête
de [`scripts/design/captures.ts`](../scripts/design/captures.ts)). Chaque
maquette est ouverte sur l'écran voulu en posant son état de départ ; chaque
route est capturée sur un build de production, connectée au compte de test qui
convient. La sortie — planches maquette | application, `index.html`,
`rapport.json` — va dans `captures-design/`, ignoré par git : plusieurs
centaines de Mo, qui se régénèrent.

### Ce que ce relevé ne vaut pas — à lire avant le reste

- **Les données de démonstration de ce poste sont minces** : 26 produits,
  1 abonnement, aucune commande, offre d'emploi, prestation, événement, article
  ni publicité. Les listes sont capturées **vides** ; les fiches qui demandent
  un identifiant réel ne sont **pas capturées** (et le disent). Sur le poste du
  responsable, avec le jeu complet, la même commande les capturera.
- **Pas de MinIO ici** (`minio/minio:latest` ne se télécharge pas, mesuré le
  14/11) : les visuels téléversés manquent. Seuls ceux du dépôt
  (`public/img/demo`) s'affichent. Une vignette grise n'est pas un écart de design.
- **Le consentement aux cookies est posé d'avance** (« refuser ») : la bannière
  n'apparaît sur aucune capture. Elle se compare à part.
- **Les maquettes Auth, Parcours, Badges n'ont aucune règle pour les petites
  largeurs** (lu : leurs seules `@media` sont `pointer: coarse` et
  `prefers-reduced-motion`). À 360 et 768 px, leur capture montre la page
  desktop comprimée, pas un dessin mobile. Accueil (1180 / 900 / 620 px) et
  Dashboard (980 px) en ont : leur capture à 360 px **est** un dessin.
- **Les mesures sont des mesures de la page, pas un audit** : une cible
  « sous 44 px » peut être légitime (un lien dans une phrase est exclu, une
  icône décorative cliquable ne l'est pas). Elles disent où regarder.

---

## En bref

**118 écrans dessinés**, relevés un par un le 14/11 :

| Verdict | Écrans |
| --- | --: |
| Aligné | 38 |
| Proche | 13 |
| Écart moyen | 17 |
| Écart net | 14 |
| Dépend d'une décision (forfaits, pages partagées) | 5 |
| Écart voulu, écrit dans le code | 1 |
| **Absent** de l'application | 14 |
| Non capturé ici (pas de données, ou achat impossible sur ce poste) | 12 |
| Pas un écran (lancement, erreur, chargement) | 3 |
| Planche de référence (Badges) | 1 |

Les 89 écrans comparables ont été **regardés** côte à côte, sauf un (réglages
des notifications côté créateur : même page que côté acheteur, jugé par
déduction et marqué comme tel).

**Ce qui pèse le plus**, dans l'ordre :

1. **Il n'y a pas de version mobile, seulement la version bureau rétrécie** (D2).
   La maquette mobile a une barre d'onglets en bas d'écran, un en-tête compact,
   des écrans pensés pour le pouce. À 360 px, l'application empile le menu du
   bureau dans une carte d'environ 330 px de haut, et le **menu du tableau de
   bord s'affiche en entier avant le contenu** (≈ 900 px pour le menu créateur).
   Les 8 écrans mobiles comparables sont tous en écart net.
2. **Des pages dépassent de l'écran d'un téléphone** (D2) — voir « Mesures ».
3. **Aucun champ de saisie n'atteint 16 px** (D2) : la règle de la livraison
   Halo (`@media (pointer: coarse) { input… { font-size: 16px } }`) n'est pas
   appliquée ; iOS zoome à chaque champ touché.
4. **Le menu du tableau de bord et ses pages ne se correspondent pas
   toujours** (D3/D4). Des pages existent sans entrée de menu (« Mes
   dossiers », « Candidatures », « Signalements & DMCA » — qui s'ouvre dans
   l'espace *acheteur*) ; des entrées de menu ouvrent un autre écran que celui
   dessiné (« Membres », « Versements créateurs », « Ventes »).
5. **Trois écarts ne se corrigent pas dans le code** : la maquette redessine
   le choix « Acheteur / Créateur » à l'inscription, retiré exprès le 09/10 ;
   « À propos » et « Signalement DMCA » ont été construits bien au-delà de la
   fiche dessinée. C'est au designer de trancher (voir « Décisions »).

Le reste — la grande majorité des écrans du bureau — est **aligné ou proche** :
même ossature, mêmes blocs, des boutons d'en-tête manquants et des chiffres
réels là où la maquette en invente.

---

## Les écrans dessinés que l'application n'a pas

| Écran (maquette) | Prévu par |
| --- | --- |
| Accueil · Page catégorie | C6 — pages catégorie |
| Dashboard créateur · Suivre les détails | Lot 5 — abonnés du créateur (A5) |
| Dashboard créateur · All Access | Lot 8 — Pass All Access (A6) |
| Administration · Vue d'ensemble, Boutiques créateurs, Catalogue, Finances plateforme, Abonnements, Catégories & tags, Journal d'activité, Réglages plateforme | Lot 6 — pilotage de l'administration (A4) |
| Administration · Contenus éditoriaux | B2 / C10 — sélection éditoriale |
| Administration · Jobs & services | aucune ligne de `TACHES.md` |
| Administration · Équipe & rôles | aucune ligne (`/dashboard/statuts` accorde des statuts de créateur, pas des rôles d'équipe) |

Et trois **vues** dont l'entrée de menu existe, mais qui ouvre un autre écran :

| Entrée de menu | Ce que la maquette dessine | Ce que l'application ouvre |
| --- | --- | --- |
| Créateur · Ventes | une liste simple des ventes (filtres de période, export CSV) | « Ventes · remboursement et accès » (l'écran « Remboursements » de la maquette) |
| Administration · Membres | chiffres, derniers comptes, vérifications d'identité | « Membres · décisions de risque » |
| Administration · Versements créateurs | bénéficiaires, « À verser / Valider », « Lancer le versement » | « Système · Versements » |

Hors écrans : le **lancement** mobile (écran 01) relève du manifeste d'une
application installée ; l'**erreur** et le **chargement** du Parcours ne se
capturent pas sans casser une page.

---

## Écran par écran

**Verdicts.** *Aligné* : le même écran, des détails diffèrent. *Proche* : même
ossature, un ou deux blocs autrement. *Écart moyen* : un bloc ou une
organisation différents. *Écart net* : un autre écran, ou une vue absente.
*Voulu* : l'écart est écrit dans le code, avec sa raison. *Vide* : capturé
sans données de démonstration ; la structure est jugée, pas le contenu.

Relu le 14/11 sur les planches à 1440 px (bureau) et à 360 px (mobile).
« Pour » nomme la tâche de `TACHES.md` qui traitera l'écart ; *à placer* = aucune.

### Site public (maquette Accueil)

| Écran | Route | Verdict | Ce qui diffère | Pour |
| --- | --- | --- | --- | --- |
| Accueil | `/` | proche | bandeau défilant « CREATE. SHARE. INSPIRE. » ajouté ; taxonomie des tuiles différente (Modèles, Images… contre Photo, Audio…) ; chiffres réels au lieu de 170+ / 12 400 / 4.9 | à placer |
| Explorer | `/explore` | **écart net** | le héros de recherche « Que cherches-tu aujourd'hui ? » (champ, sélecteur, recherches populaires) et les 10 tuiles de catégories manquent : la page commence à la grille | à placer |
| Fiche produit (modale) | `/products/[slug]` | proche | l'app ajoute un bloc « Partager » (8 réseaux) et « Avis » ; miniatures en images (maquette : aplats) | — |
| Tarifs | `/tarifs` | décision | 3 forfaits dessinés (Free, Essentiel 5 000 F, Pro 10 000 F) contre 4 dans l'app (dont 3 « bientôt ») | B3 |
| Fonctionnalités | `/fonctionnalites` | aligné | textes réécrits, visuels différents | — |
| Sponsoriser | `/sponsoriser` | écart moyen | pas de grille de logos partenaires ni de chiffres d'audience ; formats « sur devis » au lieu de 180 000 / 280 000 / 120 000 F (chiffres non tenus, à confirmer) | à placer |
| Concours & événements | `/evenements` | proche, vide | pas d'édition en cours en démo ; filtres par type ajoutés | B10 |
| Créateurs | `/createurs` | aligné | filtres par catégorie (maquette : par thème) ; mention « vérifié » | — |
| Profil d'un créateur | `/createurs/[username]` | proche | 4 chiffres au lieu de 5 (pas « abonnements ») ; avatar sous la bannière ; onglets Services et Collections absents ici — sans doute masqués à vide (`MAQUETTES_A_FAIRE` §F.3 les dit câblés) | à revoir avec données |
| Services | `/services` | aligné, vide | — | — |
| Fiche d'un service | `/services/[id]` | non capturé | aucune prestation en démo | — |
| Jobs | `/jobs` | aligné, vide | « Mes propositions » absent pour un visiteur ; filtres de contrat ajoutés | — |
| Fiche d'une offre | `/jobs/[id]` | non capturé | aucune offre en démo | — |
| Mon compte | `/dashboard/apercu` | **écart net** | la maquette dessine un espace compte *dans le site public* (en-tête et pied du site, onglets) ; l'app le met dans le tableau de bord | décision |
| À propos | `/a-propos` | **écart net** | fiche courte dessinée ; l'app a une page d'atterrissage longue (« De zéro à ton premier franc ») | décision |
| Contact | `/contact` | aligné | « Avant d'écrire » et un sélecteur de sujet ajoutés ; les deux adresses de la maquette ne sont pas affichées | — |
| Blogs | `/blog` | écart moyen, vide | page pleine largeur « Le blog » au lieu d'une fiche avec 3 cartes | à placer |
| Support | `/support` | aligné | l'app détaille davantage | — |
| Documentation | `/documentation` | aligné | l'app détaille davantage | — |
| Changelog | `/changelog` | aligné | une carte par version (≈ 30) au lieu d'un regroupement par mois — longueur à surveiller sur mobile | D2 |
| Licences | `/licences` | aligné | cartes de licences et vérification par programme ajoutées | — |
| Règles de publication | `/regles-de-publication` | aligné | formats acceptés ajoutés | — |
| Signalement DMCA | `/signalement` | **écart net** | fiche courte dessinée ; l'app a une page longue (loi 2013-451, engagements, « provisoire ») | décision |
| Politique de cookies | `/cookies` | aligné | chaque cookie détaillé ; titre sans « (UE) » | — |

### Connexion et parcours d'achat (maquettes Auth, Parcours Achat)

| Écran | Route | Verdict | Ce qui diffère | Pour |
| --- | --- | --- | --- | --- |
| Connexion | `/connexion` | aligné | 9 connexions sociales au lieu de 3 ; onglets renommés ; bandeau « 4 200 créatifs » absent (chiffre non tenu) ; « Rester connecté » décoché | lot 9 |
| Inscription | `/inscription` | **voulu** | le choix « Acheteur / Créateur » est retiré depuis le 09/10 — écrit dans `components/auth/auth-form.tsx:167` (aucun rôle n'existe ; on devient créateur en publiant). La maquette Halo le redessine encore | designer |
| Mot de passe oublié | `/mot-de-passe-oublie` | aligné | onglets ajoutés ; case « code par SMS » remplacée par une confirmation | — |
| Nouveau mot de passe, lien périmé | `/reinitialiser/[jeton]` | non capturé | demandent un jeton réel | — |
| Lien inconnu | `/reinitialiser/[jeton]` | aligné | — | — |
| Moyen de paiement | `/acheter/[slug]` | non capturé | sur ce poste, la page renvoie vers la fiche même pour un produit payant (mesuré ; la garde est `app/acheter/[slug]/page.tsx:66`, cause non vérifiée — sans doute aucun opérateur branché). La maquette nomme la route `/achat/nouveau` | à recapturer |
| Retour opérateur | `/achat/[orderId]` | non capturé | aucune commande en démo | — |
| Renouveler | `/abonnement/[id]/renouveler` | proche | le choix du moyen de paiement est remplacé par « aucun opérateur branché » — état de ce poste | à recapturer |
| Retour renouvellement | `/abonnement/[id]/paiement/[pid]` | non capturé | aucun paiement d'abonnement en démo | — |
| Notifications (forfait) | `/dashboard/forfait` | proche | bloc des relances en état « pas encore branché » | B12 |
| 404 | (toute adresse inconnue) | écart moyen | ni grand « 404 », ni médaillon baobab, ni pastilles de catégories, ni en-tête de site | à placer |

### Tableau de bord — la coque

- **Barre du haut** : la maquette a un champ « Rechercher dans mon espace… » ;
  l'application n'a que le bouton d'action. **Boutons d'en-tête** : une
  quinzaine d'écrans perdent le leur (« Exporter en CSV », « Comprendre le
  calcul », « Voir le journal », « Relire la file »…).
- **Sélecteur d'espace** : présent des deux côtés (l'app : Acheteur / Créateur
  pour un créateur, Acheteur / Super admin pour l'administration).
- **Trois pages acheteur partagées** : « Notifications », « Mes achats » et
  « Abonnement » sont dessinées *aussi* dans l'espace créateur ; l'app n'en a
  qu'un exemplaire, et un créateur qui les ouvre bascule sur le menu acheteur.
  Choix d'architecture à confirmer.
- **Onglets** : là où la maquette met des onglets en tête (Événements,
  Publicités, Blog, Notifications, Promotions), l'app met un bouton « Nouvel… »
  et un lien « ← Tous les… ».
- **Formulaires de création** : deux cartes à deux colonnes dans la maquette,
  une colonne pleine largeur dans l'app (article, événement, publicité).

### Tableau de bord — acheteur

| Écran | Route | Verdict | Ce qui diffère | Pour |
| --- | --- | --- | --- | --- |
| Aperçu | `/dashboard/apercu` | aligné, vide | — | — |
| Profil | `/dashboard/profil` | proche | l'app ajoute 4 cartes (double authentification, clés d'accès, téléphone, effacement) ; le mot de passe passe par un lien | — |
| Ma bibliothèque | `/dashboard/bibliotheque` | aligné, vide | — | — |
| Historique des achats | `/dashboard/achats` | écart moyen, vide | 3 chiffres ajoutés ; 3 filtres au lieu de 5 ; « Télécharger mes factures » absent | D3/D4, C3 |
| Historique des téléchargements | `/dashboard/telechargements` | proche, vide | 3 chiffres ajoutés | — |
| Éléments suivis | `/dashboard/suivis` | proche, vide | 2 chiffres ajoutés | — |
| Notifications | `/dashboard/notifications` | écart moyen, vide | onglets et filtres de la maquette remplacés par un bouton « Réglages » | D3/D4 |
| Notifications · réglages | `/dashboard/notifications/reglages` | écart moyen | 2 boutons par ligne (Courriel, Dans l'app) au lieu de 3 interrupteurs (dont Push « bientôt ») | D3/D4 |
| Mes collections | `/dashboard/collections` | écart moyen, vide | formulaire de création ouvert dans la page au lieu d'un bouton d'en-tête | D3/D4 |
| Abonnements | `/dashboard/abonnements` | proche, vide | 3 chiffres ajoutés | — |
| Forfait & pass | `/dashboard/forfait` | décision | grille des 4 forfaits ajoutée ; quota et résiliation absents | B3 |
| Devenir vendeur | `/dashboard/devenir-vendeur` | proche | bannière de progression ajoutée ; chiffres sous les étapes (88,5 % au lieu de 20 % de commission) | — |

### Tableau de bord — créateur

| Écran | Route | Verdict | Ce qui diffère | Pour |
| --- | --- | --- | --- | --- |
| Tableau de bord | `/dashboard` | aligné | titre « Bonjour Awa Diallo » ; « Ton prochain geste » | — |
| Produits | `/dashboard/produits` | aligné | filtre « Retirées » au lieu de « En modération » | — |
| Ajouter un produit | `/dashboard/produits/nouveau` | aligné | — | — |
| Gains | `/dashboard/gains` | proche | historique avant le graphique ; « Demander un versement » absent | D3/D4 |
| Commandes | `/dashboard/commandes` | aligné, vide | « Exporter en CSV » absent | D3/D4 |
| Ventes | `/dashboard/ventes` | **écart net** | la liste simple n'existe pas (voir plus haut) | D3/D4 |
| Remboursements | `/dashboard/ventes` | aligné, vide | — | — |
| Commissions | `/dashboard/commissions` | aligné, vide | « Comprendre le calcul » absent | — |
| Versements | `/dashboard/versements` | aligné | « Comptes remplacés » et « Voir l'historique » absents | — |
| Promotions (+ offres après achat) | `/dashboard/promos` | écart moyen | deux sections au lieu de deux onglets ; pas de liste des codes existants à vide | D3/D4 |
| Statistiques | `/dashboard/statistiques` | aligné, vide | « Exporter le rapport » absent | — |
| Profil de la boutique | `/dashboard/boutique` | aligné | l'app ajoute bannière, 14 réseaux, bouton « Contact » | — |
| Candidatures | `/dashboard/jobs/[id]/candidatures` | non capturé | aucune offre en démo — **et aucune entrée de menu** | D3/D4 |
| Mes dossiers | `/dashboard/mes-dossiers` | aligné, vide | **aucune entrée de menu** : la page s'ouvre, le menu surligne « Tableau de bord » | D3/D4 |
| Notifications, Mes achats, Abonnement | (pages acheteur) | écart de structure | voir « la coque » | décision |
| Créateur feedback | `/dashboard/avis` | aligné, vide | 3 chiffres ajoutés | — |

### Tableau de bord — administration

| Écran | Route | Verdict | Ce qui diffère | Pour |
| --- | --- | --- | --- | --- |
| File de modération | `/dashboard/moderation` | écart moyen, vide | ni chiffres, ni filtres, ni « Tout approuver » à vide | D3/D4 |
| Signalements & DMCA | `/dashboard/signalements` | aligné | l'app est plus riche — mais **pas d'entrée dans le menu d'administration** : la page s'ouvre avec le menu acheteur | D3/D4 |
| Remboursements à trancher | `/dashboard/remboursements-a-trancher` | aligné, vide | « Voir le journal » absent | — |
| Messages reçus | `/dashboard/messages-recus` | aligné, vide | — | — |
| Membres | `/dashboard/systeme/membres` | **écart net** | la vue n'existe pas (voir plus haut) | lot 6 |
| Décisions de risque | `/dashboard/systeme/membres` | aligné | bandeau de santé ajouté | — |
| Versements créateurs | `/dashboard/systeme/versements` | **écart net** | la vue n'existe pas (voir plus haut) | lot 6 |
| Système · Versements | `/dashboard/systeme/versements` | aligné, vide | — | — |
| Blog | `/dashboard/blog` | aligné, vide | bouton au lieu d'onglets | — |
| Blog · éditeur | `/dashboard/blog/nouveau` | écart moyen | une colonne au lieu de deux cartes | D3/D4 |
| Événements | `/dashboard/evenements` | aligné, vide | le fil d'Ariane dit « Organisation » dans l'espace Super admin | — |
| Événements · fiche, inscrits | `/dashboard/evenements/[id]…` | non capturé | aucun événement en démo | — |
| Événements · nouveau | `/dashboard/evenements/nouveau` | écart moyen | une colonne ; carte « Billets payants » absente | D3/D4 |
| Publicités | `/dashboard/publicites` | écart moyen, vide | carte « Diffusion » ajoutée ; chiffres et liste des campagnes absents à vide | D3/D4 |
| Publicités · détail | `/dashboard/publicites/[id]` | non capturé | aucune publicité en démo | — |
| Publicités · nouvelle | `/dashboard/publicites/nouvelle` | écart moyen | une colonne ; « Ce qui sera mesuré » absent ; aperçu ajouté | D3/D4 |
| Lettre d'information | `/dashboard/infolettre` | écart moyen, vide | chiffres en phrase au lieu de cartes ; formulaire en tête | D3/D4 |
| Témoignages | `/dashboard/temoignages` | aligné, vide | — | — |
| Système · Configuration | `/dashboard/systeme/configuration` | aligné | les lignes rouges sont l'état réel de ce poste | — |
| Système · Emails | `/dashboard/systeme/emails` | aligné, vide | — | — |
| Système · Paiements | `/dashboard/systeme/paiements` | aligné, vide | — | — |
| Système · Liste de blocage | `/dashboard/systeme/blocklist` | proche | formulaire « Poser un blocage » en tête au lieu d'en bas | — |

Menu d'administration : 15 entrées dans l'app contre 28 dessinées — les 13
absentes sont les écrans absents (lot 6 surtout) et « Signalements & DMCA ».

### Mobile (maquette Mobile, comparée à l'application à 360 px)

| Écran | Route | Verdict | Ce qui diffère | Pour |
| --- | --- | --- | --- | --- |
| 01 Lancement | — | hors écran | manifeste de l'application installée | D2 |
| 02 Connexion | `/connexion` | écart moyen | une seule connexion sociale dessinée, 9 empilées dans l'app (≈ 540 px de boutons) | D2 |
| 03 Accueil | `/` | **écart net** | en-tête compact, recherche, collection à la une, grille 2 colonnes, barre d'onglets — contre le bureau en une colonne | D2 |
| 04 Dashboard créateur | `/dashboard` | **écart net** | revenus et 4 tuiles d'emblée, bouton « + » flottant — contre le menu complet d'abord | D2 |
| 05 Paiement | `/acheter/[slug]` | non capturé | même redirection que « Moyen de paiement » | D2, à recapturer |
| 06 Profil & badges | `/dashboard/badges` | **écart net** | un écran de profil avec mérites en jetons ; l'app ouvre « Mes badges » derrière le menu acheteur | D2 |
| 07 Catalogue | `/explore` | **écart net** | recherche, sous-familles, tri, grille 2 colonnes avec bouton panier | D2 |
| 08 Fiche produit | `/products/[slug]` | **écart net** | image plein cadre, licences en boutons radio, barre d'achat fixe en bas ; la notion de *panier* n'existe pas dans l'app | D2, décision |
| 09 Mes produits | `/dashboard/produits` | **écart net** | onglets, cartes, bouton flottant — et la page de l'app **dépasse l'écran de 306 px** | D2 |
| 10 Statistiques | `/dashboard/statistiques` | **écart net** | périodes, revenus, par catégorie, top produits — contre le menu d'abord | D2 |
| Badges (planche) | `/dashboard/badges` | référence | la planche explique le système ; la page le traduit côté membre — cohérent | — |

---

## Mesures — toutes les pages, aux trois largeurs

Mesuré le 14/11/2026 par `pnpm design:captures` : 97 pages distinctes (une
même page vue par deux comptes compte deux fois), sur un build de production.

**Débordement horizontal — 2 pages, à 360 px seulement.** Deux témoins
indépendants concordent : la largeur de la page comparée à celle de l'écran, et
la largeur de l'image capturée.

| Page | Dépasse de | Ce qui dépasse | Pour |
| --- | --: | --- | --- |
| `/dashboard/produits` (créateur) | 306 px | les lignes du catalogue (608 px de large) | D2 |
| `/dashboard/forfait` | 168 px | la rangée « Relance J−7 · Rappel la veille · Relance J+2 · Confirmation » (461 px) | D2 |

Sur un téléphone, une page plus large que l'écran est **dézoomée en entier** :
tout devient minuscule, pas seulement la partie qui dépasse. Aucune page ne
déborde à 768 ni à 1440 px.

> La première mesure disait « 0 page sur 97 ». Elle comparait la page à
> `window.innerWidth`, que Chrome élargit justement quand il dézoome : la page
> se mesurait contre elle-même. C'est l'image capturée, deux fois plus large
> que l'écran, qui a trahi l'erreur. La mesure prend maintenant la largeur
> demandée, et le rapport garde la largeur de chaque image comme second témoin.

**Contenu coupé sans débordement — 7 pages.** Des conteneurs masquent ce qui
dépasse : sur l'accueil, un bandeau de 410 px dans 360 (le défilant
« CREATE. SHARE. »), voulu ; ailleurs, des pastilles et des champs rognés de
quelques pixels (`/explore`, `/createurs/[username]`, `/dashboard`,
`/dashboard/systeme/membres`, `/dashboard/statuts`, la fiche d'édition d'un
produit). À regarder un par un en D2.

**Cibles tactiles à 360 px — 1 260 sur 2 552 sous 44 px (49 %), dont 633 sous
24 px.** Les plus touchées : `/createurs` (76 sur 77), les réglages des
notifications (54 sur 67), l'accueil (49 sur 109), `/explore` (37 sur 66). Les
motifs qui reviennent : des liens hors phrase (menu, pied de page), le logo
(`a.logo-anime`, 38 px de haut, sur chaque page), des boutons en pastille. Le
seuil de 44 px est celui de D2 ; WCAG 2.5.8 n'exige que 24 px (avec
espacement), d'où le second chiffre.

**Champs de saisie à 360 px — 218 sur 218 sous 16 px**, sur 57 pages : de
12,5 à 15 px (la recherche de l'en-tête à 14 px, l'infolettre du pied de page
à 13 px, sur chaque page publique). Les pièges à robots (champs hors écran)
sont exclus. La règle Halo qui les porterait à 16 px sur écran tactile n'est
pas appliquée — D2.

---

## Décisions à prendre

| Question | Écrans concernés | Pour qui |
| --- | --- | --- |
| Le choix « Acheteur / Créateur » à l'inscription : la maquette le redessine, le code l'a retiré exprès (09/10). Mettre la maquette à jour ? | Inscription | designer |
| « À propos » et « Signalement DMCA » ont été construits bien au-delà de la fiche dessinée. Redessiner, ou revenir à la fiche ? | 2 pages | designer, responsable |
| « Mon compte » dans le site public (maquette) ou dans le tableau de bord (code) ? | Mon compte | responsable |
| Notifications, Mes achats, Abonnement : une page partagée (code) ou une page par espace (maquette) ? | 3 écrans créateur | responsable |
| Les gaps du site public (recherche d'Explorer, 404, Sponsoriser, Blogs) n'ont aucune ligne dans `TACHES.md`. En ouvrir une (« D5 — site public ») ? | 5 écrans | responsable |
| La notion de *panier* (mobile 08) : la maquette l'a, l'app achète à l'unité | Fiche produit mobile | responsable |

---

## Ce que la relecture a corrigé dans la table elle-même

La table des écrans a été écrite avant de regarder ; quatre associations
étaient fausses, toutes pour la même raison — **associer par le libellé du menu
plutôt que par le contenu**. La relecture côte à côte les a trouvées, la table
est corrigée et testée :

- « Remboursements » (créateur) dessine l'écran que l'app affiche sur
  `/dashboard/ventes`, pas sur `/dashboard/ventes/remboursements` ;
- « Décisions de risque » est `/dashboard/systeme/membres` (même titre), pas
  « absent » ;
- « Offres après achat » est une section de `/dashboard/promos`, pas « absent » ;
- deux écrans de réglages des notifications manquaient : ils sont définis
  ailleurs que dans les onglets, et c'est la carte du designer
  (`Baobart Design/github.md`) qui les a signalés.

---

## Rejouer ce relevé

```sh
docker compose up -d postgres
pnpm db:seed && pnpm db:seed:demo && pnpm comptes:test   # sur une base vide
pnpm build
APP_URL=http://localhost:3300 pnpm exec next start -p 3300
pnpm design:captures                         # ≈ 30 min ; puis captures-design/index.html
pnpm design:captures -- --sans-maquettes     # l'application seule, après un changement de code
pnpm design:captures -- --seulement=dashboard/c_   # quelques écrans, fondus dans le rapport
```

Sur un poste avec le jeu de démonstration complet (catalogue, commandes,
événements, MinIO), les 12 écrans « non capturés » et les listes vides se
rempliront : c'est la prochaine passe utile.
