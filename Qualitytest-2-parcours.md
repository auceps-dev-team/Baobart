# Qualitytest — Niveau 2 : les parcours

**Le niveau 1 demandait si l'écran s'ouvre. Celui-ci demande si la chaîne
aboutit — et si ce qu'elle laisse derrière elle est juste.**

La différence tient en un exemple. « L'écran des gains s'ouvre et affiche
4 250 F » coche une case au niveau 1. Elle ne dit pas si 4 250 est le bon
nombre, ni si les frais retenus correspondent à ceux que l'acheteur a payés, ni
si le total se retrouve quelque part. Un écran peut afficher un chiffre faux
avec une parfaite assurance.

**Ce niveau vérifie donc en base, pas seulement à l'écran.** Chaque parcours
finit par une requête. C'est ce qui le distingue du précédent.

---

## Comment lire une vérification

Toutes les requêtes passent par le conteneur :

```sh
docker exec baobart-postgres psql -U baobart -d baobart -c "…"
```

Le port hôte est **5433**, jamais 5432. Si `psql` refuse la connexion, vérifier
`docker ps` avant de soupçonner le code : le port-forward de Docker cède
parfois sous la charge, et ce n'est pas un défaut de l'application.

---

## P1 · La chaîne de l'argent

**La plus importante, et la seule dont l'erreur ne se rattrape pas.** Un écran
faux se corrige ; un versement faux a quitté la maison.

### Le parcours

1. `createur@` publie une ressource à **10 000 F**.
2. `client@` l'achète, sans code promo, sans pourboire.
3. Le paiement aboutit (bac à sable → « déclencher le rappel »).
4. `createur@` ouvre `/dashboard/gains`.

### L'invariante

Elle est écrite dans `lib/domain/fees.ts` et elle ne souffre aucune exception :

```
brut = net vendeur + commission plateforme + frais opérateur + part affilié
```

La **taxe est en dehors** de cette égalité : elle est collectée en plus, pas
prélevée dedans. Confondre les deux fait un écart qu'on cherche des heures.

### La vérification

```sql
SELECT
  "price" * "quantity" + "tipAmount"          AS brut,
  "platformFee", "processorFee", "affiliateFee", "taxAmount",
  "price" * "quantity" + "tipAmount"
    - "platformFee" - "processorFee" - "affiliateFee"  AS net_attendu
FROM "OrderItem"
ORDER BY "id" DESC LIMIT 5;
```

| À vérifier | |
| --- | --- |
| `net_attendu` est positif | ☐ |
| `net_attendu` égale le montant crédité au solde du vendeur | ☐ |
| L'écran `/dashboard/gains` affiche ce même nombre | ☐ |
| `taxAmount` n'est **pas** soustrait du net | ☐ |

```sql
-- Le solde doit avoir reçu exactement ce net.
SELECT "type", "issuedNet", "createdAt"
FROM "BalanceTransaction" ORDER BY "createdAt" DESC LIMIT 5;
```

### Le pourboire, qui est le piège

Un pourboire s'ajoute **une fois**, pas par unité. Sur une commande de trois
exemplaires à 10 000 F avec 2 000 F de pourboire, le brut est **32 000**, pas
36 000.

| À vérifier | |
| --- | --- |
| Acheter 3 exemplaires avec pourboire → `brut = price × 3 + tip`, une seule fois | ☐ |
| Le pourboire figure dans le net du vendeur, frais déduits comme le reste | ☐ |

---

## P2 · La chaîne de la livraison

Acheter ne suffit pas : encore faut-il que le fichier arrive.

1. Achat abouti (P1).
2. `/dashboard/telechargements` → le lien existe.
3. Cliquer → **le fichier arrive sur le disque**, avec le bon nom et une taille
   non nulle.

| À vérifier | |
| --- | --- |
| Le fichier téléchargé s'ouvre vraiment (ce n'est pas une page d'erreur renommée) | ☐ |
| Un second téléchargement fonctionne aussi | ☐ |
| Le compteur de téléchargements de la ressource a monté | ☐ |

```sql
SELECT "eventType", "consumedAt" FROM "ConsumptionEvent"
ORDER BY "consumedAt" DESC LIMIT 5;
```

| À vérifier | |
| --- | --- |
| Un `ConsumptionEvent` par téléchargement, pas zéro, pas deux | ☐ |

**Le cas qui manque le plus souvent :** une ressource **sans fichier source**.
La publication doit la refuser. Si elle passe, l'acheteur paie et ne reçoit
rien — et l'erreur se découvre du côté de l'acheteur, c'est-à-dire trop tard.

---

## P3 · La chaîne du remboursement

Elle doit défaire exactement ce que l'achat a fait, ni plus ni moins.

1. Achat abouti.
2. `createur@` → `/dashboard/ventes` → rembourser.
3. Vérifier **trois** choses, pas une.

| À vérifier | |
| --- | --- |
| `OrderItem.refundedAmount` porte le montant rendu | ☐ |
| Le solde du vendeur a **baissé** du net correspondant | ☐ |
| L'acheteur ne peut **plus** télécharger | ☐ |

```sql
SELECT "refundedAmount", "state" FROM "OrderItem" ORDER BY "id" DESC LIMIT 3;
SELECT "type", "issuedNet" FROM "BalanceTransaction" ORDER BY "createdAt" DESC LIMIT 3;
```

**Le pourboire fait partie de la base remboursable.** Un remboursement qui
ignore le pourboire rend moins que ce qui a été encaissé, et personne ne s'en
plaint — sauf l'acheteur, six mois plus tard.

---

## P4 · La chaîne du code promo

Le compteur d'utilisations est la partie fragile : il doit monter quand le code
sert, et **redescendre** quand la vente échoue.

1. `createur@` crée un code, limité à **2 utilisations**.
2. `client@` achète avec le code → le montant baisse.
3. Un second achat avec le code → le montant baisse encore.
4. Un troisième → **refusé**.

| À vérifier | |
| --- | --- |
| Le montant réduit est bien celui facturé, pas seulement affiché | ☐ |
| `OfferCode.usesCount` vaut 2 après deux achats | ☐ |
| Le troisième achat est refusé avec un motif lisible | ☐ |

```sql
SELECT "code", "usesCount", "maxUses", "disabledAt" FROM "OfferCode";
```

### Le cas qui compte : l'achat qui échoue

5. Créer un code à 1 utilisation.
6. Lancer un achat avec ce code, puis **faire échouer le paiement** (bac à
   sable → refus).

| À vérifier | |
| --- | --- |
| `usesCount` est **revenu à 0** | ☐ |
| Le code est réutilisable | ☐ |

Si le compteur reste à 1, le code est brûlé par un paiement qui n'a jamais eu
lieu. Rien ne plante ; le créateur constate simplement que son code « ne marche
plus ».

---

## P5 · La chaîne du montant libre et de la parité

1. Passer une ressource en mode « L'acheteur décide », minimum **2 000 F**,
   suggestions `2000, 5000, 10000`.
2. `/acheter/<slug>` : les trois boutons préremplissent le champ.

| À vérifier | |
| --- | --- |
| Donner **1 000** (sous le minimum) → refusé | ☐ |
| Donner **5 000** → `OrderItem.price` vaut 5 000, pas le prix de la fiche | ☐ |
| Donner un texte non numérique → **refusé**, et non traité comme 0 | ☐ |
| Une ressource à 0 F en mode libre **s'achète** (0 = « pas de suggestion ») | ☐ |

Le troisième point est celui qui a déjà été faux : un `?? 0` silencieux
transformait une saisie invalide en don de zéro franc, sans message.

### La parité

| À vérifier | |
| --- | --- |
| Activer la parité, plafond 30 % → l'écran avertit qu'aucun coefficient n'est chargé | ☐ |
| Acheter en déclarant un pays → `OrderItem.pppDiscountBp` vaut **0** | ☐ |
| Le prix payé est **inchangé** | ☐ |

C'est le comportement attendu, pas un défaut : la table des coefficients est
livrée vide, et le rester tant que personne n'y charge de valeurs sourcées.

---

## P6 · La chaîne de l'abandon et de la relance

1. Lancer un achat en mobile money, **ne pas payer**.
2. Attendre, ou avancer l'horloge en base.
3. Appeler `/api/cron/commandes` avec le secret.

| À vérifier | |
| --- | --- |
| La commande passe en `ABANDONED` après le délai | ☐ |
| Une relance est créée — **une seule** | ☐ |
| Le code promo éventuel est **rendu** | ☐ |
| Un second passage du cron ne crée pas de doublon | ☐ |

```sql
SELECT "orderId", "envoyeeLe" FROM "RelancePaiement" ORDER BY "envoyeeLe" DESC;
```

---

## P7 · La chaîne de l'upsell

1. `createur@` déclare un upsell : après l'achat de A, proposer B.
2. `client@` achète A.

| À vérifier | |
| --- | --- |
| L'offre B apparaît après le paiement de A | ☐ |
| Elle **n'apparaît pas** si le client possède déjà B | ☐ |
| Elle n'apparaît pas si l'achat de A a échoué | ☐ |
| Elle n'apparaît pas si l'upsell est désactivé | ☐ |

---

## P8 · La chaîne de l'abonnement

1. Souscrire.
2. `/dashboard/abonnements` → l'abonnement est actif, avec sa prochaine
   échéance.
3. `/abonnement/<id>/renouveler` → renouveler.
4. Bac à sable → déclencher le rappel d'abonnement.

| À vérifier | |
| --- | --- |
| Le cycle repart, la prochaine échéance avance | ☐ |
| Un `SubscriptionPayment` est créé et passe à payé | ☐ |
| Le quota de téléchargements de l'abonné est remis | ☐ |
| `/api/cron/abonnements` avec secret : les rappels partent une fois | ☐ |

**Le cas qui compte : l'échec.** Faire échouer le renouvellement.

| À vérifier | |
| --- | --- |
| L'abonnement ne passe pas silencieusement à « actif » | ☐ |
| L'abonné est prévenu | ☐ |
| Ses téléchargements sont refusés avec un motif qui dit quoi faire | ☐ |

---

## P9 · La chaîne de la modération

Quatre contenus l'empruntent — emplois, services, événements, blog — et la file
est **unique**.

1. Déposer un contenu de chaque type.
2. `admin@` → `/dashboard/moderation`.

| À vérifier | |
| --- | --- |
| Les quatre types apparaissent dans la même file, triés par ancienneté | ☐ |
| Refuser **sans motif** est impossible | ☐ |
| Le refus prévient l'auteur, avec la raison | ☐ |
| L'acceptation met le contenu en ligne, visible publiquement | ☐ |
| Un contenu tranché ne revient pas dans la file | ☐ |

**La règle qui se vérifie mal à l'œil :** la file ne montre que ce que le rôle
connecté peut trancher. Se connecter avec un rôle qui n'a que
`publier_du_contenu` et vérifier qu'il ne voit pas les offres d'emploi, qui
exigent `moderer_le_contenu`.

---

## P10 · La chaîne du retrait juridique

Livrée en v1.69.0, et la plus récente — donc la moins éprouvée en vrai.

1. `/signalement/deposer` sans compte, avec une adresse `/products/<slug>` qui
   existe vraiment.
2. `admin@` → `/dashboard/signalements` → rapprocher d'un compte.
3. Retirer à titre provisoire.

| À vérifier | |
| --- | --- |
| La ressource **disparaît de `/explore`** | ☐ |
| `/products/<slug>` rend **404** | ☐ |
| L'acheteur qui l'avait achetée ne peut **plus la télécharger** | ☐ |
| Le créateur voit la pastille « Retirée (juridique) » et la **référence** du dossier | ☐ |
| Il ne peut ni publier, ni modifier, ni supprimer, ni dépublier | ☐ |
| L'écran du modérateur nomme les adresses **non atteintes** | ☐ |

```sql
SELECT p."slug", p."status", s."previousStatus", s."liftedAt"
FROM "LegalSuspension" s JOIN "Product" p ON p."id" = s."productId";
```

4. Trancher « remise en ligne ».

| À vérifier | |
| --- | --- |
| La ressource revient à **l'état qu'elle avait**, pas « publiée » par défaut | ☐ |
| Le téléchargement redevient possible | ☐ |
| `liftedAt` est renseigné | ☐ |

**Le cas à refaire depuis un brouillon :** retirer une ressource en brouillon,
puis la restaurer. Elle doit revenir **brouillon**. Si elle revient publiée, la
restauration a publié le travail de quelqu'un sans qu'il l'ait demandé.

---

## P11 · La chaîne du versement

1. Accumuler un solde (P1, plusieurs ventes).
2. `createur@` → enregistrer un compte de versement et une cadence.
3. `/api/cron/versements` avec le secret.
4. `admin@` → `/dashboard/systeme/versements` → faire passer.

| À vérifier | |
| --- | --- |
| Le versement porte exactement le solde disponible | ☐ |
| Le solde retombe à zéro après le versement | ☐ |
| Un second passage du cron ne crée pas un second versement | ☐ |
| Sans compte de versement enregistré, rien n'est proposé | ☐ |

---

## P12 · La chaîne de la double authentification

1. Activer → noter les codes de secours.
2. Se déconnecter, se reconnecter → `/connexion/verification`.
3. Entrer un **code de secours** au lieu du code à six chiffres.

| À vérifier | |
| --- | --- |
| Le code de secours est accepté | ☐ |
| Le **même** code de secours est refusé la fois suivante | ☐ |
| Renouveler les codes invalide tous les anciens | ☐ |
| Couper la double authentification supprime le défi à la connexion suivante | ☐ |

---

## P13 · La chaîne de la publication planifiée

1. Créer un article, le planifier à une heure **passée**.
2. Créer un second article planifié dans le **futur**.
3. `/api/cron/blog` avec le secret.

| À vérifier | |
| --- | --- |
| Le premier est publié, visible sur `/blog` | ☐ |
| Le second ne l'est **pas** | ☐ |
| Un second passage immédiat ne republie rien | ☐ |
| Le bilan JSON dit combien ont été vus et combien publiés | ☐ |

---

## P14 · La chaîne de l'événement

1. `agence@` crée un événement à **2 places**.
2. Relecture, mise en ligne.
3. Deux comptes s'inscrivent.

| À vérifier | |
| --- | --- |
| Le troisième inscrit est refusé | ☐ |
| Une désinscription libère la place | ☐ |
| `/api/evenements/<id>/inscrits` n'est servi **qu'à l'organisateur** | ☐ |
| Annuler l'événement prévient les inscrits | ☐ |
| Rétablir le remet en ligne | ☐ |

---

## P15 · La chaîne de l'effacement RGPD

1. `client@` demande son effacement.
2. Attendre le délai, ou l'avancer en base.
3. Déclencher le passage d'effacement.

| À vérifier | |
| --- | --- |
| Le compte et le profil sont effacés | ☐ |
| Les **commandes** survivent — un acheteur garde ce qu'il a payé | ☐ |
| Les ressources du créateur passent en archivé, pas en supprimé | ☐ |
| Une ressource sous **retrait juridique** reste retirée, pas archivée | ☐ |
| Les adresses IP des événements de consommation sont effacées | ☐ |

---

## Ce que ce niveau ne dit pas

**Il ne teste que le chemin qui marche.** Chaque parcours ci-dessus décrit une
suite de gestes corrects menant à un résultat correct. Il ne dit rien de ce qui
arrive quand quelqu'un fait le mauvais geste, ou le bon geste au mauvais
moment, ou le geste de quelqu'un d'autre. C'est le niveau 3.

**Il suppose un seul utilisateur à la fois.** Deux modérateurs qui cliquent en
même temps, deux achats simultanés sur le dernier exemplaire : rien ici ne les
couvre. Niveau 3 également.

**Il croit ce que la base affirme.** Si une ligne dit `status = 'SUSPENDED'`,
ce niveau en conclut que la ressource est retirée. Il ne vérifie pas que
*toutes* les portes sont fermées — la fiche, le fil, le téléchargement, le
cache, l'index de recherche. C'est le niveau 4, et c'est exactement par là
qu'un défaut est passé en septembre.
