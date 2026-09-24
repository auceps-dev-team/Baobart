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
| A1 | `/` | L'accueil, vignettes chargées, aucun rectangle gris | ☐ |
| A2 | `/explore` | La mosaïque, le rail latéral des familles, le filtre vidéo | ☐ |
| A3 | `/explore` + filtre famille | La liste se réduit, l'URL porte le filtre | ☐ |
| A4 | `/products/<slug>` | La fiche : visuel, prix, créateur, bouton d'action | ☐ |
| A5 | Vignette cliquée depuis `/explore` | La fiche s'ouvre **en modale** sans quitter la liste | ☐ |
| A6 | `/createurs` | L'annuaire des créateurs | ☐ |
| A7 | `/createurs/<username>` | Le profil public, ses ressources | ☐ |
| A8 | `/blog` | La liste des articles publiés | ☐ |
| A9 | `/blog/<slug>` | L'article, sa date, son auteur | ☐ |
| A10 | `/communautes` | Les communautés ouvertes | ☐ |
| A11 | `/communautes/<slug>` | Le fil, en lecture | ☐ |
| A12 | `/evenements` | Les événements à venir | ☐ |
| A13 | `/evenements/<id>` | La fiche, la date, le bouton d'inscription | ☐ |
| A14 | `/jobs` | Les offres publiées | ☐ |
| A15 | `/jobs/<id>` | L'offre entière, le bouton « postuler » | ☐ |
| A16 | `/services` | Les services proposés | ☐ |
| A17 | `/services/<id>` | La fiche du service, son tarif | ☐ |
| A18 | `/signalement` | La page publique : ce que dit la loi, ce que promet Baobart | ☐ |
| A19 | `/signalement/deposer` | Le formulaire de notification, **ouvert sans compte** | ☐ |
| A20 | `/products/slug-qui-nexiste-pas` | Un 404 dessiné, pas une page blanche | ☐ |

### B · Compte et sécurité

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| B1 | `/inscription` → créer un compte | Connexion immédiate, arrivée sur `/dashboard` | ☐ |
| B2 | `/connexion` avec `client@baobart.test` | Arrivée sur l'espace personnel | ☐ |
| B3 | `/connexion` avec un mauvais mot de passe | Message d'erreur, **sans dire lequel des deux est faux** | ☐ |
| B4 | `/mot-de-passe-oublie` | Le formulaire, puis un message neutre | ☐ |
| B5 | `/reinitialiser/<jeton>` avec un jeton bidon | Refus explicite | ☐ |
| B6 | Se déconnecter | Retour public, `/dashboard` renvoie vers `/connexion` | ☐ |
| B7 | `/dashboard/profil` → activer la double authentification | Un QR code + des codes de secours **affichés une seule fois** | ☐ |
| B8 | Se déconnecter, se reconnecter | `/connexion/verification` demande le code à six chiffres | ☐ |
| B9 | Entrer un code faux | Refus, sans consommer la tentative de façon définitive | ☐ |
| B10 | Renouveler les codes de secours | De nouveaux codes, les anciens invalides | ☐ |
| B11 | Couper la double authentification | La connexion suivante ne demande plus de code | ☐ |
| B12 | `/dashboard/profil` → ajouter une clé d'accès (WebAuthn) | Le navigateur propose son authentificateur | ☐ |
| B13 | Se connecter par clé d'accès | Connexion sans mot de passe | ☐ |
| B14 | Retirer la clé | Elle disparaît de la liste | ☐ |
| B15 | `/dashboard/profil` → demander l'effacement RGPD | Un délai annoncé, et un bouton pour annuler | ☐ |
| B16 | Annuler l'effacement | La demande disparaît | ☐ |

### C · Créateur — les ressources

Connecté en `createur@baobart.test`.

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| C1 | `/dashboard` | Le résumé : ressources, ventes, gains | ☐ |
| C2 | `/dashboard/produits` | La liste, avec le statut de chacune | ☐ |
| C3 | `/dashboard/produits/nouveau` | Le formulaire de dépôt | ☐ |
| C4 | Créer un brouillon | Redirection vers sa fiche, statut « Brouillon » | ☐ |
| C5 | `/dashboard/produits/<id>` | La fiche d'administration complète | ☐ |
| C6 | Téléverser un fichier source | Barre de progression, puis le fichier listé | ☐ |
| C7 | Téléverser une couverture | La vignette apparaît | ☐ |
| C8 | Retirer un fichier | Il disparaît de la liste | ☐ |
| C9 | Publier | Statut « En ligne », visible dans `/explore` | ☐ |
| C10 | Modifier le titre d'une ressource **publiée** | Le titre change, **le slug ne bouge pas** | ☐ |
| C11 | Dépublier | Retour « Brouillon », absente de `/explore` | ☐ |
| C12 | Supprimer une ressource jamais vendue | Elle disparaît | ☐ |
| C13 | Panneau « Montant et pourboire » | Mode de prix, pourboire, parité | ☐ |
| C14 | Passer en mode « L'acheteur décide » | Champs minimum + montants suggérés | ☐ |
| C15 | Activer le pourboire | La case est retenue | ☐ |
| C16 | Activer la parité de pouvoir d'achat | Le champ « réduction maximale » apparaît, avec l'avertissement « aucun coefficient chargé » | ☐ |
| C17 | `/dashboard/promos` | Codes promo, upsell, champs personnalisés | ☐ |
| C18 | Créer un code promo | Il apparaît dans la liste | ☐ |
| C19 | Retirer un code promo | Il disparaît | ☐ |
| C20 | Déclarer un upsell | Enregistré, visible | ☐ |
| C21 | Basculer un upsell | L'état change | ☐ |
| C22 | Déclarer un champ personnalisé | Enregistré | ☐ |
| C23 | Retirer un champ personnalisé | Il disparaît | ☐ |
| C24 | `/dashboard/boutique` | Les réglages de la vitrine | ☐ |
| C25 | `/dashboard/collections` | Les collections | ☐ |
| C26 | `/dashboard/statistiques` | Les chiffres, non vides après une vente | ☐ |
| C27 | `/dashboard/avis` | Les avis reçus | ☐ |
| C28 | `/dashboard/suivis` | Qui suit le compte | ☐ |

### D · Achat et livraison

Connecté en `client@baobart.test`, sur une ressource de `db:seed:demo` (avec prix).

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| D1 | `/products/<slug>` payante | Le bouton « Acheter » visible | ☐ |
| D2 | `/acheter/<slug>` | Le passage en caisse : montant, moyen de paiement | ☐ |
| D3 | Ressource en mode libre | Le champ « combien veux-tu donner », les boutons suggérés | ☐ |
| D4 | Ressource avec pourboire ouvert | Le champ pourboire, facultatif | ☐ |
| D5 | Ressource avec champs personnalisés | Les questions du créateur | ☐ |
| D6 | Appliquer un code promo | Le montant baisse, l'écran le dit | ☐ |
| D7 | Payer (bac à sable) | Redirection vers `/achat/<orderId>` | ☐ |
| D8 | `/achat/<orderId>` | L'état de la commande | ☐ |
| D9 | Déclencher le rappel (bac à sable) | La commande passe à « payée » | ☐ |
| D10 | Après paiement | L'upsell apparaît, s'il y en a un | ☐ |
| D11 | `/dashboard/achats` | La ressource achetée y figure | ☐ |
| D12 | `/dashboard/telechargements` | Le lien de téléchargement | ☐ |
| D13 | Télécharger | Le fichier arrive vraiment sur le disque | ☐ |
| D14 | Ressource à 0 F | Pas de bouton d'achat, téléchargement direct | ☐ |

### E · L'argent — côté créateur

Connecté en `createur@baobart.test`, après au moins une vente.

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| E1 | `/dashboard/ventes` | La vente apparue | ☐ |
| E2 | `/dashboard/gains` | Le solde, frais déduits | ☐ |
| E3 | `/dashboard/commandes` | Les commandes reçues | ☐ |
| E4 | Agir sur une vente (rembourser / contester) | L'état change, le solde suit | ☐ |
| E5 | `/dashboard/versements` | L'historique et la cadence | ☐ |
| E6 | Enregistrer un compte de versement | Le compte est retenu | ☐ |
| E7 | Enregistrer une cadence | La cadence est retenue | ☐ |
| E8 | `/dashboard/commissions` | Les commandes sur mesure | ☐ |
| E9 | `/dashboard/forfait` | Le forfait courant et ses limites | ☐ |

### F · Social et découverte

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| F1 | Aimer une ressource | Le compteur monte, l'état persiste au rechargement | ☐ |
| F2 | Retirer le « j'aime » | Le compteur redescend | ☐ |
| F3 | Suivre un créateur | Le bouton bascule | ☐ |
| F4 | Ne plus suivre | Il rebascule | ☐ |
| F5 | Commenter une ressource | Le commentaire apparaît | ☐ |
| F6 | Retirer son commentaire | Il disparaît | ☐ |
| F7 | `/api/recherche?q=…` | Des résultats en JSON | ☐ |
| F8 | `/api/feed` | La page suivante du fil | ☐ |
| F9 | Défilement infini sur `/explore` | La suite se charge sans doublon | ☐ |

### G · Communautés et forum

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| G1 | `/communautes/nouvelle` | Le formulaire d'ouverture | ☐ |
| G2 | Ouvrir une communauté | Elle apparaît dans `/communautes` | ☐ |
| G3 | Rejoindre | Le fil devient accessible en écriture | ☐ |
| G4 | Écrire dans le fil | Le message apparaît | ☐ |
| G5 | Retirer son message | Il disparaît | ☐ |
| G6 | Signaler un message | Confirmation, le message entre en file | ☐ |
| G7 | Partager une collection | Elle apparaît dans le fil | ☐ |
| G8 | Retirer la collection partagée | Elle disparaît | ☐ |
| G9 | Quitter la communauté | L'écriture se referme | ☐ |
| G10 | Modérateur : lever un signalement | Le message reste, la file se vide | ☐ |
| G11 | Modérateur : retirer un message signalé | Le message disparaît du fil | ☐ |
| G12 | Modérateur : fermer une communauté | Elle sort de la liste publique | ☐ |

### H · Emplois

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| H1 | `/jobs/deposer` | Le formulaire | ☐ |
| H2 | Déposer une offre | Elle part en relecture, pas en ligne | ☐ |
| H3 | `/jobs/mes-propositions` | L'offre déposée, son état | ☐ |
| H4 | Modérateur : trancher l'offre | Elle passe en ligne, ou est refusée avec motif | ☐ |
| H5 | `/jobs/<id>/postuler` | Le formulaire de candidature, avec CV | ☐ |
| H6 | Envoyer une candidature | Confirmation | ☐ |
| H7 | `/dashboard/jobs/<id>/candidatures` | Les candidatures reçues | ☐ |
| H8 | `/api/jobs/candidatures/<id>/cv` | Le CV se télécharge — **et seulement par le recruteur** | ☐ |
| H9 | Modérateur : basculer la vérification d'un recruteur | Le badge change | ☐ |

### I · Services

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| I1 | `/services/deposer` | Le formulaire | ☐ |
| I2 | Déposer un service | Il part en relecture | ☐ |
| I3 | Modérateur : trancher le service | En ligne, ou refusé avec motif | ☐ |
| I4 | `/services/<id>` → contacter | Le contact part | ☐ |

### J · Événements

Connecté en `agence@baobart.test` pour la création.

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| J1 | `/dashboard/evenements/nouveau` | Le formulaire | ☐ |
| J2 | Créer un événement | Il part en relecture | ☐ |
| J3 | `/dashboard/evenements/<id>` | La fiche, modifiable | ☐ |
| J4 | Modifier | Les changements tiennent | ☐ |
| J5 | Modérateur : trancher | En ligne, ou refusé avec motif | ☐ |
| J6 | `/evenements/<id>` → s'inscrire | Confirmation, place comptée | ☐ |
| J7 | Se désinscrire | La place se libère | ☐ |
| J8 | `/dashboard/evenements/<id>/inscrits` | La liste | ☐ |
| J9 | `/api/evenements/<id>/inscrits` | L'export, réservé à l'organisateur | ☐ |
| J10 | Annuler l'événement | Les inscrits sont prévenus | ☐ |
| J11 | Rétablir l'événement | Il revient | ☐ |

### K · Blog

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| K1 | `/dashboard/blog/nouveau` | L'éditeur | ☐ |
| K2 | Créer un article | Enregistré en brouillon | ☐ |
| K3 | Téléverser une image d'article | Elle s'insère | ☐ |
| K4 | Modifier | Les changements tiennent | ☐ |
| K5 | Planifier une publication | La date est retenue | ☐ |
| K6 | Soumettre à relecture | L'article entre dans la file | ☐ |
| K7 | Relecteur : trancher avec motif | Publié, ou renvoyé avec la raison | ☐ |
| K8 | `/blog/<slug>` | L'article en ligne | ☐ |

### L · Abonnements

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| L1 | `/dashboard/abonnements` | Les abonnements en cours | ☐ |
| L2 | `/abonnement/<id>/renouveler` | L'écran de renouvellement | ☐ |
| L3 | Renouveler | Le cycle repart | ☐ |
| L4 | `/abonnement/<id>/paiement/<paiementId>` | L'état du paiement | ☐ |
| L5 | Déclencher le rappel d'abonnement (bac à sable) | Le paiement aboutit | ☐ |

### M · Notifications

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| M1 | `/dashboard/notifications` | La liste, les non-lues distinguées | ☐ |
| M2 | Marquer une notification lue | Elle change d'aspect | ☐ |
| M3 | Tout marquer lu | Le compteur tombe à zéro | ☐ |
| M4 | `/dashboard/notifications/reglages` | Les préférences par événement | ☐ |
| M5 | Couper un canal | Le réglage tient au rechargement | ☐ |
| M6 | Activer les notifications navigateur | L'appareil s'enregistre | ☐ |
| M7 | Retirer l'appareil | Il disparaît | ☐ |

### N · Exploitation — `admin@baobart.test`

| # | Écran | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| N1 | `/dashboard/moderation` | La file unique : jobs, services, événements, blog | ☐ |
| N2 | `/dashboard/signalements` | Les dossiers juridiques et les signalements | ☐ |
| N3 | `/dashboard/systeme/configuration` | L'état de la configuration | ☐ |
| N4 | `/dashboard/systeme/membres` | Les comptes et leurs rôles | ☐ |
| N5 | Changer le rôle d'un membre | Le rôle change | ☐ |
| N6 | Décider du sort d'un compte (risque) | Les effets s'appliquent | ☐ |
| N7 | `/dashboard/systeme/blocklist` | Les objets bloqués | ☐ |
| N8 | Poser un blocage | Il apparaît | ☐ |
| N9 | Lever un blocage | Il disparaît | ☐ |
| N10 | `/dashboard/systeme/emails` | La file d'envoi | ☐ |
| N11 | Relancer un courriel | Il repasse en attente | ☐ |
| N12 | Abandonner un courriel | Il sort de la file | ☐ |
| N13 | `/dashboard/systeme/paiements` | Les webhooks reçus, leur état | ☐ |
| N14 | `/dashboard/systeme/versements` | Les versements à faire | ☐ |
| N15 | Faire passer un versement | L'état change | ☐ |

### O · Juridique et conformité

| # | Geste | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| O1 | `/signalement/deposer` sans compte | Le formulaire accepte le dépôt | ☐ |
| O2 | Déposer une notification **incomplète** | Elle est **enregistrée** avec sa référence, et l'écran dit ce qui manque | ☐ |
| O3 | Compléter la notification | La référence et la date d'origine ne changent pas | ☐ |
| O4 | Modérateur : rapprocher d'un compte | Le compte visé apparaît | ☐ |
| O5 | Modérateur : retirer à titre provisoire | La ressource visée **disparaît de `/explore` et rend 404** | ☐ |
| O6 | Vérifier le bilan affiché | Il nomme les adresses qu'il n'a **pas** atteintes | ☐ |
| O7 | Créateur : ouvrir sa ressource retirée | Pastille « Retirée (juridique) » + la référence du dossier | ☐ |
| O8 | Créateur : tenter de publier | Refus expliqué, renvoi vers « Mes dossiers » | ☐ |
| O9 | Acheteur : tenter de télécharger | Refus expliqué | ☐ |
| O10 | `/dashboard/mes-dossiers` → répondre | La réponse part, le dossier passe en contestée | ☐ |
| O11 | Modérateur : trancher « remise en ligne » | La ressource revient **à l'état qu'elle avait** | ☐ |
| O12 | Modérateur : trancher « retrait définitif » | Elle reste retirée | ☐ |

### P · Routes d'API et ordonnanceur

Les routes `cron` exigent le secret. Sans lui : 404, jamais 401 — une 401
confirmerait l'existence de la route.

| # | Route | Ce qu'on doit voir | |
| --- | --- | --- | --- |
| P1 | `/api/health` | Un état, sans authentification | ☐ |
| P2 | `/api/cron/versements` sans secret | 404 | ☐ |
| P3 | `/api/cron/courriels` sans secret | 404 | ☐ |
| P4 | `/api/cron/commandes` sans secret | 404 | ☐ |
| P5 | `/api/cron/abonnements` sans secret | 404 | ☐ |
| P6 | `/api/cron/blog` **avec** secret | Un bilan JSON, articles publiés | ☐ |
| P7 | `/api/cron/juridique` **avec** secret | Un bilan JSON | ☐ |
| P8 | `/api/cron/securite` sans secret | 404 | ☐ |
| P9 | `/api/paiements/<fournisseur>/webhook` | Répond, et n'accepte pas n'importe quoi | ☐ |
| P10 | `/api/telechargement/<fichierId>` non connecté | Renvoi vers la connexion | ☐ |

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
