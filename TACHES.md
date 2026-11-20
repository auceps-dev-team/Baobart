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
| Les défauts de la recette par personas (Q-11 à Q-44, promesses de la piste 1), L1, #64 | Claude (`auceps-dev-team`) | une PR par lot, empilées au-dessus de #65 | Commencé le 20/11, annoncé dans #61. | Chaque défaut remesuré avant, test rouge avant / vert après, CI verte. |

---

## 📋 À faire — dans l'ordre décidé

L'ordre vient des décisions du 04/11 (dix lots) et du 09/11 (le design passe
juste après le lot 4).

| # | Tâche | Contenu | Notes |
| :-: | --- | --- | --- |
| 1 | **Design — D2 mobile** | Les 10 écrans de `Baobart Mobile.dc.html`. | Cibles ≥ 44 px, champs ≥ 16 px, essai à 360 px. |
| 2 | **Design — D3/D4 Dashboard** | Aligner les ~20 écrans nouvellement dessinés (blog, événements, infolettre, publicités, remboursements, liste noire, témoignages, candidatures, dossiers, promos, réglages…). | La plupart des fonctionnalités existent : on aligne, on ne construit pas. |
| 3 | **Lot 5 — Abonnés du créateur** (A5) | La liste de ceux qui suivent, et le fil « Suivre les détails ». | Le compteur est juste depuis v1.105.1. |
| 4 | **Lot 6 — Pilotage de l'administration** (A4) | Vue d'ensemble, journal d'activité, réglages, taxonomie ; puis boutiques, catalogue, finances, abonnements. **Plus l'attribution de « VIP »** (décision du 09/11). | VIP : geste tracé à l'audit, avec motif, dessiné en jeton rond. |
| 5 | **Lot 8 — Pass All Access** (A6) | Un catalogue entier pour une durée fixe. | |
| 6 | **Lot 9 — Connexion sociale, import Figma / Canva / Framer** (A8, A9) | | 🧭 Le responsable du dépôt doit créer les identifiants chez chaque fournisseur. |
| 7 | **Lot 10 — Appels, café, commandes sur mesure** (A15) | Avec un échange enregistré sur la plateforme. | Débloque « Répond vite » (< 24 h) et les **avis sur les services**. |
| 8 | **Les 8 fonctionnalités que le plan repousse** | Affiliation (A11), infolettre du créateur (A12), soutien récurrent (A13), paiement en plusieurs fois (A14), équipes (A16), assistant IA (A17), produits physiques (A18), Shield couches 1, 3, 4 (A10). | Après les dix lots (décision du 04/11). |

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
| B10 — Concours | Ni dépôt d'œuvre, ni gagnant. |
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
| L1 — Exceptions `react-hooks` 7 (#65) | 11 `set-state-in-effect` désactivées à la ligne, chacune motivée : migrer les lectures du navigateur vers `useSyncExternalStore`, les réponses d'action vers un état dérivé au rendu. Et les 6 `window.location.href` internes (avertissements) vers `router.push`, si le rechargement complet n'est pas voulu. |

---

## 🧭 Décisions attendues

| Question | Ce qui en dépend |
| --- | --- |
| **Facturation** : forfaits payants (B3) et reçus / factures (C3) | Plusieurs écrans d'abonnement ; le mérite « Fidèle » (personne ne peut l'obtenir tant que seul le forfait gratuit est ouvert). |
| **Mises à jour majeures** : Next 16 (#46), Vitest 5 (#45) — `eslint-config-next` 16 réglé par #65 | Chacune est un lot à part, avec la suite complète et le navigateur. Ne pas les fusionner en même temps qu'autre chose. Avec Next 16 : retirer la garde `useEffectEvent` de `eslint.config.mjs`. Avec Prisma 7 : retirer le forçage d'`effect` (#63). |
| **JSON-LD sur les fiches** (note des avis pour Google) | La règle du dépôt n'autorise qu'**un** `dangerouslySetInnerHTML` (le blog). Un second se décide, il ne s'ajoute pas en passant. Lot C2. |
| **Canal direct vers Gemini** (`agy -p`, outil `confier-a-gemini.sh` hors dépôt) | Pour qu'Argon écrive et teste sans intervention : une liste d'autorisations dans les réglages globaux d'Antigravity (proposée, non appliquée) et des crédits Argon (épuisés le 13/11). La lecture seule marche déjà. |
| **Textes de loi sur les avis** (lois 2016-412 et 91-1000) | Lus par un juriste avant d'afficher les notes en production. |

---

## ✅ Fait — les plus récents

| Version | PR | Ce qui est livré |
| --- | --- | --- |
| v1.111.0 | #67 | **Lot 7 — Certificat de licence** (A7), écrit par Argon, relu et reporté sur `main` : « Licence » dans la bibliothèque ouvre `/dashboard/bibliotheque/certificat/<ligne>`, imprimable (le menu disparaît à l’impression), RÉVOQUÉ avec son motif après un remboursement intégral, une contestation ou un retrait d’accès. Refusé (404) à tout autre compte, prouvé par mutation. Sans QR ni empreinte : écart assumé avec `SPEC_LICENCES` §3. |
| v1.108.7 | #65 | `eslint-config-next` 16 sans `FlatCompat` (remplace #47) : la configuration « flat » étalée telle quelle, six paquets devenus inutiles retirés, 86 règles actives au lieu de 71, aucune perdue (mesuré, sentinelles attrapées). Un vrai défaut trouvé par `react-hooks/immutability` : Échap dans la fenêtre d'épingle annonçait « rangée nulle part » et le bouton repassait à « Collection » (`e2e/collections.spec.ts`, rouge avant). Garde `no-restricted-imports` sur `useEffectEvent`, absent du React de Next 15.5. |
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
