# Tâches — Baobart

> **La source unique de ce qui est fait, en cours et à faire.** Toute personne
> (ou session Claude, ou agent) qui travaille sur le dépôt lit ce fichier avant
> de commencer, et le met à jour **dans sa propre PR**.
>
> Relevé le **13/11/2026** sur `origin/main` (`226ecab`, v1.105.1), la liste des
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
   passée dans « Fait » avec le numéro de PR et la version. **Seul le
   responsable du dépôt fusionne.** Personne ne pousse sur `main`.
5. **Bloqué ?** La ligne passe dans « Décisions attendues », avec la question
   posée. On ne contourne pas une décision en silence.
6. **Deux personnes ne prennent jamais la même ligne.** En cas de doute, demander
   dans la PR brouillon de l'autre.

Légende : ⏳ en cours · 📋 à faire · 🧭 décision attendue · ✅ fait

---

## ⏳ En cours

| Tâche | Qui | Branche | Où on en est (relevé le 13/11) | Critère de fin — la preuve |
| --- | --- | --- | --- | --- |
| **Lot 3 — « Devenir vendeur »** (A2) | Argon (Gemini) | `gemini/devenir-vendeur` (non poussée) | Rebasée sur `226ecab`. Mission 3 bis en cours : règle d'affichage partagée (`lib/reseaux/vitrine.ts`), délai de 24 h au lieu de `verifiedAt`, `/dashboard/boutique` ouvert à l'acheteur (option A), axe et fast-check. | CI verte ; axe sans violation dans les trois états ; chaque nouveau test échoue d'abord sur l'ancien code ; relecture par Claude. |
| **Lot 4 — Avis notés** (A3) | Claude | `claude/avis` (non poussée) | Fait : schéma et migration, règles et recompte, crochets sur remboursement / litige / accès, « Bien noté » et « Bon public » mesurables, section « Avis » de la fiche, courriels ; 13 tests d'intégration verts, dont deux casses volontaires attrapées. Reste : écran `/dashboard/avis`, passage nocturne `/api/cron/avis`, tests navigateur + axe, Stryker, PR. | CI verte ; axe ; score de mutation ; relecture par un tiers sur de vrais comptes (comme Argon pour le lot 2). |

---

## 📋 À faire — dans l'ordre décidé

L'ordre vient des décisions du 04/11 (dix lots) et du 09/11 (le design passe
juste après le lot 4).

| # | Tâche | Contenu | Notes |
| :-: | --- | --- | --- |
| 1 | **Design — D1 fondations** | Verser au dépôt la livraison du 09/11 (maquettes, icônes, images ; pas le dossier `skills/`) ; inventaire des écarts écran par écran (captures à 360 / 768 / 1440 px) ; jetons de mouvement (`cubic-bezier(.23,1,.32,1)`, 140 ms, pression 0,97) dans `sticker-press` ; boutons ; les 49 icônes en composants React **sans `innerHTML`**. | Les règles d'interaction de la livraison vont dans `Doc/DESIGN_SYSTEM_BAOBART.md`. |
| 2 | **Design — D2 mobile** | Les 10 écrans de `Baobart Mobile.dc.html`. | Cibles ≥ 44 px, champs ≥ 16 px, essai à 360 px. |
| 3 | **Design — D3/D4 Dashboard** | Aligner les ~20 écrans nouvellement dessinés (blog, événements, infolettre, publicités, remboursements, liste noire, témoignages, candidatures, dossiers, promos, réglages…). | La plupart des fonctionnalités existent : on aligne, on ne construit pas. |
| 4 | **Lot 5 — Abonnés du créateur** (A5) | La liste de ceux qui suivent, et le fil « Suivre les détails ». | Le compteur est juste depuis v1.105.1. |
| 5 | **Lot 6 — Pilotage de l'administration** (A4) | Vue d'ensemble, journal d'activité, réglages, taxonomie ; puis boutiques, catalogue, finances, abonnements. **Plus l'attribution de « VIP »** (décision du 09/11). | VIP : geste tracé à l'audit, avec motif, dessiné en jeton rond. |
| 6 | **Lot 7 — Certificat de licence** (A7) | Page imprimable, sans QR code ni empreinte. | Réservé à Argon, après le lot 3 (guide « mission 3 », lot B). |
| 7 | **Lot 8 — Pass All Access** (A6) | Un catalogue entier pour une durée fixe. | |
| 8 | **Lot 9 — Connexion sociale, import Figma / Canva / Framer** (A8, A9) | | 🧭 Le responsable du dépôt doit créer les identifiants chez chaque fournisseur. |
| 9 | **Lot 10 — Appels, café, commandes sur mesure** (A15) | Avec un échange enregistré sur la plateforme. | Débloque « Répond vite » (< 24 h) et les **avis sur les services**. |
| 10 | **Les 8 fonctionnalités que le plan repousse** | Affiliation (A11), infolettre du créateur (A12), soutien récurrent (A13), paiement en plusieurs fois (A14), équipes (A16), assistant IA (A17), produits physiques (A18), Shield couches 1, 3, 4 (A10). | Après les dix lots (décision du 04/11). |

**Ensuite, les raccords et les partielles** (inventaire §3 et §4), sans ordre
décidé — à placer avec le responsable du dépôt :

| Tâche | Contenu |
| --- | --- |
| **B14 — Adresse du recruteur exposée** ⚠️ | `offrePublique` affiche le courriel du recruteur sans nom d'affichage, sur une page publique. **Donnée personnelle : à traiter tôt.** |
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

---

## 🧭 Décisions attendues

| Question | Ce qui en dépend |
| --- | --- |
| **Facturation** : forfaits payants (B3) et reçus / factures (C3) | Plusieurs écrans d'abonnement ; le mérite « Fidèle » (personne ne peut l'obtenir tant que seul le forfait gratuit est ouvert). |
| **Mises à jour majeures** : Next 16 (#46), `eslint-config-next` 16 (#47), Vitest 5 (#45) | Chacune est un lot à part, avec la suite complète et le navigateur. Ne pas les fusionner en même temps qu'autre chose. |
| **JSON-LD sur les fiches** (note des avis pour Google) | La règle du dépôt n'autorise qu'**un** `dangerouslySetInnerHTML` (le blog). Un second se décide, il ne s'ajoute pas en passant. Lot C2. |
| **Fusion de la PR #39** (l'inventaire) | Les identifiants A1…C10 de ce fichier y renvoient. |
| **Textes de loi sur les avis** (lois 2016-412 et 91-1000) | Lus par un juriste avant d'afficher les notes en production. |

---

## ✅ Fait — les plus récents

| Version | PR | Ce qui est livré |
| --- | --- | --- |
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
