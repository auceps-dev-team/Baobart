# Tâches — Baobart

> **La source unique de ce qui est fait, en cours et à faire.** Toute personne
> (ou session Claude, ou agent) qui travaille sur le dépôt lit ce fichier avant
> de commencer, et le met à jour **dans sa propre PR**.
>
> Relevé le **13/11/2026** au soir, après la fusion des PR #48, #50, #39 et #51 (v1.107.0), la liste des
> PR GitHub et les copies de travail en cours. Les identifiants A1…C10 renvoient
> à l'inventaire `Doc/INVENTAIRE_FONCTIONNALITES_2026-11.md` (PR #39).

---

## Comment s'en servir

1. **Prendre une tâche.** Choisir la première ligne « À faire » libre (ou celle
   qu'on t'a confiée). Partir de `origin/main` à jour, sur une branche
   `prenom/sujet` (les agents : `claude/…`, `gemini/…`). Premier commit :
   déplacer la ligne dans « En cours », avec ton nom, ta branche et la date.
   Ouvrir **tout de suite** une PR en brouillon : c'est elle qui dit aux autres
   que la tâche est prise.
2. **Avant d'écrire du code : la fiche.** Les quatre questions (voir
   `CLAUDE.md`, « Avant chaque tâche ») répondues dans la description de la PR.
   Chaque réponse devient une case de la liste de contrôle de la PR.
3. **Une tâche = une PR.** Une tâche trop grosse se coupe en lignes ici d'abord.
4. **Finir.** CI verte, la preuve du critère de fin jointe à la PR, la ligne
   passée dans « Fait » avec le numéro de PR et la version. **Son auteur la
   fusionne** s'il a le droit d'écriture (voir `CLAUDE.md`, « Qui fusionne ») ;
   un agent attend la demande du responsable. Personne ne pousse sur `main` :
   la protection de la branche l'impose.
5. **Bloqué ?** La ligne passe dans « Décisions attendues », avec la question
   posée. On ne contourne pas une décision en silence.
6. **Deux personnes ne prennent jamais la même ligne.** En cas de doute, demander
   dans la PR brouillon de l'autre.

Légende : ⏳ en cours · 📋 à faire · 🧭 décision attendue · ✅ fait

---

## ⏳ En cours

| Tâche | Qui | Branche | Où on en est (relevé le 13/11) | Critère de fin — la preuve |
| --- | --- | --- | --- | --- |
| Les défauts de la recette par personas (Q-11 à Q-44, promesses de la piste 1), L1, #64 | Claude (`auceps-dev-team`) | une PR par lot, empilées au-dessus de #65 | Commencé le 20/11, annoncé dans #61. Décisions du 21/11 : Q-39 et Q-41 (1.114.9), puis les filtres de « Ventes », puis Q-30 sur toutes les pages — empilés au-dessus de #82. | Chaque défaut remesuré avant, test rouge avant / vert après, CI verte. |
| **Lot 5b — Suivre les détails** (A5, page `c_suivre`) : le fil des créateurs suivis (« X a publié… », NOUVEAU / VU), les trois compteurs, abonnés et abonnements, l'entrée du menu créateur | Claude (`aucepsdev`) | `claude/suivre` | Commencé le 24/11, annoncé dans #61. Une date de première publication sur `Product`, posée par un déclencheur SQL. | Un test d'intégration par chemin de publication (rouge puis vert), tests navigateur et axe, CI verte, relecture par l'autre session. |

---

## 📋 À faire — dans l'ordre décidé

L'ordre vient des décisions du 04/11 (dix lots) et du 09/11 (le design passe
juste après le lot 4).

| # | Tâche | Contenu | Notes |
| :-: | --- | --- | --- |
| 1 | **Design — D2b mobile, les écrans dessinés** | Les écrans de `Baobart Mobile.dc.html` que l'application n'a pas : accueil en deux colonnes avec barre d'onglets, catalogue, fiche avec barre d'achat fixe, tableau de bord créateur, « Mes produits » en cartes, statistiques, profil et badges, connexion (D1b, « Mobile »). | Coupé du D2 le 20/11. Après D2a. Première tranche (en-tête, barre d'onglets) : #70. 🧭 Le panier (écran 08) attend le responsable. Statistiques (10) et Badges (06), dont les maquettes mobile et bureau ne dessinent pas le même contenu (Statistiques : l'audience au bureau, `c_stats` l. 1735, l'argent au téléphone ; Badges : « Mes badges » au bureau, un profil au téléphone) : **décidé le 21/11 par le responsable, voie (b)** — le contenu du bureau, avec la mise en forme de la maquette mobile (relayé dans #61, message de 11 h 07). L'accueil, l'en-tête, la fiche, « Mes produits » et l'accueil créateur sont dans `main` (pile #74 à #80) : la voie est libre. |
| 2 | **Design — D3/D4 Dashboard** | Aligner les ~20 écrans nouvellement dessinés (blog, événements, infolettre, publicités, remboursements, liste noire, témoignages, candidatures, dossiers, promos, réglages…). | La plupart des fonctionnalités existent : on aligne, on ne construit pas. |
| 3 | **Lot 6 — Pilotage de l'administration** (A4) | Vue d'ensemble, journal d'activité, réglages, taxonomie ; puis boutiques, catalogue, finances, abonnements. **Plus l'attribution de « VIP »** (décision du 09/11). | VIP : geste tracé à l'audit, avec motif, dessiné en jeton rond. |
| 4 | **Lot 8 — Pass All Access** (A6) | Un catalogue entier pour une durée fixe. | |
| 5 | **Lot 9 — Connexion sociale, import Figma / Canva / Framer** (A8, A9) | | 🧭 Le responsable du dépôt doit créer les identifiants chez chaque fournisseur. |
| 6 | **Lot 10 — Appels, café, commandes sur mesure** (A15) | Avec un échange enregistré sur la plateforme. | Débloque « Répond vite » (< 24 h) et les **avis sur les services**. |
| 7 | **Les 8 fonctionnalités que le plan repousse** | Affiliation (A11), infolettre du créateur (A12), soutien récurrent (A13), paiement en plusieurs fois (A14), équipes (A16), assistant IA (A17), produits physiques (A18), Shield couches 1, 3, 4 (A10). | Après les dix lots (décision du 04/11). |

**Ensuite, les raccords et les partielles** (inventaire §3 et §4), sans ordre
décidé — à placer avec le responsable du dépôt :

| Tâche | Contenu |
| --- | --- |
| B2 / C10 — Sélection éditoriale | Choisir les ressources « à la une » (aujourd'hui figées sur le seed). |
| B4 — Licence étendue | Le supplément de prix n'est jamais facturé. |
| B5 — Niveau Shield | Choisi par le créateur, lu par personne. |
| B6 — Catégories du blog | Toujours vides. |
| B7 — Vues des fiches | Jamais comptées. |
| B9 — Champs personnalisés | Le vendeur ne voit pas les réponses. |
| B10 — Concours | Ni dépôt d'œuvre, ni gagnant. **Q-14** (recette) : après « M'inscrire », ni consigne, ni dépôt, ni courriel de confirmation. **Confié à aucepsdev le 21/11** ; la vérification revient à Claude, sur des critères écrits d'avance dans #61. |
| B11 — Menu de compte | « Règles de publication » et « Support » affichés « bientôt » alors que les pages existent. |
| B12 — Notifications push | Clés VAPID absentes ; « téléchargement prêt » jamais émis. |
| B13 — Recherche des écrans d'administration | Réparée sur « Statuts » seulement. |
| C1 — Aperçus | Audio, PDF, 3D, polices, archives. |
| C2 — Conformité et SEO (mission 3) | Pages légales modifiables par l'administration, mentions légales, `openGraph` / `canonical`. |
| C4 — Litiges | Flutterwave ; un écran d'administration des litiges. |
| C5 — Wave | Absent des moyens Mobile Money. |
| C6 — Pages catégorie | Une page par catégorie, utile au référencement. |
| C7 — Devises | Conversion entre devises. |
| C8 — Tâches de fond auto-hébergées | `JOBS_DRIVER` déclaré sans lecteur. |
| L1 — Exceptions `react-hooks` 7 (#65) | 3 sur 11 migrées le 21/11 (partage : `useSyncExternalStore` ; recherche de l'en-tête : état déduit au rendu). Les 8 autres restent, chacune motivée à sa ligne : animations, réponses d'action serveur (dont la saisie gardée de #59), service worker, consentement. Les 6 `window.location.href` internes (avertissements) restent aussi. |
| Q-30 — le contraste sur toutes les pages (décidé le 21/11) | 0 texte sous 4,5:1 sur les 7 pages de la recette (axe, #77) ; le relevé Halo (#66) en comptait 799 sur 41 pages, dont 380 sur `systeme/membres` et `statuts`. Mesurer toutes les pages, listes remplies, puis corriger à la source (la charte). **Claude.** |
| Q-28 — les courriels en HTML (décidé le 21/11) | Le texte brut reste ; une version mise en forme s'ajoute, chaque valeur échappée. **Confié à aucepsdev** ; les contraintes du dépôt sont dans #61. |

---

## 🧭 Décisions attendues

| Question | Ce qui en dépend |
| --- | --- |
| **Facturation** : forfaits payants (B3) et reçus / factures (C3) | Plusieurs écrans d'abonnement ; le mérite « Fidèle » (personne ne peut l'obtenir tant que seul le forfait gratuit est ouvert). |
| **Mises à jour majeures** : Next 16 (#46), Vitest 5 (#45) — `eslint-config-next` 16 réglé par #65 | Chacune est un lot à part, avec la suite complète et le navigateur. Ne pas les fusionner en même temps qu'autre chose. Avec Next 16 : retirer la garde `useEffectEvent` de `eslint.config.mjs`. Avec Prisma 7 : retirer le forçage d'`effect` (#63). |
| **JSON-LD sur les fiches** (note des avis pour Google) | La règle du dépôt n'autorise qu'**un** `dangerouslySetInnerHTML` (le blog). Un second se décide, il ne s'ajoute pas en passant. Lot C2. |
| **Canal direct vers Gemini** (`agy -p`, outil `confier-a-gemini.sh` hors dépôt) | Pour qu'Argon écrive et teste sans intervention : une liste d'autorisations dans les réglages globaux d'Antigravity (proposée, non appliquée) et des crédits Argon (épuisés le 13/11). La lecture seule marche déjà. |
| **Textes de loi sur les avis** (lois 2016-412 et 91-1000) | Lus par un juriste avant d'afficher les notes en production. |
| **Base de développement** | Sans `_prisma_migrations`, elle ne prend pas les migrations, et rien ne signale son retard. **Rattrapée le 21/11** : il lui manquait `20261120200000_rembourse_par_equipe` (#76) **et** `20261109100000_avis_notes` (v1.106.0, 13/11). L'écart se mesure en lecture seule — `prisma migrate diff --from-url <base de dev> --to-schema-datamodel prisma/schema.prisma --script`, vide après rattrapage — et se comble en appliquant le **fichier** de migration (`psql --single-transaction`), pas l'écart calculé, qui ne voit pas les `CHECK`. À refaire après chaque fusion qui porte une migration ; la vraie décision reste de lui rendre un historique (`prisma migrate resolve --applied`, migration par migration). |

---

## ✅ Fait — les plus récents

| Version | PR | Ce qui est livré |
| --- | --- | --- |
| v1.115.0 | #81 | Lot 5a, la liste des abonnés (A5, maquette `c_abonnes`) : `/dashboard/abonnes`, en cartes de personnes comme la maquette, paginée **en base** (le total d'abord, puis `skip`/`take` sur un ordre total) — `createursSuivis` lit 200 lignes puis découpe, ce qui aurait caché tout abonné au-delà. D'un abonné, son nom ; le reste (spécialité, ville, photo) seulement si sa vitrine le montre déjà, et « Message » seulement si elle est ouverte aux messages : il ouvre la fenêtre de contact (`#contact`). La notification « Nouvel abonné » mène à la liste, plus à la boutique ; la page de confidentialité dit ce que voit le créateur suivi. Écarts écrits : pas de « Publier une actu » (infolettre du créateur, A12, non construite) ; la maquette ne met la page ni au menu ni dans `SUB_PARENT`. Taille de page calculée, pas mesurée à l'écran : la mesure est celle du test « la page s'arrête avec le menu ». Et, décidé le 21/11 par le responsable : **« Nouvel abonné » nomme la personne** (son nom affiché, jamais son adresse), en cloche et en courriel — l'effacement du suiveur retire ces avis chez chaque créateur, par le préfixe de leur clé. Trouvés en l'écrivant, mesurés rouges puis verts : l'effacement laissait les courriels adressés à la personne effacée (en attente : ils seraient partis), et ne recomptait pas les compteurs de suivi des autres (2 au lieu de 1). |
| v1.114.10 | #84 | « Ventes » — des filtres qui filtrent (décidé le 21/11) : la recherche passe par l'adresse (`?q=`) et par la base — ressource, acheteur (nom ou adresse), référence, sans tenir compte de la casse —, et les états comme les pages la gardent. Mesuré le 21/11 : le champ n'avait ni nom ni formulaire, et l'écran ne lisait que les **soixante dernières ventes**, sans le dire ; il en lit 500 et le dit au-delà (`lireVentesPourLEcran`, `PLAFOND_VENTES`). `e2e/ventes-filtres.spec.ts`. |
| v1.114.9 | #83 | Les deux décisions d'argent du 21/11. **Q-41** : un remboursement fait entre la fin de période et le cycle est déduit de ce versement-là (mesuré à la recette : 3 673 F préparés, 873 F réels) ; les soldes négatifs postérieurs sont pris, jusqu'à la veille du cycle — jamais le jour même, qu'un versement figerait. Une seule règle (`filtreSoldesAVerser`) pour le versement, la décision du cycle et l'écran « Gains ». **Q-39** : au huitième jour sans réponse, le créateur apprend que la demande passe à l'équipe, et l'équipe (les rôles qui tranchent) qu'elle l'attend — cloche et courriel, une fois, par la tâche de nuit des commandes ; l'acheteur lit « Transmise à l'équipe ». Migration `demandes_a_l_equipe`. **Décidé le 21/11 : la cadence reste mensuelle** — le code et les textes de #74 le disent déjà. |
| v1.114.8 | #82 | `pnpm comptes:test` ne pose plus ses quatre comptes (mot de passe connu, administrateur compris) sur une base distante : sa garde cherchait « localhost » ou « baobart_test » n'importe où dans l'adresse. Mesuré le 21/11 : `…@localhost.exemple.invalid/db` et `…@base.exemple.invalid/baobart_test` passaient la garde et tentaient de se connecter ; elles sont refusées, et une base de ce poste (`localhost`, `127.0.0.1`) passe toujours. La garde lit l'hôte, et lui seul (`baseLocale`, la règle des scripts de design depuis #60). Après #78 (1.114.7). |
| v1.114.7 | #78 | Le graphique « par mois » au téléphone (trouvé en ouvrant la deuxième tranche de D2b) : sous 900 px, la règle globale de `globals.css` ramenait sa grille à une colonne — six rangées au lieu d'une, qui recouvraient la carte suivante sur l'accueil créateur, l'Aperçu et Statistiques. Le composant passe en `flex`. Et sous 620 px, ses barres perdent montant et mois, remplacés par le premier et le dernier mois sous le graphique, comme dans la maquette mobile (écrans 04 et 10) : « 1 234,6k » faisait 51 px dans une colonne de 31 (mesuré ici), « sept. » 36 px dans 30 à 320 px (mesuré en CI, aux polices plus larges). `e2e/mobile.spec.ts`, à 360 et 320 px avec six mois de ventes, rouge avant / vert après ; le bureau garde montants et mois. |
| v1.114.6 | #80 | L1 : 3 des 11 exceptions `set-state-in-effect` de #65 migrées — l'origine et le partage natif lus par `useSyncExternalStore` (`components/systeme/navigateur.ts`), l'état de la recherche de l'en-tête déduit au rendu. Les 8 autres restent, motivées. Et les décisions ouvertes par la recette, consignées ci-dessus. |
| v1.114.5 | #79 | La recherche de l'en-tête (Q-12) : la vignette de la couverture, les créateurs trouvés par leur nom ou leur pseudo (vitrine publiée, compte ouvert), Entrée ouvre la première suggestion. « Aucun résultat » existait déjà (depuis le 02/10, mesuré) : gardé par un test. |
| v1.114.4 | #77 | Se repérer (recette) : le fuseau des événements écrit, « heure d'Abidjan (GMT) » (Q-15) ; Explorer a un repère `main` et un titre de niveau 1, la fiche un `h1`, la fenêtre et la communauté donnent leur titre à l'onglet, le menu du compte s'ouvre au clavier (Q-29) ; plus aucun texte sous 4,5:1 sur les 7 pages de la recette, mesuré par axe (Q-30 : orange sombre en texte, encre sur orange, opacités à 72 %). Restent les autres pages du relevé Halo (799 nœuds sur 41 pages), dont l'administration. |
| v1.114.3 | #76 | L'argent dit la même chose partout (recette) : « Solde à verser » lit gainsDe, comme Gains, et dit ce qui est encore retenu (Q-31) ; le créateur prévenu, cloche et courriel, quand l'équipe rembourse à sa place (Q-40, migration `REMBOURSE_PAR_EQUIPE`) ; « crédités aux créateurs » net des remboursements (piste 1) ; l'historique dit « ACCÈS CLOS » au lieu d'un « Télécharger » qui menait à une 403 (piste 1) ; la bienvenue mène au site (Q-28). |
| v1.114.2 | #75 | Le vendeur (recette, mineurs) : le délai de remboursement montré à la publication (Q-21) ; un numéro mobile sans indicatif demande son pays, clavier téléphone, refus effacé à la correction (Q-22) ; toutes les erreurs d'un envoi, pas de publication sans description, fichiers annoncés « à l'étape suivante », « dépose » au lieu de « glisse » (Q-23) ; https:// complété pour le lien de fichier et le portfolio (Q-24) ; « Du même créateur » légendé (Q-25) ; où coller le lien du portfolio (Q-27) ; le pays du profil dans une liste de 70 pays (Q-32). |
| v1.114.1 | #74 | Les textes de la recette : accords (« 1 ressource », Q-34, `lib/i18n/accord.ts`) ; « Paiement simulé » au lieu de « traité par aucun » (Q-35) ; états de vente accentués, « Avis & commentaires », « Administration », règles et support enfin liés (Q-36) ; les trois conditions d'un service écrites (Q-20) ; pas de « Rien pour l'instant » sous un article seul (Q-33) ; la cadence mensuelle paie au dernier jour, pas au premier (Q-42) ; « chaque mois par défaut » au lieu de « chaque semaine » sur six écrans, « toutes les ressources offertes, sans limite », « Vends en Afrique de l'Ouest », « bientôt, avec » (piste 1). |
| v1.114.0 | #60 | Les listes du tableau de bord paginées sous le menu (demande du 14/11) : dix listes dont la taille de page est mesurée à 1440 × 900 sur des listes pleines (`pnpm design:remplir-listes`) ; « Ventes » replie sa légende et montre une vente par page. Remesuré le 21/11 sur `main` 1.113.3 : la liste finit au-dessus du menu sur les dix, la page entière sur huit (Promotions et Ventes : une section suit la liste). La mesure du menu descend désormais dans `display: contents` (l'enveloppe de `RepliMobile`, D2a) : sans cela, elle le croyait à 900 px pour 1 042, et signalait quatre débordements qui n'existaient pas ; une garde l'empêche de revenir. Les scripts qui écrivent en base lisent l'hôte de l'adresse (`baseLocale`), plus « localhost » n'importe où. Restent hors d'atteinte sans redessin : Statuts, Membres. Un test au navigateur garde la règle. |
| v1.113.3 | #72 | #64, le test instable de la file des courriels (« 9 au lieu de 10 », 6 CI rouges depuis le 04/11) : cause mesurée — `nextAttemptAt` posé par l'horloge du moteur de Prisma (`@default(now())`), jusqu'à 8 ms en avance sur le `new Date()` de `reclamer` ; `deposer` le pose désormais avec l'horloge du processus. Ancien code 6 échecs sur 27, corrigé 0 sur 23. |
| v1.113.2 | #71 | Navigation et compte (recette, mineurs) : Échap ne ferme plus la fiche sous la fenêtre d'épingle (Q-11) ; plus d'erreur serveur depuis la page introuvable (Q-13, créneau `@modal/[...rien]`) ; « Se déconnecter » dans le menu du tableau de bord (Q-16) ; la case de « Mot de passe oublié » est exigée (Q-17) ; 25 pages renvoient à la connexion avec la page demandée (Q-18, `connexionPuis`, garde-fou) ; « Mes offres » pour le recruteur (Q-26, `/jobs/mes-offres`). `e2e/navigation-compte.spec.ts`. |
| v1.113.1 | #68 | Q-43 et Q-44 (recette, piste 5) : avec la traduction automatique du navigateur, « J'aime » et « Suivre » ne font plus tomber la page, et le compteur de la mosaïque suit le filtre. Chaque texte qui change vit dans son élément ; un filet (`components/systeme/garde-traduction.tsx`) couvre les composants que personne n'a joués traduits — mesuré : il tient seul sur l'ancien composant. `e2e/traduction.spec.ts`, avec le traducteur simulé de la recette. |
| v1.113.0 | #67 | **Lot 7 — Certificat de licence** (A7), écrit par Argon, relu et reporté sur `main` : « Licence » dans la bibliothèque ouvre `/dashboard/bibliotheque/certificat/<ligne>`, imprimable (le menu disparaît à l’impression), RÉVOQUÉ avec son motif après un remboursement intégral, une contestation ou un retrait d’accès. Refusé (404) à tout autre compte, prouvé par mutation. Sans QR ni empreinte : écart assumé avec `SPEC_LICENCES` §3. |
| v1.112.1 | #65 | `eslint-config-next` 16 sans `FlatCompat` (remplace #47) : la configuration « flat » étalée telle quelle, six paquets devenus inutiles retirés, 86 règles actives au lieu de 71, aucune perdue (mesuré, sentinelles attrapées). Un vrai défaut trouvé par `react-hooks/immutability` : Échap dans la fenêtre d'épingle annonçait « rangée nulle part » et le bouton repassait à « Collection » (`e2e/collections.spec.ts`, rouge avant). Garde `no-restricted-imports` sur `useEffectEvent`, absent du React de Next 15.5. |
| v1.112.0 | #70 | D2b, première tranche : sous 620 px, l'en-tête et la barre d'onglets de `Baobart Mobile.dc.html` (écrans 03 et 04). L'en-tête tient en deux lignes (logo et cloche, puis la recherche) : 112 px à 320, 360 et 390 px, contre environ 330 ; les menus et le compte passent derrière « Menu » (ajout hors maquette : Q-03). La barre d'onglets (Accueil, Explorer, Achats, Atelier, Profil, icônes Halo de #56) suit les écrans que la maquette dessine avec elle, pas la connexion, le paiement ni la fiche. Gardé par `e2e/mobile.spec.ts` ; Q-03 reste vert. Posée sur #69 et #56. Reste de D2b : l'accueil, le catalogue, la fiche (barre d'achat), le tableau de bord mobile. |
| v1.108.12 | #69 | D2a, le mobile utilisable (Q-03, Q-04) : au doigt, le premier toucher ouvre un sous-menu de l'en-tête (Jobs, Services, Concours… n'étaient atteignables que par leur adresse) ; sous 980 px, le menu du tableau de bord se replie derrière « Menu de l'espace » (le titre commençait à 982 px pour 740) ; la fiche montre le prix avant la discussion ; plus aucun débordement à 320 px dans le tableau de bord (8 pages avant, mesuré par `pnpm design:revue`). Gardé par `e2e/qa-personas.spec.ts` (Q-03, Q-04, sans `defautOuvert`) et `e2e/mobile.spec.ts`. Posée sur #66. Reste D2b : les écrans dessinés, dont l'en-tête compact. |
| v1.108.11 | #66 | La revue de chaque vue avec les skills Halo (demande du 14/11) : les 12 skills lus, 9 appliqués, inventaire dans `Doc/REVUE_SKILLS_HALO_2026-11.md`. Mesuré sur 98 routes (`pnpm design:revue`, et `design:pire-cas` pour break-ui) : survols au doigt 5 → 0, champs sous 16 px 218 → 0, boucle sous mouvement réduit 1 → 0, axe `label` 3 → 0 ; pages qui débordent à 320 px avec le pire cas 15 → 7. Gardé par `lib/systeme/mouvement.test.ts`, `e2e/mouvement.spec.ts`, `e2e/pire-cas.spec.ts`. Restent : 8 décisions (rail, curseur, durées, titre sans borne…), les 7 débordements du tableau de bord (D2), le contraste (Q-30). |
| v1.109.0 | #56 | Les icônes Halo à la place des glyphes : 71 entrées de menu (tableau de bord, site, rail), 18 médaillons et coches, 8 pastilles « ! » / « i », les pictogrammes des cartes et les étoiles de note. 176 symboles avant, 90 après — tous dans la liste de ce qui reste, figée par un test-cliquet. Part de #52. |
| v1.108.6 | #63 | Trois défauts de la recette par personas corrigés, chacun gardé par son test de `e2e/qa-personas.spec.ts` sans enveloppe : l'inscription compte cinq **comptes** par heure, plus une enveloppe de trente envois, et une faute de frappe ne ferme plus la porte (Q-01) ; la fiche d'une ressource retirée se rouvre à celui qui l'a obtenue, et à lui seul (Q-37, `lib/products/fiche-retiree.integration.test.ts`) ; la collection partagée s'ouvre depuis sa communauté (Q-06). Restent Q-03 et Q-04 (avec D2), Q-39 et Q-41 (décisions), Q-44. Plus quatre avis publiés le 20/11, qui bloquaient toutes les PR : `next` 15.5.29, et `effect` forcé à 3.22.4 dans `pnpm.overrides` (Prisma 6 le fige à 3.21.0), **à retirer au passage à Prisma 7**. |
| v1.108.3 | #59 | Sept défauts de la recette par personas corrigés, chacun gardé par son test de `e2e/qa-personas.spec.ts` : la saisie n'est plus perdue après un refus (Q-02, Q-05, Q-38), le refus du profil vient sous les yeux (Q-07), « Rembourser » se confirme (Q-08, Q-40), « Payer » annonce le bon montant (Q-09), un code promo refusé ne part plus (Q-10). Restent Q-01, Q-03, Q-04, Q-06, Q-37. |
| — (tests, docs) | #58 | Les défauts de la recette par personas en tests au navigateur (`e2e/qa-personas.spec.ts`) : 11 défauts (Q-02 à Q-10, Q-37, Q-38), verts tant qu'ils existent, rouges un par un avec `QA_DEFAUTS_STRICTS=1` ; Q-01 écrit, désactivé. Avec la suite de la recette (`Doc/QA_PERSONAS_2026-11-14-suite.md`, Q-37 à Q-44), la régie, et le mode d'emploi pour l'admin (`Doc/QA_PERSONAS_2026-11-14/REJOUER.md`). CI verte le 15/11 (navigateur : 43 verts, 1 désactivé). Restent : le rejeu par l'admin ; Q-01 et Q-39 à Q-44, non automatisés. |
| v1.108.2 | #57 | Deux correctifs nés de la recette par personas du 14/11 (`Doc/QA_PERSONAS_2026-11-14.md`, versée avec) : une ressource offerte téléchargée se note (Q-19, v1.108.1) ; le fil d'une communauté trie de façon stable (v1.108.2). Restent les autres défauts de la recette, à traiter par familles. |
| — (docs, outillage) | #54 | D1b — l'inventaire des écarts maquettes ↔ écrans (`Doc/DESIGN_ECARTS_2026-11.md`) : 118 écrans relevés dans le source des maquettes, chacun associé à sa route ; 89 regardés côte à côte ; mesures à 360 / 768 / 1440 px sur 97 pages (2 débordent à 360, 49 % des cibles sous 44 px, aucun champ à 16 px). `pnpm design:captures` les rejoue. Part de #52. |
| v1.108.0 | #52, par #54 | D1 — fondations du design « Halo » : la livraison versée dans `Baobart Design/`, les 49 icônes en composant React sans `innerHTML`, le geste de pression (140 ms, 97 %) dans `sticker-press`. Écrit par aucepsdev, relu par Claude ; entré dans `main` avec #54, qui contient ses commits. |
| v1.107.1 | #49 | B14 — aucune page publique ne publie plus l'adresse d'un compte sans profil : les 9 lectures publiques (emplois, services, blog, événements, forum) ne la chargent plus ; « Membre Baobart » en repli. Le test échoue 6/6 sur l'ancien code et passe 6/6 sur le nouveau. |
| — (tests) | #53 | Lot 3 au navigateur : Playwright + axe dans les trois états de « Devenir vendeur ». Écrit par Argon par le canal direct (sans copier-coller), lancé et éprouvé par Claude (trois casses attrapées). |
| v1.107.0 | #51 | Lot 3 — « Devenir vendeur » : trois étapes vers la boutique (profil affichable comme la vitrine, compte de versement après 24 h, trois ressources) ; `/dashboard/boutique` ouvert à l'acheteur (option A). Écrit par Argon, relu par Claude. |
| — (docs) | #39 | L'inventaire fonctionnalité par fonctionnalité (`Doc/INVENTAIRE_FONCTIONNALITES_2026-11.md`), auquel renvoient les identifiants A1…C10. |
| v1.106.0 | #50 | Lot 4 — les avis notés : qui note, recompte à chaque mouvement d'argent, section « Avis » de la fiche, « Avis & commentaires », balayage nocturne, effacement RGPD des avis. |
| — (docs) | #48 | Ce fichier, les règles communes en tête du `CLAUDE.md`, `Doc/PROCESS_COLLABORATEURS.md` à coller, la section « Contribuer » du README. |
| v1.105.1 | #42 | Les trois défauts trouvés par la relecture d'Argon sur de vrais comptes (contraste en sommeil, « Fidèle », ventes à vie et abonnés de la vitrine). |
| v1.105.0 | #41 | Lot 2 — les vingt mérites, « Mes badges », les deux rangées du profil, l'écusson des vignettes ; « Créateur du mois » et son passage quotidien. |
| v1.104.0 | #40 | Lot 1 — l'administration accorde et retire les statuts ; la publication de services se rouvre. |
| v1.103.3 | #38 | L'en-tête ne recharge plus la page ; les écrans vendeur se ferment à l'acheteur. |
| v1.103.2 | #37 | Les contestations bancaires atteignent le grand livre. |
| v1.103.1 | #36 | Le numéro Mobile Money atteint Flutterwave. |
| v1.103.0 | #33 | « Ma bibliothèque ». |
| v1.102.8 | #32 | Un remboursement partiel rend le montant saisi. |

Plus ancien : `git log --oneline main`.
