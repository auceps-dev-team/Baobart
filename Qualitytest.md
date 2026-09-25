# Qualitytest — Niveau 1 : l'inventaire

**Ce document liste tout ce qui existe et demande une seule chose de chaque
chose : est-ce que ça s'ouvre, est-ce que ça répond.**

C'est le niveau le moins profond, et c'est celui qu'on passe en premier. Pas
parce qu'il est facile — parce qu'un écran qui ne s'ouvre pas rend inutile
toute question plus fine qu'on lui poserait ensuite.

Dérivé du code le 24 septembre 2026, pas de la documentation : 71 pages, 14
routes d'API, 93 actions serveur, 33 domaines dans `lib/`. Si un écran manque
ici, c'est que le fichier `page.tsx` n'existe pas.

---

## Les quatre niveaux

| | Document | La question qu'il pose | Ce qu'il attrape |
| --- | --- | --- | --- |
| **1** | `Qualitytest.md` *(ici)* | Est-ce que ça s'ouvre ? | L'écran blanc, le 500, le bouton mort |
| **2** | [`Qualitytest-2-parcours.md`](Qualitytest-2-parcours.md) | Est-ce que ça aboutit ? | La chaîne qui casse au troisième maillon |
| **3** | [`Qualitytest-3-refus.md`](Qualitytest-3-refus.md) | Est-ce que ça refuse ce qu'il faut refuser ? | La garde absente, la limite mal placée |
| **4** | [`Qualitytest-4-silence.md`](Qualitytest-4-silence.md) | Est-ce que ça ment en réussissant ? | Le défaut qui ne lève aucune erreur |

**Ils ne se remplacent pas.** Le niveau 1 passé à 100 % ne dit rien du niveau 4 :
la moitié des défauts trouvés sur ce projet en septembre 2026 se présentaient
comme des écrans parfaitement fonctionnels.

---

## 1. Le montage

Rien de ce qui suit n'a de sens sur une base vide ou sans stockage.

```sh
# 1 · L'infrastructure
docker compose up -d
docker ps                 # baobart-postgres, baobart-minio, baobart-redis

# 2 · Les données
npm run db:seed           # socle : licences, plans, catégories
npm run db:seed:demo      # 20 ressources avec des PRIX, 6 créateurs
npm run db:demo:medias -- "C:/chemin/du/dossier/source"   # les visuels dans MinIO
npm run db:demo:catalogue -- "C:/chemin/du/dossier/source" # 90 ressources à 0 F
npm run comptes:test      # les quatre comptes ci-dessous

# 3 · Le serveur
npm run dev               # http://localhost:3100 — PAS 3000
```

### Les comptes

| Adresse | Rôle | Sert à |
| --- | --- | --- |
| `createur@baobart.test` | MEMBER | Vendre, publier, encaisser |
| `client@baobart.test` | MEMBER | Acheter, télécharger, s'abonner |
| `admin@baobart.test` | SUPER_ADMIN | Tous les écrans d'exploitation |
| `agence@baobart.test` | MEMBER | Agence badgée : événements, offres |

Mot de passe pour les quatre : `Baobart2026!`

### Deux pièges de montage qui font perdre une heure

- **Le catalogue de démonstration est à zéro franc.** Une ressource à 0 F en
  mode `FIXED` ne s'achète pas : elle se télécharge. Pour tester un achat, il
  faut les ressources de `db:seed:demo`, qui portent des prix (5 000 à
  180 000 F). Chercher un bouton « Acheter » sur une fiche du catalogue est une
  perte de temps garantie.
- **Le bouton « Acheter » disparaît sans encaissement possible.** Il exige
  `PAYMENTS_DRIVER` renseigné **et** `APP_URL` : sans la seconde, l'opérateur
  n'a nulle part où renvoyer l'acheteur. Vérifier dans `.env` avant de conclure
  à un défaut d'affichage.

---

## 2. Ce qui est déjà automatisé — à ne pas refaire à la main

Quatre campagnes Playwright, **19 parcours**, lancées par `npm run test:e2e`.
Elles tournent sur un **build**, pas sur `next dev`.

| Campagne | Parcours | Ce qu'elle tient |
| --- | --- | --- |
| `achat.spec.ts` | 2 | Inscription → achat → espace acheteur ; refus d'acheter sa propre ressource |
| `gardes.spec.ts` | 8 | Redirection vers la connexion ; les **cinq** écrans `/dashboard/systeme/*` introuvables pour un anonyme ; accueil et explorateur publics ; 404 sur ressource inexistante |
| `limitation.spec.ts` | 3 | Le 429 arrive, avec de quoi savoir quand revenir ; une adresse ne compte pas pour une autre |
| `ordonnanceur.spec.ts` | 5 | Les six routes planifiées sont servies et refusent sans secret ; le passage du blog publie ce qui est dû et rien d'autre |

Le nombre vient de `npx playwright test --list`, pas d'un comptage à la main :
`gardes.spec.ts` déclare cinq `test(` et en produit huit, parce que l'un d'eux
boucle sur les cinq écrans d'exploitation. Compter les lignes du fichier donne
14 — un nombre faux, et exactement le piège que décrit la **forme E** du
niveau 4.

**Les relancer avant la campagne manuelle.** Si elles échouent, le manuel ne
dira rien de plus, et coûtera dix fois le temps.

---

## 3. L'inventaire

Une ligne par écran. Trois colonnes : ce qu'on fait, ce qu'on doit voir, et une
case.

Convention : ✅ conforme · ⚠️ s'ouvre mais quelque chose cloche · ❌ cassé ·
🚫 pas testable dans ce montage (dire pourquoi).

### A · Pages publiques — sans aucun compte

Se déconnecter d'abord, ou ouvrir une fenêtre privée.

| # | Écran | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| A1 | `/` | L'accueil, vignettes chargées, aucun rectangle gris | ⚠️ |
| A2 | `/explore` | La mosaïque, le rail latéral des familles, le filtre vidéo | ✅ |
| A3 | `/explore` + filtre famille | La liste se réduit, l'URL porte le filtre | ✅ |
| A4 | `/products/<slug>` | La fiche : visuel, prix, créateur, bouton d'action | ✅ |
| A5 | Vignette cliquée depuis `/explore` | La fiche s'ouvre **en modale** sans quitter la liste | ✅ |
| A6 | `/createurs` | L'annuaire des créateurs | ✅ |
| A7 | `/createurs/<username>` | Le profil public, ses ressources | ✅ |
| A8 | `/blog` | La liste des articles publiés | ✅ |
| A9 | `/blog/<slug>` | L'article, sa date, son auteur | ✅ |
| A10 | `/communautes` | Les communautés ouvertes | ✅ |
| A11 | `/communautes/<slug>` | Le fil, en lecture | ✅ |
| A12 | `/evenements` | Les événements à venir | ✅ |
| A13 | `/evenements/<id>` | La fiche, la date, le bouton d'inscription | ✅ |
| A14 | `/jobs` | Les offres publiées | ✅ |
| A15 | `/jobs/<id>` | L'offre entière, le bouton « postuler » | ✅ |
| A16 | `/services` | Les services proposés | ✅ |
| A17 | `/services/<id>` | La fiche du service, son tarif | ✅ |
| A18 | `/signalement` | La page publique : ce que dit la loi, ce que promet Baobart | ✅ |
| A19 | `/signalement/deposer` | Le formulaire de notification, **ouvert sans compte** | ✅ |
| A20 | `/products/slug-qui-nexiste-pas` | Un 404 dessiné, pas une page blanche | ✅ |

### B · Compte et sécurité

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| B1 | `/inscription` → créer un compte | Connexion immédiate, arrivée sur `/dashboard` | ✅ |
| B2 | `/connexion` avec `client@baobart.test` | Arrivée sur l'espace personnel | ✅ |
| B3 | `/connexion` avec un mauvais mot de passe | Message d'erreur, **sans dire lequel des deux est faux** | ✅ |
| B4 | `/mot-de-passe-oublie` | Le formulaire, puis un message neutre | ✅ |
| B5 | `/reinitialiser/<jeton>` avec un jeton bidon | Refus explicite | ✅ |
| B6 | Se déconnecter | Retour public, `/dashboard` renvoie vers `/connexion` | ✅ |
| B7 | `/dashboard/profil` → activer la double authentification | Un QR code + des codes de secours **affichés une seule fois** | ⚠️ |
| B8 | Se déconnecter, se reconnecter | `/connexion/verification` demande le code à six chiffres | ✅ |
| B9 | Entrer un code faux | Refus, sans consommer la tentative de façon définitive | ✅ |
| B10 | Renouveler les codes de secours | De nouveaux codes, les anciens invalides | ✅ |
| B11 | Couper la double authentification | La connexion suivante ne demande plus de code | ✅ |
| B12 | `/dashboard/profil` → ajouter une clé d'accès (WebAuthn) | Le navigateur propose son authentificateur | ✅ |
| B13 | Se reconnecter : l'étape de vérification propose « Employer une clé d'accès » | Connexion sans code à six chiffres — la clé est un second facteur, pas une connexion sans mot de passe *(ligne corrigée le 25/09)* | ✅ |
| B14 | Retirer la clé | Elle disparaît de la liste | ✅ |
| B15 | `/dashboard/profil` → demander l'effacement RGPD | Un délai annoncé, et un bouton pour annuler | ✅ |
| B16 | Annuler l'effacement | La demande disparaît | ⚠️ |

### C · Créateur — les ressources

Connecté en `createur@baobart.test`.

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| C1 | `/dashboard` | Le résumé : ressources, ventes, gains | ✅ |
| C2 | `/dashboard/produits` | La liste, avec le statut de chacune | ✅ |
| C3 | `/dashboard/produits/nouveau` | Le formulaire de dépôt | ✅ |
| C4 | Créer un brouillon | Redirection vers sa fiche, statut « Brouillon » | ✅ |
| C5 | `/dashboard/produits/<id>` | La fiche d'administration complète | ✅ |
| C6 | Téléverser un fichier source | Barre de progression, puis le fichier listé | ✅ |
| C7 | Téléverser une couverture | La vignette apparaît | ✅ |
| C8 | Retirer un fichier | Il disparaît de la liste | ✅ |
| C9 | Publier | Statut « En ligne », visible dans `/explore` | ✅ |
| C10 | Modifier le titre d'une ressource **publiée** | Le titre change, **le slug ne bouge pas** | ✅ |
| C11 | Dépublier | Retour « Brouillon », absente de `/explore` | ✅ |
| C12 | Supprimer une ressource jamais vendue | Elle disparaît | ✅ |
| C13 | Panneau « Montant et pourboire » | Mode de prix, pourboire, parité | ✅ |
| C14 | Passer en mode « L'acheteur décide » | Champs minimum + montants suggérés | ✅ |
| C15 | Activer le pourboire | La case est retenue | ✅ |
| C16 | Activer la parité de pouvoir d'achat | Le champ « réduction maximale » apparaît, avec l'avertissement « aucun coefficient chargé » | ✅ |
| C17 | `/dashboard/promos` | Codes promo, upsell, champs personnalisés | ✅ |
| C18 | Créer un code promo | Il apparaît dans la liste | ✅ |
| C19 | Retirer un code promo | Il disparaît | ✅ |
| C20 | Déclarer un upsell | Enregistré, visible | ✅ |
| C21 | Basculer un upsell | L'état change | ✅ |
| C22 | Déclarer un champ personnalisé | Enregistré | ✅ |
| C23 | Retirer un champ personnalisé | Il disparaît | ✅ |
| C24 | `/dashboard/boutique` | Les réglages de la vitrine | ✅ |
| C25 | `/dashboard/collections` | Les collections | ✅ |
| C26 | `/dashboard/statistiques` | Les chiffres, non vides après une vente | ✅ |
| C27 | `/dashboard/avis` | Les avis reçus | ✅ |
| C28 | `/dashboard/suivis` | Qui suit le compte | ✅ |

### D · Achat et livraison

Connecté en `client@baobart.test`, sur une ressource de `db:seed:demo` (avec prix).

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| D1 | `/products/<slug>` payante | Le bouton « Acheter » visible | ✅ |
| D2 | `/acheter/<slug>` | Le passage en caisse : montant, moyen de paiement | ✅ |
| D3 | Ressource en mode libre | Le champ « combien veux-tu donner », les boutons suggérés | ✅ |
| D4 | Ressource avec pourboire ouvert | Le champ pourboire, facultatif | ✅ |
| D5 | Ressource avec champs personnalisés | Les questions du créateur | ✅ |
| D6 | Appliquer un code promo | Le montant baisse, l'écran le dit | ✅ |
| D7 | Payer (bac à sable) | Redirection vers `/achat/<orderId>` | ✅ |
| D8 | `/achat/<orderId>` | L'état de la commande | ✅ |
| D9 | Déclencher le rappel (bac à sable) | La commande passe à « payée » | ✅ |
| D10 | Après paiement | L'upsell apparaît, s'il y en a un | ✅ |
| D11 | `/dashboard/achats` | La ressource achetée y figure | ⚠️ |
| D12 | Depuis l'espace acheteur, retrouver le fichier payé | Un lien de téléchargement — `/dashboard/telechargements` est l'historique des retraits, vide tant que rien n'est téléchargé *(ligne corrigée le 25/09)* | ❌ |
| D13 | Télécharger | Le fichier arrive vraiment sur le disque | ✅ |
| D14 | Ressource à 0 F | Pas de bouton d'achat, téléchargement direct | ✅ |

### E · L'argent — côté créateur

Connecté en `createur@baobart.test`, après au moins une vente.

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| E1 | `/dashboard/ventes` | La vente apparue | ✅ |
| E2 | `/dashboard/gains` | Le solde, frais déduits | ✅ |
| E3 | `/dashboard/commandes` | Les commandes reçues | ✅ |
| E4 | Agir sur une vente (rembourser / contester) | L'état change, le solde suit | ✅ |
| E5 | `/dashboard/versements` | L'historique et la cadence | ✅ |
| E6 | Enregistrer un compte de versement | Le compte est retenu | ✅ |
| E7 | Enregistrer une cadence | La cadence est retenue | ✅ |
| E8 | `/dashboard/commissions` | Les commandes sur mesure | ✅ |
| E9 | `/dashboard/forfait` | Le forfait courant et ses limites | ✅ |

### F · Social et découverte

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| F1 | Aimer une ressource | Le compteur monte, l'état persiste au rechargement | ✅ |
| F2 | Retirer le « j'aime » | Le compteur redescend | ✅ |
| F3 | Suivre un créateur | Le bouton bascule | ✅ |
| F4 | Ne plus suivre | Il rebascule | ✅ |
| F5 | Commenter une ressource | Le commentaire apparaît | ✅ |
| F6 | Retirer son commentaire | Il disparaît | ✅ |
| F7 | `/api/recherche?q=…` | Des résultats en JSON | ✅ |
| F8 | `/api/feed` | La page suivante du fil | ✅ |
| F9 | « Charger plus de ressources » sur `/explore` | La suite se charge sans doublon — il n'y a pas de défilement infini *(ligne corrigée le 25/09)* | ✅ |

### G · Communautés et forum

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| G1 | `/communautes/nouvelle` | Le formulaire d'ouverture | ✅ |
| G2 | Ouvrir une communauté | Elle apparaît dans `/communautes` | ✅ |
| G3 | Rejoindre | Le fil devient accessible en écriture | ✅ |
| G4 | Écrire dans le fil | Le message apparaît | ✅ |
| G5 | Retirer son message | Il disparaît | ✅ |
| G6 | Signaler un message | Confirmation, le message entre en file | ✅ |
| G7 | Partager une collection | Elle apparaît dans le fil | ✅ |
| G8 | Retirer la collection partagée | Elle disparaît | ✅ |
| G9 | Quitter la communauté | L'écriture se referme | ✅ |
| G10 | Modérateur : lever un signalement | Le message reste, la file se vide | ✅ |
| G11 | Modérateur : retirer un message signalé | Le message disparaît du fil | ✅ |
| G12 | Modérateur : fermer une communauté | Elle sort de la liste publique | ✅ |

### H · Emplois

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| H1 | `/jobs/deposer` | Le formulaire | ✅ |
| H2 | Déposer une offre | Elle part en relecture, pas en ligne | ✅ |
| H3 | Le recruteur retrouve son offre et son état (en attente, publiée, refusée avec motif) | L'état et le motif lui sont montrés — `/jobs/mes-propositions` liste les missions auxquelles on a répondu *(ligne corrigée le 25/09)* | ❌ |
| H4 | Modérateur : trancher l'offre | Elle passe en ligne, ou est refusée avec motif | ✅ |
| H5 | `/jobs/<id>/postuler` | Le formulaire de candidature, avec CV | ✅ |
| H6 | Envoyer une candidature | Confirmation | ✅ |
| H7 | `/dashboard/jobs/<id>/candidatures` | Les candidatures reçues | ✅ |
| H8 | `/api/jobs/candidatures/<id>/cv` | Le CV se télécharge — **et seulement par le recruteur** | ✅ |
| H9 | Modérateur : basculer la vérification d'un recruteur | Le badge change | ✅ |

### I · Services

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| I1 | `/services/deposer` | Le formulaire | ✅ |
| I2 | Déposer un service | Il part en relecture | ✅ |
| I3 | Modérateur : trancher le service | En ligne, ou refusé avec motif | ✅ |
| I4 | `/services/<id>` → contacter | Le contact part | ✅ |

### J · Événements

Connecté en `agence@baobart.test` pour la création.

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| J1 | `/dashboard/evenements/nouveau` | Le formulaire | ✅ |
| J2 | Créer un événement | Il part en relecture | ✅ |
| J3 | `/dashboard/evenements/<id>` | La fiche, modifiable | ✅ |
| J4 | Modifier | Les changements tiennent | ✅ |
| J5 | Modérateur : trancher | En ligne, ou refusé avec motif | ✅ |
| J6 | `/evenements/<id>` → s'inscrire | Confirmation, place comptée | ✅ |
| J7 | Se désinscrire | La place se libère | ✅ |
| J8 | `/dashboard/evenements/<id>/inscrits` | La liste | ✅ |
| J9 | `/api/evenements/<id>/inscrits` | L'export, réservé à l'organisateur | ✅ |
| J10 | Annuler l'événement | Les inscrits sont prévenus | ✅ |
| J11 | Rétablir l'événement | Il revient | ✅ |

### K · Blog

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| K1 | `/dashboard/blog/nouveau` | L'éditeur | ✅ |
| K2 | Créer un article | Enregistré en brouillon | ✅ |
| K3 | Téléverser une image d'article | Elle s'insère | ✅ |
| K4 | Modifier | Les changements tiennent | ✅ |
| K5 | Planifier une publication | La date est retenue | ✅ |
| K6 | Soumettre à relecture | L'article entre dans la file | ✅ |
| K7 | Relecteur : trancher avec motif | Publié, ou renvoyé avec la raison | ✅ |
| K8 | `/blog/<slug>` | L'article en ligne | ✅ |

### L · Abonnements

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| L1 | `/dashboard/abonnements` | Les créateurs suivis et « Tes abonnés » — le forfait vit dans `/dashboard/forfait` *(ligne corrigée le 25/09)* | ✅ |
| L2 | `/abonnement/<id>/renouveler` | L'écran de renouvellement | ✅ |
| L3 | Renouveler | Le cycle repart | ✅ |
| L4 | `/abonnement/<id>/paiement/<paiementId>` | L'état du paiement | ✅ |
| L5 | Déclencher le rappel d'abonnement (bac à sable) | Le paiement aboutit | ✅ |

### M · Notifications

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| M1 | `/dashboard/notifications` | La liste, les non-lues distinguées | ✅ |
| M2 | Ouvrir une notification | Elle passe en lue — il n'y a pas de bouton « marquer lue » par notification *(ligne corrigée le 25/09)* | ✅ |
| M3 | Tout marquer lu | Le compteur tombe à zéro | ✅ |
| M4 | `/dashboard/notifications/reglages` | Les préférences par événement | ✅ |
| M5 | Couper un canal | Le réglage tient au rechargement | ✅ |
| M6 | Activer les notifications navigateur | L'appareil s'enregistre | 🚫 |
| M7 | Retirer l'appareil | Il disparaît | 🚫 |

### N · Exploitation — `admin@baobart.test`

| # | Écran | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| N1 | `/dashboard/moderation` | La file unique : jobs, services, événements, blog | ✅ |
| N2 | `/dashboard/signalements` | Les dossiers juridiques et les signalements | ✅ |
| N3 | `/dashboard/systeme/configuration` | L'état de la configuration | ✅ |
| N4 | `/dashboard/systeme/membres` | Les comptes et leurs rôles | ✅ |
| N5 | Changer le rôle d'un membre | Le rôle change | ⚠️ |
| N6 | Décider du sort d'un compte (risque) | Les effets s'appliquent | ✅ |
| N7 | `/dashboard/systeme/blocklist` | Les objets bloqués | ✅ |
| N8 | Poser un blocage | Il apparaît | ✅ |
| N9 | Lever un blocage | Il disparaît | ✅ |
| N10 | `/dashboard/systeme/emails` | La file d'envoi | ✅ |
| N11 | Relancer un courriel | Il repasse en attente | ❌ |
| N12 | Abandonner un courriel | Il sort de la file | ✅ |
| N13 | `/dashboard/systeme/paiements` | Les webhooks reçus, leur état | ✅ |
| N14 | `/dashboard/systeme/versements` | Les versements à faire | ✅ |
| N15 | Faire passer un versement | L'état change | ✅ |

### O · Juridique et conformité

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| O1 | `/signalement/deposer` sans compte | Le formulaire accepte le dépôt | ✅ |
| O2 | Déposer une notification **incomplète** | Elle est **enregistrée** avec sa référence, et l'écran dit ce qui manque | ✅ |
| O3 | Compléter la notification | La référence et la date d'origine ne changent pas | ❌ |
| O4 | Modérateur : rapprocher d'un compte | Le compte visé apparaît | ❌ |
| O5 | Modérateur : retirer à titre provisoire | La ressource visée **disparaît de `/explore` et rend 404** | ✅ |
| O6 | Vérifier le bilan affiché | Il nomme les adresses qu'il n'a **pas** atteintes | ❌ |
| O7 | Créateur : ouvrir sa ressource retirée | Pastille « Retirée (juridique) » + la référence du dossier | ✅ |
| O8 | Créateur : tenter de publier | Refus expliqué, renvoi vers « Mes dossiers » | ✅ |
| O9 | Acheteur : tenter de télécharger | Refus expliqué | ✅ |
| O10 | `/dashboard/mes-dossiers` → répondre | La réponse part, le dossier passe en contestée | ❌ |
| O11 | Modérateur : trancher « remise en ligne » | La ressource revient **à l'état qu'elle avait** | ✅ |
| O12 | Modérateur : trancher « retrait définitif » | Elle reste retirée | ✅ |

### P · Routes d'API et ordonnanceur

Les routes `cron` exigent le secret. Sans lui : 404, jamais 401 — une 401
confirmerait l'existence de la route.

| # | Route | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| P1 | `/api/health` | Un état, sans authentification | ✅ |
| P2 | `/api/cron/versements` sans secret | 404 | ✅ |
| P3 | `/api/cron/courriels` sans secret | 404 | ✅ |
| P4 | `/api/cron/commandes` sans secret | 404 | ✅ |
| P5 | `/api/cron/abonnements` sans secret | 404 | ✅ |
| P6 | `/api/cron/blog` **avec** secret | Un bilan JSON, articles publiés | ✅ |
| P7 | `/api/cron/juridique` **avec** secret | Un bilan JSON | ✅ |
| P8 | `/api/cron/securite` sans secret | 404 | ✅ |
| P9 | `/api/paiements/<fournisseur>/webhook` | Répond, et n'accepte pas n'importe quoi | ✅ |
| P10 | `/api/telechargement/<fichierId>` non connecté | Renvoi vers la connexion | ✅ |

---

## 4. Ce que ce niveau ne dit pas

**Il ne dit rien de l'argent.** « L'écran des gains s'ouvre » ne dit pas que le
montant est juste. C'est le niveau 2.

**Il ne dit rien des refus.** Cocher « je peux publier » ne dit pas que
quelqu'un d'autre ne le peut pas. C'est le niveau 3.

**Il ne dit rien des succès muets.** Un bouton qui répond « c'est fait » sans
rien faire coche cette case aussi bien qu'un bouton qui marche. C'est le niveau
4, et c'est celui qui a trouvé le plus de défauts réels sur ce projet.

**Il ne teste pas les 93 actions serveur une à une.** Les tableaux couvrent
celles qui ont un écran à elles. Cinq n'en ont pas : elles sont déclenchées par
un autre geste (`lireEtatDeuxFacteurs`, `apercuDuCode`,
`demarrerConnexionParCle`, `reserverFichier`, `confirmerFichier`) et sont
couvertes indirectement par B7, D6, B13 et C6.

---

## Résultats — campagne du 25 septembre 2026

Passée au navigateur (Chromium sans tête, piloté par Playwright) contre un
**build de production** servi sur le port 3100, base de développement,
pilote de paiement `bac-a-sable`, courriels en console (vérifiés dans la
file `EmailOutbox`). Chaque case vient d'une vérification qui a réellement
tourné : écran ouvert, geste fait, et presque toujours une lecture en base à
la suite. Les captures d'écran sont dans le dossier de campagne.

**Bilan : 189 cases — **175** ✅ · **5** ⚠️ · **7** ❌ · **2** 🚫.**

Convention : ✅ conforme · ⚠️ marche, mais quelque chose cloche · ❌ défaut
réel · 🚫 pas éprouvable dans ce montage (la raison est dite).

### Ce qui ne passe pas

| # | | Constat |
| --- | --- | --- |
| A1 | ⚠️ | Rendu, 3 <img> décodées, 12 fonds CSS en HTTP 200 — MAIS à 1280 et 1366 px l’en-tête passe sur 2 lignes (153 px) et le bouton « PANIER » est recouvert par le rail (fixed, z-index 45 > 40). elementFromPoint au centre du bouton rend le rail. Rien de masqué à 1024, 1440, 1920. |
| B7 | ⚠️ | activée (totpActiveLe posé) ; 8 codes de secours AFFICHÉS avec « Note ces codes maintenant » ; secret en clair + lien otpauth:// (1) ; QR code : ABSENT — le plan annonçait un QR, l'écran n'en montre pas |
| B16 | ⚠️ | L’annulation MARCHE en base (0 demande ouverte), mais juste après le clic l’écran affiche « Demande enregistrée. L’effacement aura lieu le 24 octobre 2026, sauf annulation de ta part. » avec le formulaire rouvert — l’inverse de la vérité. Un rechargement rétablit « Demander l’effacement ». État client resté (formulaire ouvert + résultat de la demande) après le changement de branche. Captures effac |
| D11 | ⚠️ | Commande #YZQR6K listée, 10 000 F, PAYÉE, « Mes fichiers ». MAIS juste dessous, en orange : « Le paiement n'est pas encore branché : aucune commande ne peut être passée pour le moment. » — texte écrit EN DUR sans condition (app/dashboard/achats/page.tsx:142), vestige d'avant le branchement du paiement ; il contredit la commande payée affichée au-dessus. |
| D12 | ❌ | Depuis l'espace acheteur, aucun lien vers le fichier payé. « Mes fichiers » (sur la commande payée) mène à /dashboard/telechargements, qui est l'HISTORIQUE des retraits : « Rien téléchargé pour l'instant », 0 lien. Limite déjà écrite dans e2e/achat.spec.ts (« aucun écran de l'espace acheteur ne nomme la ressource ») — mais ce commentaire dit aussi que le reçu, qui pointait vers cette page vide, a  |
| H3 | ❌ | /jobs/mes-propositions liste les missions auxquelles on a RÉPONDU, pas les offres déposées (le plan décrivait mal l’écran). Mais le besoin réel n’est couvert nulle part : aucun écran ne liste les offres d’un recruteur avec leur état (recruiterId n’est lu dans app/ que par la page des candidatures d’UNE offre, connue par son id), et le refus ne le prévient pas — lib/jobs/moderation.ts#trancher écri |
| M6 | 🚫 | Non éprouvable dans ce montage : l'écran affiche « Les notifications ne sont pas encore branchées » — la clé publique VAPID manque dans .env (scripts/cles-push.mjs sait la générer). Le montage de test n'a pas été modifié pour l'activer. |
| M7 | 🚫 | Dépend de M6 : sans clé VAPID, aucun appareil ne peut s'enregistrer, donc rien à retirer. |
| N5 | ⚠️ | Rôle changé → MODERATOR (en base), mais PAR LA LIGNE DE COMMANDE : scripts/promouvoir-admin.mjs (« 0 session(s) fermée(s) — reconnexion nécessaire. »). Aucun écran ne le permet : le pouvoir « gérer les rôles » (« Nommer et révoquer des administrateurs ») est déclaré dans lib/auth/administration.ts et utilisé nulle part ; platformRole n'est écrit que par deux scripts. |
| N11 | ❌ | L'ACTION marche (au clavier : focus + Entrée → le courriel en échec repasse PENDING), mais le BOUTON n'est pas cliquable à la souris sur une ligne en échec : le texte « dernière erreur » déborde par-dessus « Relancer » (elementFromPoint au centre du bouton rend le DIV du message d'erreur ; capture sonde-N11.png) — précisément le seul cas où « Relancer » sert. Le tableau déborde aussi à droite (« A |
| O3 | ❌ | Aucun moyen de COMPLÉTER le dossier NOT-2026-002 : aucun écran ni action serveur n'expose completer() (appelée seulement par les tests). Renvoyer le formulaire complet crée un SECOND dossier : NOT-2026-002 INCOMPLETE 09:23:33 ; NOT-2026-003 RECUE 09:23:42. Le premier reste INCOMPLETE pour toujours, et la date de première tentative (2026-09-25 09:23:33) — que la conception veut préserver « parce qu |
| O4 | ❌ | Aucun contrôle pour rattacher le dossier au compte visé (contrôles trouvés : aucun). L'action rapprocherDUnCompte existe (lib/juridique/actions.ts) mais n'est appelée par aucun écran. targetUserId reste nul : l'auteur ne sera ni prévenu (avisEnvoye faux) ni capable de voir le dossier (dossiersDeLAuteur filtre sur targetUserId). |
| O6 | ❌ | DÉFAUT DE LA v1.69.0 (mon code d’hier). Le bilan (« Ces adresses ne désignent aucune ressource… ») n’apparaît JAMAIS : il est gardé dans l’état du composant RetirerProvisoirement, et ce composant est démonté dès que le dossier passe en RETRAIT_PROVISOIRE (revalidatePath → la carte affiche Trancher à la place). Calculé, renvoyé, perdu. Mesuré le 25/09 : après le clic, la carte montre « Retrait défi |
| O10 | ❌ | Le créateur NE VOIT PAS le dossier dans « Mes dossiers » (le lien « Répondre » de sa fiche y mène, vers une page vide) : targetUserId nul, et rien ne permet de le poser (O4). Écran de réponse éprouvé après rattachement EN BASE : réponse envoyée → dossier CONTESTEE. |

### Mesures complémentaires

Faites à côté d'une ligne, sans ligne à elles. Elles ne comptent pas dans le bilan.

| # | | Preuve |
| --- | --- | --- |
| L-souscrire | ❌ | Aucun moyen de PRENDRE un forfait : /dashboard/forfait affiche « Plans disponibles » (nom, prix mensuel, téléchargements, licence) sans aucun bouton ni lien, et la seule création d'abonnement hors tests est dans scripts/comptes-de-test.ts (recherche du 25/09 : subscription.create\|upsert dans lib, app, components, prisma, scripts, e2e — .ts/.tsx/.mjs/.js). Le renouvellement marche (L2–L5) ; la sous |
| N6-sans-kyc | ❌ | Sur un compte sans KYC (kycStatus NONE), l'écran PROPOSE « Signaler… » et « Suspendre… », et la décision est toujours refusée : lib/domain/risque.ts passe isVerified = kycStatus !== 'NONE', et « un compte non vérifié ne peut être ni signalé ni suspendu ». Le refus affiché donne une FAUSSE raison — « L'événement SUSPEND_TOS n'est pas autorisé depuis l'état NOT_REVIEWED » — alors que lib/domain/trus |
| R-blocage-inscription | ✅ | inscription avec l'adresse bloquée refusée : aucun compte créé ; message : « Ce compte ne peut pas être utilisé. Écris-nous si tu penses que c'est une erreur. » |
| R-blog-court | ✅ | corps de 37 caractères refusé, message affiché : « L'article fait au moins 200 caractères — sinon c'est une brève, et une brève se met ailleurs. » |
| S-slug-article-publie | ✅ | article PUBLIÉ renommé : le slug ne bouge pas (d-ou-vient-le-wax-qa-mugpt3ar-revise) — l’adresse publique tient |

### La preuve de chaque case

| # | | Preuve |
| --- | --- | --- |
| A1 | ⚠️ | Rendu, 3 <img> décodées, 12 fonds CSS en HTTP 200 — MAIS à 1280 et 1366 px l’en-tête passe sur 2 lignes (153 px) et le bouton « PANIER » est recouvert par le rail (fixed, z-index 45 > 40). elementFromPoint au centre du bouton rend le rail. Rien de masqué à 1024, 1440, 1920. |
| A2 | ✅ | HTTP 200 ; 26 liens de ressources ; filtre « Vidéo » présent |
| A3 | ✅ | filtre /explore?filtre=Art : URL ?filtre=Art ; 26 → 20 ressources |
| A4 | ✅ | HTTP 200, rendu sans erreur — F, Acheter\|Télécharger\|Se connecter présents |
| A5 | ✅ | Ouverture en modale depuis /explore, 30 cartes restées derrière. Observation : 2 vignettes « du même créateur » sont rayées — ressources AUDIO sans couverture (nappe-sonore-harmattan, boucle-kora-12-samples), trame de repli de la charte, pas un chargement raté. |
| A6 | ✅ | HTTP 200, rendu sans erreur — créat présents |
| A7 | ✅ | HTTP 200, rendu sans erreur — atelier présents |
| A8 | ✅ | HTTP 200, rendu sans erreur — blog\|article présents |
| A9 | ✅ | /blog/d-ou-vient-le-wax-qa-mugpt3ar-revise lu SANS compte : HTTP 200, rendu ; wax présents |
| A10 | ✅ | HTTP 200, rendu sans erreur — communaut présents |
| A11 | ✅ | /communautes/communaute-qa-mugosqo4 lu SANS compte : HTTP 200, rendu ; Communauté QA, Rejoindre\|connect présents |
| A12 | ✅ | HTTP 200, rendu sans erreur — événement\|evenement présents |
| A13 | ✅ | /evenements/cmugpe1400052ukc0ia2bc9fm lu SANS compte : HTTP 200, rendu ; Atelier QA, inscri\|place présents |
| A14 | ✅ | HTTP 200, rendu sans erreur — offre\|emploi\|job présents |
| A15 | ✅ | /jobs/cmugp8be4004jukc04ealasim lu SANS compte : HTTP 200, rendu ; Direction artistique QA, postuler\|candidat présents |
| A16 | ✅ | HTTP 200, rendu sans erreur — service présents |
| A17 | ✅ | /services/cmugp8k0x004lukc0800qyu78 lu SANS compte : HTTP 200, rendu ; Retouche photo QA, 15s?000\|F présents |
| A18 | ✅ | HTTP 200, rendu sans erreur — 2013-451\|loi présents |
| A19 | ✅ | HTTP 200, rendu sans erreur — notification\|signal présents |
| A20 | ✅ | HTTP 404, page dessinée (396 caractères de texte) |
| B1 | ✅ | compte qa-mug4bh9i@baobart.test créé (1 ligne User), arrivée sur /dashboard |
| B2 | ✅ | client@baobart.test → /dashboard |
| B3 | ✅ | même message pour mot de passe faux et adresse inconnue : « Adresse ou mot de passe incorrect. » (671 ms / 675 ms) |
| B4 | ✅ | message neutre affiché ; 1 jeton de réinitialisation posé ; 2 courriel en file pour qa-mug4bh9i@baobart.test |
| B5 | ✅ | HTTP 200, refus lisible : « LIEN INTROUVABLE » |
| B6 | ✅ | après déconnexion, /dashboard → /connexion |
| B7 | ⚠️ | activée (totpActiveLe posé) ; 8 codes de secours AFFICHÉS avec « Note ces codes maintenant » ; secret en clair + lien otpauth:// (1) ; QR code : ABSENT — le plan annonçait un QR, l'écran n'en montre pas |
| B8 | ✅ | mot de passe accepté → /connexion/verification |
| B9 | ✅ | Code faux refusé, message affiché sous le champ : « Ce code ne correspond pas. Vérifie ton application. » (lu sur la capture P12-ancien-refuse.png). Le code suivant passe : la tentative ratée ne bloque pas. Observation : le même message s’affiche pour un ancien code de SECOURS, qui ne vient pas de l’application. |
| B10 | ✅ | 8 nouveaux codes affichés, aucun commun avec les 8 anciens |
| B11 | ✅ | coupée (totpActiveLe nul en base) ; connexion suivante → /dashboard, sans code |
| B12 | ✅ | authentificateur virtuel sollicité (1 identifiant créé) ; 1 ligne Passkey en base ; « Clé QA » listée |
| B13 | ✅ | mot de passe → /connexion/verification → « Employer une clé d'accès » → /dashboard sans code à six chiffres ; lastUsedAt posé : true |
| B14 | ✅ | retirée : 0 ligne Passkey en base, disparue de la liste |
| B15 | ✅ | demande enregistrée, effacement prévu le 2026-10-24 (dans 30 j) ; bouton « Annuler la demande » affiché |
| B16 | ⚠️ | L’annulation MARCHE en base (0 demande ouverte), mais juste après le clic l’écran affiche « Demande enregistrée. L’effacement aura lieu le 24 octobre 2026, sauf annulation de ta part. » avec le formulaire rouvert — l’inverse de la vérité. Un rechargement rétablit « Demander l’effacement ». État client resté (formulaire ouvert + résultat de la demande) après le changement de branche. Captures effac |
| C1 | ✅ | HTTP 200, rendu ; ressource\|produit, vente\|gain présents |
| C2 | ✅ | HTTP 200, rendu ; ressource\|produit présents |
| C3 | ✅ | HTTP 200, rendu ; titre, prix présents |
| C4 | ✅ | brouillon créé (qa-affiche-fixe-mug4vng3), redirection vers sa fiche, statut DRAFT, pastille « Brouillon » |
| C5 | ✅ | fiche complète ; « Publier la ressource » désactivé tant qu'aucun fichier source n'est attaché |
| C6 | ✅ | fichier vendu téléversé (PUT MinIO 200 par URL signée, puis confirmation 200) : sources 1 → 2, listé sur la fiche |
| C7 | ✅ | aperçu téléversé : 2 PREVIEW en base ; coverUrl posée et servie en HTTP 200 |
| C8 | ✅ | Les DEUX régimes mesurés. Ressource jamais vendue : le fichier retiré part pour de bon (ligne et objet). Ressource DÉJÀ VENDUE (après D9) : la ligne reste, marquée deletedAt, et n'est plus active — conforme à lib/upload/service.ts. |
| C9 | ✅ | PUBLISHED ; /products/qa-affiche-fixe-mug4vng3 HTTP 200 ; présente dans /explore |
| C10 | ✅ | ressource EN LIGNE modifiée : titre → « QA Affiche fixe mug52uiw (v2) » ; slug inchangé (qa-affiche-fixe-mug4vng3) ; reste PUBLISHED |
| C11 | ✅ | retirée : DRAFT, fiche publique 404, absente de /explore — puis republiée (PUBLISHED) |
| C12 | ✅ | brouillon jetable supprimé : 0 ligne en base, retour à /dashboard/produits |
| C13 | ✅ | panneau présent : « Qui décide du montant », pourboire, parité de pouvoir d'achat |
| C14 | ✅ | mode LIBRE, minimum 2000, suggestions [2000, 5000, 10000] — en base |
| C15 | ✅ | pourboire activé : tipsEnabled = true en base, case cochée après rechargement |
| C16 | ✅ | case cochée → champ « Réduction maximale (%) » apparu + « aucun coefficient n'est chargé pour l'instant » |
| C17 | ✅ | HTTP 200, rendu ; code, après achat\|upsell présents |
| C18 | ✅ | code QAG4VNG3 (−10 %, 2 utilisations) créé : maxUses 2, usesCount 0, listé |
| C19 | ✅ | code QAJ4VNG3 créé puis retiré : plus aucun code actif de ce nom en base |
| C20 | ✅ | upsell déclaré : après « QA Affiche fixe mug52uiw (v2) », proposer « QA Prix libre mug4vng3 » — 1 ligne Upsell |
| C21 | ✅ | basculé true → false (en base), puis remis à true |
| C22 | ✅ | champ « Ton prénom, pour la dédicace » (texte, obligatoire) déclaré : 1 CustomField |
| C23 | ✅ | champ jetable retiré : 2 → 1 ; reste « Ton prénom, pour la dédicace » |
| C24 | ✅ | HTTP 200, rendu ; boutique\|vitrine présents |
| C25 | ✅ | HTTP 200, rendu ; collection présents |
| C26 | ✅ | HTTP 200, rendu ; statistique\|vue\|vente présents |
| C27 | ✅ | HTTP 200, rendu ; avis présents |
| C28 | ✅ | HTTP 200, rendu ; suivi\|abonn\|follow présents |
| D1 | ✅ | fiche payante (10 000 F) : bouton « Acheter » visible |
| D2 | ✅ | tunnel : total 10 000 F, bouton « Payer 10 000 F », pays de facturation, 5 moyens (Orange Money, Wave, MTN, Moov, carte) |
| D3 | ✅ | mode libre : « Combien veux-tu donner ? », boutons 2 000 F / 5 000 F / 10 000 F, champ prérempli, « Minimum 2 000 F » affiché : oui |
| D4 | ✅ | pourboire ouvert (tipsEnabled) : champ « Ajouter un pourboire — si tu veux », facultatif (vide par défaut) |
| D5 | ✅ | question du créateur affichée : « Ton prénom, pour la dédicace * » ; attribut required : oui |
| D6 | ✅ | code QAG4VNG3 vérifié : « − 1 000 F · tu paieras 9 000 F » (−10 % de 10 000 F) |
| D7 | ✅ | « Payer » → /achat/cmug59z26002hukc004yzqr6k ; commande cmug59z26002hukc004yzqr6k créée |
| D8 | ✅ | /achat/cmug59z26002hukc004yzqr6k : HTTP 200, commande en IN_PROGRESS ; bac à sable proposé : oui |
| D9 | ✅ | rappel signé rejoué par HTTP → ligne SUCCESSFUL ; réponse du champ figée sur la commande : [{"nom": "Ton prénom, pour la dédicace", "valeur": "Aya"}] |
| D10 | ✅ | après paiement : l'upsell « QA Prix libre » est proposé |
| D11 | ⚠️ | Commande #YZQR6K listée, 10 000 F, PAYÉE, « Mes fichiers ». MAIS juste dessous, en orange : « Le paiement n'est pas encore branché : aucune commande ne peut être passée pour le moment. » — texte écrit EN DUR sans condition (app/dashboard/achats/page.tsx:142), vestige d'avant le branchement du paiement ; il contredit la commande payée affichée au-dessus. |
| D12 | ❌ | Depuis l'espace acheteur, aucun lien vers le fichier payé. « Mes fichiers » (sur la commande payée) mène à /dashboard/telechargements, qui est l'HISTORIQUE des retraits : « Rien téléchargé pour l'instant », 0 lien. Limite déjà écrite dans e2e/achat.spec.ts (« aucun écran de l'espace acheteur ne nomme la ressource ») — mais ce commentaire dit aussi que le reçu, qui pointait vers cette page vide, a  |
| D13 | ✅ | par la FICHE de la ressource (seul chemin) : « qa-source.png » reçu sur le disque, 34325 octets, signature PNG valide — le fichier vendu, pas une page |
| D14 | ✅ | ressource à 0 F (portrait-wax-editorial) : aucun bouton d'achat, téléchargement direct proposé |
| E1 | ✅ | /dashboard/ventes : la vente de 10 000 F apparaît, gestes « Rembourser… » et « Retirer l'accès… » proposés : oui |
| E2 | ✅ | /dashboard/gains affiche 8850 F — exactement le net crédité en base |
| E3 | ✅ | /dashboard/commandes : HTTP 200, rendu — « commande » présent |
| E4 | ✅ | « Retirer l’accès… » → motif → vente RETIREE à l’écran ; l’acheteur est ensuite refusé au téléchargement (HTTP 403, « L’accès à cette ressource a été retiré par son créateur… », plus de redirection vers l’URL signée). « Rembourser » : refusé avec un message juste — le pilote bac-à-sable n’implémente pas `rembourser` (contrat.ts:248) ; chaîne du remboursement à éprouver en simulation. |
| E5 | ✅ | /dashboard/versements : panneaux « Compte de versement » (5 moyens : virement, Wave, MTN, Orange, Moov) et « Cadence des versements » (semaine / mois / trimestre, « mois » par défaut) ; « Aucun compte enregistré » dit |
| E6 | ✅ | carte « Wave » cliquée (radio cochée) ; compte enregistré : provider wave, titulaire Awa Diallo, vérifié false ; « Aucun compte enregistré » disparu : true |
| E7 | ✅ | cadence MONTHLY → WEEKLY en base (User.payoutFrequency) |
| E8 | ✅ | /dashboard/commissions : HTTP 200, rendu |
| E9 | ✅ | /dashboard/forfait : HTTP 200, rendu — forfait courant affiché : oui |
| F1 | ✅ | « ♥ J'aime » → « ♥ Aimé · 1 » ; likesCount 0 → 1 ; 1 ligne Like ; l'état tient au rechargement |
| F2 | ✅ | likesCount 1 → 0, ligne Like supprimée, bouton « ♥ J'aime » |
| F3 | ✅ | 1 ligne Follow ; après rechargement le bouton dit « Abonné · 1 » |
| F4 | ✅ | Follow supprimé ; le bouton redit « Suivre » |
| F5 | ✅ | commentaire publié : 1 ligne Comment, affiché sous la ressource ; commentsCount = 1 |
| F6 | ✅ | boutons du commentaire : Répondre / Retirer ; retiré → disparu de la fiche, 0 ligne active (deletedAt posé) |
| F7 | ✅ | /api/recherche?q=collage → HTTP 200, JSON, 1 résultat(s) |
| F8 | ✅ | /api/feed : page 1 = 24 éléments + curseur ; page 2 = 24 éléments, 0 doublon |
| F9 | ✅ | « Charger plus de ressources » : 26 → 48 ressources distinctes, 22 nouvelles, aucun doublon (la suite part du curseur) |
| G1 | ✅ | /communautes/nouvelle : formulaire (nom, description, « Ouvrir la communauté ») |
| G2 | ✅ | communauté ouverte (communaute-qa-mugosqo4, statut active, 1 membre) → arrivée sur /communautes/communaute-qa-mugosqo4 ; listée dans /communautes |
| G3 | ✅ | « Rejoindre » → 1 adhésion en base ; le champ d'écriture du fil apparaît (0 → 1) ; le bouton dit « Quitter » |
| G4 | ✅ | message envoyé : 1 ligne CommunityChatMessage, affiché dans le fil |
| G5 | ✅ | message retiré par son auteur : disparu du fil ; 0 ligne restante en base |
| G6 | ✅ | le client signale le message du créateur : bouton → « Signalé », isFlagged = true en base |
| G7 | ✅ | « Partager une collection » → « QA Collection mugosqo4 » proposée, partagée : Board.communityId posé, affichée dans la communauté — NB : collection créée par SQL, l'application ne sait pas encore en créer (bouton « Collection » grisé, « arrivent bientôt ») |
| G8 | ✅ | collection retirée de la communauté : communityId remis à nul ; la collection existe toujours (1 ligne) — retirer du fil ne détruit pas |
| G9 | ✅ | « Quitter » → adhésion supprimée, le champ d'écriture disparaît, « Rejoindre » revient |
| G10 | ✅ | « Laisser » : le message reste dans le fil (affiché), isFlagged remis à false, sorti de la file de /dashboard/signalements |
| G11 | ✅ | confirmation demandée (« Retirer ce message ? C'est définitif, et c'est consigné. ») puis acceptée → message retiré du fil public ; 0 ligne restante en base ; 1 entrée « contenu.retirer » au journal pour ce message |
| G12 | ✅ | « Fermer » + motif → statut closed, sortie de /communautes (mesuré au 1er passage) ; « Rouvrir » + motif → statut active, de retour dans /communautes. Les deux motifs sont au journal (contenu.retirer « fermeture » / contenu.publier). |
| H1 | ✅ | /jobs/deposer : formulaire (titre, description, type, mode, lieu, rémunération, échéance, façon de postuler) |
| H2 | ✅ | offre déposée : statut SOUMIS en base, absente de /jobs tant que personne ne l'a relue |
| H3 | ❌ | /jobs/mes-propositions liste les missions auxquelles on a RÉPONDU, pas les offres déposées (le plan décrivait mal l’écran). Mais le besoin réel n’est couvert nulle part : aucun écran ne liste les offres d’un recruteur avec leur état (recruiterId n’est lu dans app/ que par la page des candidatures d’UNE offre, connue par son id), et le refus ne le prévient pas — lib/jobs/moderation.ts#trancher écri |
| H4 | ✅ | file unique : offre et service présents ; « Publier » → statut PUBLIE, visible dans /jobs ; seconde offre refusée avec motif → statut REFUSE, motif « Rémunération non précisée — merci de l'indiquer. » conservé ; 0 notification(s) à l'agence |
| H5 | ✅ | /jobs/<id>/postuler : message + CV (PDF uniquement, taille maximale annoncée) |
| H6 | ✅ | candidature envoyée : 1 JobApplication, CV rangé (clé de stockage posée) |
| H7 | ✅ | /dashboard/jobs/<id>/candidatures : la candidature du client, avec son message |
| H8 | ✅ | recruteur : HTTP 303 → PDF reçu (599 octets, en-tête %PDF-) ; client (le candidat lui-même, pas le recruteur) : HTTP 404, pas de fichier |
| H9 | ✅ | bouton « Marquer vérifiée » → « Vérifiée ✓ » après rechargement |
| I1 | ✅ | /services/deposer : formulaire (titre, catégorie, description, prix de départ, délai) |
| I2 | ✅ | service déposé : statut SOUMIS, en attente de relecture |
| I3 | ✅ | service publié depuis la file : statut PUBLIE, visible dans /services |
| I4 | ✅ | Pas de messagerie interne, par choix écrit (lib/services/contact.ts) : deux liens mailto: vers l’auteur, sujets distincts — « Commande — Retouche photo QA… » et « Question — Retouche photo QA… », corps prérempli. Lien vers le profil /@atelier-sankofa → HTTP 200 (réécriture documentée dans next.config.ts). |
| J1 | ✅ | /dashboard/evenements/nouveau : formulaire (titre, genre, description, début, fin, lieu / en ligne, capacité, billet, dotation) |
| J2 | ✅ | brouillon créé (état BROUILLON) ; boutons proposés : Enregistrer les modifications / Envoyer en relecture / Annuler l'événement… ; après envoi en relecture : état SOUMIS |
| J3 | ✅ | fiche de l'organisatrice : HTTP 200 ; champs modifiables : oui |
| J4 | ✅ | modification enregistrée : « Atelier QA mugpdo2q (modifié) » |
| J5 | ✅ | file de modération → « Publier » : état SOUMIS → PUBLIE, visible dans /evenements ; 2 notification(s) à l'organisatrice |
| J6 | ✅ | « M'inscrire » → 1 EventRegistration ; places affichées : « PLACES » |
| J7 | ✅ | « Me désinscrire » → plus d'inscription active ; « M'inscrire » revient : oui |
| J8 | ✅ | /dashboard/evenements/<id>/inscrits : l'inscrit est listé |
| J9 | ✅ | organisatrice : HTTP 200, text/csv; charset=utf-8, l'inscrit y figure ; un inscrit (non organisateur) : HTTP 404 |
| J10 | ✅ | annulé (état PUBLIE) avec la raison ; l'inscrit prévenu : 1 notification(s), 1 courriel(s) en file |
| J11 | ✅ | « Lever l’annulation » → cancelledAt remis à nul, état PUBLIE ; l’événement revient |
| K1 | ✅ | /dashboard/blog/nouveau : éditeur (titre, corps, insertion d'image, extrait, rubrique, couverture, à la une, parution prévue, SEO, adresse canonique) |
| K2 | ✅ | brouillon créé : état BROUILLON, slug d-ou-vient-le-wax-qa-mugpt3ar ; gestes proposés : ▸ Référencement / Enregistrer / Envoyer en relecture / Publier |
| K3 | ✅ | « Insérer une image dans l’article » : l’envoi répond {ok:true, url:…/public/blog/<uuid>.png}, le corps passe de 351 à 448 caractères avec ![](url) inséré à la position du curseur ; l’image est servie en HTTP 200 (image/png). Premier essai de la campagne non abouti en 6 s — non reproduit (8 s au second). |
| K4 | ✅ | enregistré : « D'où vient le wax — QA mugpt3ar (révisé) » ; l'image insérée est dans le corps en base : non |
| K5 | ✅ | parution prévue retenue en base : 2026-09-28 08:00 (puis retirée pour la suite) |
| K6 | ✅ | envoyé en relecture : état SOUMIS, présent dans la file unique de modération |
| K7 | ✅ | relecteur → « Publier » : état PUBLIE, publishedAt posé |
| K8 | ✅ | /blog/d-ou-vient-le-wax-qa-mugpt3ar-revise → HTTP 200 (lu sans erreur), listé dans /blog. NB : le slug a suivi la révision du titre faite en BROUILLON (…-mugpt3ar → …-mugpt3ar-revise) — sans conséquence tant que rien n’est public. |
| L1 | ✅ | /dashboard/abonnements : HTTP 200, rendu. Cet écran liste les CRÉATEURS SUIVIS et « Tes abonnés » — pas les forfaits. Le forfait vit dans /dashboard/forfait (« Ton forfait », « Plans disponibles »). Le plan de test confondait les deux. |
| L2 | ✅ | écran de renouvellement : « IL TE RESTE 58 JOURS » ; libellés : ; tunnel de paiement présent (éprouvé en L3–L5) |
| L3 | ✅ | « Renouveler » → SubscriptionPayment PENDING, 7500 F ; échéance avant paiement : 2026-10-23 ; redirection vers la page du paiement |
| L4 | ✅ | /abonnement/<id>/paiement/<paiementId> : HTTP 200, état du paiement affiché ; bac à sable proposé : oui |
| L5 | ✅ | rappel d'abonnement → paiement PAID, paidAt posé ; échéance 2026-10-23 → 2026-11-22 : le cycle repart |
| M1 | ✅ | /dashboard/notifications : 3 non lue(s) en base (événement annulé en J10…), listées |
| M2 | ✅ | ouvrir une notification la marque lue : non lues 4 → 3 ; ouverture vers son lien (/dashboard) |
| M3 | ✅ | « Tout marquer comme lu » : non lues 5 → 0 ; lien du menu après rechargement : « » (sans compteur) |
| M4 | ✅ | réglages : 38 bascules (courriel / dans l'app, par événement), 6 déjà coupée(s) par défaut |
| M5 | ✅ | « Courriel ✓ » basculée true → false, tenue au rechargement, puis remise ; 20 bascule(s) verrouillée(s) (avis impératifs, non coupables) |
| M6 | 🚫 | Non éprouvable dans ce montage : l'écran affiche « Les notifications ne sont pas encore branchées » — la clé publique VAPID manque dans .env (scripts/cles-push.mjs sait la générer). Le montage de test n'a pas été modifié pour l'activer. |
| M7 | 🚫 | Dépend de M6 : sans clé VAPID, aucun appareil ne peut s'enregistrer, donc rien à retirer. |
| N1 | ✅ | /dashboard/moderation : HTTP 200, rendu ; modération\|relecture présents — la file a porté offres (H4), services (I3), événements (J5) et articles (K6–K7) pendant la campagne |
| N2 | ✅ | /dashboard/signalements : HTTP 200, rendu ; signal, dossiers juridiques présents — messages signalés tranchés en G10–G11, communauté fermée/rouverte en G12 |
| N3 | ✅ | /dashboard/systeme/configuration : HTTP 200, rendu ; configuration\|pilote\|variable présents  |
| N4 | ✅ | /dashboard/systeme/membres : HTTP 200, rendu ; membre présents — qa-mug4bh9i@baobart.test listé : oui |
| N5 | ⚠️ | Rôle changé → MODERATOR (en base), mais PAR LA LIGNE DE COMMANDE : scripts/promouvoir-admin.mjs (« 0 session(s) fermée(s) — reconnexion nécessaire. »). Aucun écran ne le permet : le pouvoir « gérer les rôles » (« Nommer et révoquer des administrateurs ») est déclaré dans lib/auth/administration.ts et utilisé nulle part ; platformRole n'est écrit que par deux scripts. |
| N6 | ✅ | (KYC posé VERIFIED en base pour l'épreuve) « Suspendre (conditions) » + motif → SUSPENDED_TOS, suspendedAt posé, 0 session(s) restante(s), 1 ligne(s) RiskStateChange ; « Lever la suspension » → COMPLIANT, suspendu false |
| N7 | ✅ | /dashboard/systeme/blocklist : HTTP 200, rendu ; bloc présents  |
| N8 | ✅ | blocage posé : EMAIL bloque-mugqlsfe@baobart.test, expire jamais ; listé |
| N9 | ✅ | blocage levé : plus aucune ligne active pour cette adresse, disparue de la liste |
| N10 | ✅ | /dashboard/systeme/emails : HTTP 200, rendu ; courriel\|e-mail\|file présents — 11 courriels en attente en base |
| N11 | ❌ | L'ACTION marche (au clavier : focus + Entrée → le courriel en échec repasse PENDING), mais le BOUTON n'est pas cliquable à la souris sur une ligne en échec : le texte « dernière erreur » déborde par-dessus « Relancer » (elementFromPoint au centre du bouton rend le DIV du message d'erreur ; capture sonde-N11.png) — précisément le seul cas où « Relancer » sert. Le tableau déborde aussi à droite (« A |
| N12 | ✅ | un courriel abandonné : en attente 11 → 10 ; file : PENDING 10, ABANDONED 1 |
| N13 | ✅ | /dashboard/systeme/paiements : HTTP 200, rendu ; paiement\|rappel\|webhook présents — 3 rappels reçus en base |
| N14 | ✅ | /dashboard/systeme/versements : HTTP 200, rendu ; versement présents — 0 versement(s) en base |
| N15 | ✅ | /dashboard/systeme/versements : « Marquer envoyé… » + trace écrite → Payout CREATING → PROCESSING |
| O1 | ✅ | /signalement/deposer servi SANS compte : formulaire de l'article 47, « Déposer la notification » |
| O2 | ✅ | profession laissée vide → ENREGISTRÉE : réf. NOT-2026-002, état INCOMPLETE, date 2026-09-25 09:23:33, missingElements « notifiant », échéance aucune ; l'écran : « il lui manque un élément que la loi exige. Tant qu'ils manquent, nous ne pouvons pas la tr ». NB : les champs marqués required (nom, adresse, correspondance…) empêchent, eux, TOUT envoi incomplet — le commentaire du formulaire les dit «  |
| O3 | ❌ | Aucun moyen de COMPLÉTER le dossier NOT-2026-002 : aucun écran ni action serveur n'expose completer() (appelée seulement par les tests). Renvoyer le formulaire complet crée un SECOND dossier : NOT-2026-002 INCOMPLETE 09:23:33 ; NOT-2026-003 RECUE 09:23:42. Le premier reste INCOMPLETE pour toujours, et la date de première tentative (2026-09-25 09:23:33) — que la conception veut préserver « parce qu |
| O4 | ❌ | Aucun contrôle pour rattacher le dossier au compte visé (contrôles trouvés : aucun). L'action rapprocherDUnCompte existe (lib/juridique/actions.ts) mais n'est appelée par aucun écran. targetUserId reste nul : l'auteur ne sera ni prévenu (avisEnvoye faux) ni capable de voir le dossier (dossiersDeLAuteur filtre sur targetUserId). |
| O5 | ✅ | retrait provisoire : Product SUSPENDED ; /products/qa-prix-libre-mug4vng3 → 404 ; absent de /explore ; recherche « QA Prix libre » : plus trouvée |
| O6 | ❌ | DÉFAUT DE LA v1.69.0 (mon code d’hier). Le bilan (« Ces adresses ne désignent aucune ressource… ») n’apparaît JAMAIS : il est gardé dans l’état du composant RetirerProvisoirement, et ce composant est démonté dès que le dossier passe en RETRAIT_PROVISOIRE (revalidatePath → la carte affiche Trancher à la place). Calculé, renvoyé, perdu. Mesuré le 25/09 : après le clic, la carte montre « Retrait défi |
| O7 | ✅ | fiche du créateur : pastille « Retirée (juridique) » + « Retrait à titre provisoire. Dossier NOT-2026-001… » + lien « Répondre » |
| O8 | ✅ | geste du créateur refusé (?erreur=retrait-juridique) : ressource intacte, toujours SUSPENDED ; message : « Cette ressource fait l'objet d'une notification juridique : tu ne peux ni la publier, ni la modifier, ni la supprimer tant que le dossier n'est pas tr » |
| O9 | ✅ | l'acheteur (qui a payé 5 000 F) : HTTP 403, « Cette ressource fait l'objet d'une notification juridique et n'est plus distribuée le temps que le dossier soit tranché. Son créateur n'y peut rien. » |
| O10 | ❌ | Le créateur NE VOIT PAS le dossier dans « Mes dossiers » (le lien « Répondre » de sa fiche y mène, vers une page vide) : targetUserId nul, et rien ne permet de le poser (O4). Écran de réponse éprouvé après rattachement EN BASE : réponse envoyée → dossier CONTESTEE. |
| O11 | ✅ | « Remettre en ligne » + motif : dossier RESTAUREE, ressource rendue à son état d'avant (PUBLISHED) ; fiche publique HTTP 200 ; téléchargement de l'acheteur HTTP 302 (redirection vers le fichier signé : il est de nouveau servi) |
| O12 | ✅ | nouvelle ressource publiée puis visée : retrait provisoire puis « Retrait définitif » + motif → dossier RETIREE, ressource toujours SUSPENDED, ligne de suspension toujours ouverte (1) |
| P1 | ✅ | /api/health : HTTP 200 sans authentification — {"etat":"ok","base":"ok","stockage":"configure","fonctionnalites":{"envoi_fichiers":"ouverte","versements":"ouverte"}} |
| P2 | ✅ | /api/cron/versements sans secret : HTTP 404 (pas 401 : rien ne confirme que la route existe) |
| P3 | ✅ | /api/cron/courriels sans secret : HTTP 404 (pas 401 : rien ne confirme que la route existe) |
| P4 | ✅ | /api/cron/commandes sans secret : HTTP 404 (pas 401 : rien ne confirme que la route existe) |
| P5 | ✅ | /api/cron/abonnements sans secret : HTTP 404 (pas 401 : rien ne confirme que la route existe) |
| P6 | ✅ | /api/cron/blog AVEC secret : HTTP 200, bilan {"vus":0,"publies":0} |
| P7 | ✅ | /api/cron/juridique AVEC secret : HTTP 200, bilan {"clos":0} |
| P8 | ✅ | /api/cron/securite sans secret : HTTP 404 (pas 401 : rien ne confirme que la route existe) |
| P9 | ✅ | webhook bac-à-sable sans signature : HTTP 401 (refusé) ; fournisseur inconnu : HTTP 404 |
| P10 | ✅ | /api/telechargement sans session : HTTP 307 → http://localhost:3100/connexion |
