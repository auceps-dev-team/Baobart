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
| **P1.1**  **P1.1**  `net_attendu` est positif | ✅ |
| **P1.2**  **P1.2**  `net_attendu` égale le montant crédité au solde du vendeur | ✅ |
| **P1.3**  **P1.3**  L'écran `/dashboard/gains` affiche ce même nombre | ✅ |
| **P1.4**  **P1.4**  `taxAmount` n'est **pas** soustrait du net | 🚫 |

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
| **P1.5**  **P1.5**  Acheter 3 exemplaires avec pourboire → `brut = price × 3 + tip`, une seule fois (le tunnel n'a pas de sélecteur de quantité) *(ligne corrigée le 25/09)* | 🚫 |
| **P1.6**  **P1.6**  Le pourboire figure dans le net du vendeur, frais déduits comme le reste | ✅ |

---

## P2 · La chaîne de la livraison

Acheter ne suffit pas : encore faut-il que le fichier arrive.

1. Achat abouti (P1).
2. `/dashboard/telechargements` → le lien existe.
3. Cliquer → **le fichier arrive sur le disque**, avec le bon nom et une taille
   non nulle.

| À vérifier | |
| --- | --- |
| **P2.1**  **P2.1**  Le fichier téléchargé s'ouvre vraiment (ce n'est pas une page d'erreur renommée) | ✅ |
| **P2.2**  **P2.2**  Un second téléchargement fonctionne aussi | ✅ |
| **P2.3**  **P2.3**  Le compteur de téléchargements de la ressource a monté | ✅ |

```sql
SELECT "eventType", "consumedAt" FROM "ConsumptionEvent"
ORDER BY "consumedAt" DESC LIMIT 5;
```

| À vérifier | |
| --- | --- |
| **P2.4**  **P2.4**  Un `ConsumptionEvent` par téléchargement, pas zéro, pas deux | ✅ |

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
| **P3.1**  **P3.1**  `OrderItem.refundedAmount` porte le montant rendu | ✅ |
| **P3.2**  **P3.2**  Le solde du vendeur a **baissé** du net correspondant | ✅ |
| **P3.3**  **P3.3**  L'acheteur ne peut **plus** télécharger | ✅ |

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
| **P4.1**  **P4.1**  Le montant réduit est bien celui facturé, pas seulement affiché | ✅ |
| **P4.2**  **P4.2**  `OfferCode.usesCount` vaut 2 après deux achats | ✅ |
| **P4.3**  **P4.3**  Le troisième achat est refusé avec un motif lisible | ⚠️ |

```sql
SELECT "code", "usesCount", "maxUses", "disabledAt" FROM "OfferCode";
```

### Le cas qui compte : l'achat qui échoue

5. Créer un code à 1 utilisation.
6. Lancer un achat avec ce code, puis **faire échouer le paiement** (bac à
   sable → refus).

| À vérifier | |
| --- | --- |
| **P4.4**  **P4.4**  `usesCount` est **revenu à 0** | ✅ |
| **P4.5**  **P4.5**  Le code est réutilisable | ✅ |

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
| **P5.1**  **P5.1**  Donner **1 000** (sous le minimum) → refusé | ⚠️ |
| **P5.2**  **P5.2**  Donner **5 000** → `OrderItem.price` vaut 5 000, pas le prix de la fiche | ✅ |
| **P5.3**  **P5.3**  Donner un texte non numérique → **refusé**, et non traité comme 0 | ⚠️ |
| **P5.4**  **P5.4**  Une ressource à 0 F en mode libre **s'achète** (0 = « pas de suggestion ») | ❌ |

Le troisième point est celui qui a déjà été faux : un `?? 0` silencieux
transformait une saisie invalide en don de zéro franc, sans message.

### La parité

| À vérifier | |
| --- | --- |
| **P5.5**  **P5.5**  Activer la parité, plafond 30 % → l'écran avertit qu'aucun coefficient n'est chargé | ✅ |
| **P5.6**  **P5.6**  Acheter en déclarant un pays → `OrderItem.pppDiscountBp` vaut **0** | ✅ |
| **P5.7**  **P5.7**  Le prix payé est **inchangé** | ✅ |

C'est le comportement attendu, pas un défaut : la table des coefficients est
livrée vide, et le rester tant que personne n'y charge de valeurs sourcées.

---

## P6 · La chaîne de l'abandon et de la relance

1. Lancer un achat en mobile money, **ne pas payer**.
2. Attendre, ou avancer l'horloge en base.
3. Appeler `/api/cron/commandes` avec le secret.

| À vérifier | |
| --- | --- |
| **P6.1**  **P6.1**  La commande passe en `ABANDONED` après le délai | ✅ |
| **P6.2**  **P6.2**  Une relance est créée — **une seule** | ✅ |
| **P6.3**  **P6.3**  Le code promo éventuel est **rendu** | ✅ |
| **P6.4**  **P6.4**  Un second passage du cron ne crée pas de doublon | ✅ |

```sql
SELECT "orderId", "envoyeeLe" FROM "RelancePaiement" ORDER BY "envoyeeLe" DESC;
```

---

## P7 · La chaîne de l'upsell

1. `createur@` déclare un upsell : après l'achat de A, proposer B.
2. `client@` achète A.

| À vérifier | |
| --- | --- |
| **P7.1**  **P7.1**  L'offre B apparaît après le paiement de A | ✅ |
| **P7.2**  **P7.2**  Elle **n'apparaît pas** si le client possède déjà B | ✅ |
| **P7.3**  **P7.3**  Elle n'apparaît pas si l'achat de A a échoué | ✅ |
| **P7.4**  **P7.4**  Elle n'apparaît pas si l'upsell est désactivé | ✅ |

---

## P8 · La chaîne de l'abonnement

1. Souscrire.
2. `/dashboard/abonnements` → l'abonnement est actif, avec sa prochaine
   échéance.
3. `/abonnement/<id>/renouveler` → renouveler.
4. Bac à sable → déclencher le rappel d'abonnement.

| À vérifier | |
| --- | --- |
| **P8.1**  **P8.1**  Le cycle repart, la prochaine échéance avance | ✅ |
| **P8.2**  **P8.2**  Un `SubscriptionPayment` est créé et passe à payé | ✅ |
| **P8.3**  **P8.3**  Le quota de téléchargements est tenu par mois civil — un renouvellement ne le remet pas à zéro, le changement de mois si *(ligne corrigée le 25/09)* | ✅ |
| **P8.4**  **P8.4**  `/api/cron/abonnements` avec secret : les rappels partent une fois | ✅ |

**Le cas qui compte : l'échec.** Faire échouer le renouvellement.

| À vérifier | |
| --- | --- |
| **P8.5**  **P8.5**  L'abonnement ne passe pas silencieusement à « actif » | ✅ |
| **P8.6**  **P8.6**  L'abonné est prévenu | ✅ |
| **P8.7**  **P8.7**  Ses téléchargements sont refusés avec un motif qui dit quoi faire | ⚠️ |

---

## P9 · La chaîne de la modération

Quatre contenus l'empruntent — emplois, services, événements, blog — et la file
est **unique**.

1. Déposer un contenu de chaque type.
2. `admin@` → `/dashboard/moderation`.

| À vérifier | |
| --- | --- |
| **P9.1**  **P9.1**  Les quatre types apparaissent dans la même file, triés par ancienneté | ✅ |
| **P9.2**  **P9.2**  Refuser **sans motif** est impossible | ✅ |
| **P9.3**  **P9.3**  Le refus prévient l'auteur, avec la raison | ❌ |
| **P9.4**  **P9.4**  L'acceptation met le contenu en ligne, visible publiquement | ✅ |
| **P9.5**  **P9.5**  Un contenu tranché ne revient pas dans la file | ✅ |

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
| **P10.1**  **P10.1**  La ressource **disparaît de `/explore`** | ✅ |
| **P10.2**  **P10.2**  `/products/<slug>` rend **404** | ✅ |
| **P10.3**  **P10.3**  L'acheteur qui l'avait achetée ne peut **plus la télécharger** | ✅ |
| **P10.4**  **P10.4**  Le créateur voit la pastille « Retirée (juridique) » et la **référence** du dossier | ✅ |
| **P10.5**  **P10.5**  Il ne peut ni publier, ni modifier, ni supprimer, ni dépublier | ✅ |
| **P10.6**  **P10.6**  L'écran du modérateur nomme les adresses **non atteintes** | ❌ |

```sql
SELECT p."slug", p."status", s."previousStatus", s."liftedAt"
FROM "LegalSuspension" s JOIN "Product" p ON p."id" = s."productId";
```

4. Trancher « remise en ligne ».

| À vérifier | |
| --- | --- |
| **P10.7**  **P10.7**  La ressource revient à **l'état qu'elle avait**, pas « publiée » par défaut | ✅ |
| **P10.8**  **P10.8**  Le téléchargement redevient possible | ✅ |
| **P10.9**  **P10.9**  `liftedAt` est renseigné | ✅ |

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
| **P11.1**  **P11.1**  Le versement porte exactement le solde disponible | ✅ |
| **P11.2**  **P11.2**  Le solde retombe à zéro après le versement | ✅ |
| **P11.3**  **P11.3**  Un second passage du cron ne crée pas un second versement | ✅ |
| **P11.4**  **P11.4**  Sans compte de versement enregistré, rien n'est proposé | 🚫 |

---

## P12 · La chaîne de la double authentification

1. Activer → noter les codes de secours.
2. Se déconnecter, se reconnecter → `/connexion/verification`.
3. Entrer un **code de secours** au lieu du code à six chiffres.

| À vérifier | |
| --- | --- |
| **P12.1**  **P12.1**  Le code de secours est accepté | ✅ |
| **P12.2**  **P12.2**  Le **même** code de secours est refusé la fois suivante | ✅ |
| **P12.3**  **P12.3**  Renouveler les codes invalide tous les anciens | ✅ |
| **P12.4**  **P12.4**  Couper la double authentification supprime le défi à la connexion suivante | ✅ |

---

## P13 · La chaîne de la publication planifiée

1. Créer un article, le planifier à une heure **passée**.
2. Créer un second article planifié dans le **futur**.
3. `/api/cron/blog` avec le secret.

| À vérifier | |
| --- | --- |
| **P13.1**  **P13.1**  Le premier est publié, visible sur `/blog` | ✅ |
| **P13.2**  **P13.2**  Le second ne l'est **pas** | ✅ |
| **P13.3**  **P13.3**  Un second passage immédiat ne republie rien | ✅ |
| **P13.4**  **P13.4**  Le bilan JSON dit combien ont été vus et combien publiés | ✅ |

---

## P14 · La chaîne de l'événement

1. `agence@` crée un événement à **2 places**.
2. Relecture, mise en ligne.
3. Deux comptes s'inscrivent.

| À vérifier | |
| --- | --- |
| **P14.1**  **P14.1**  Le troisième inscrit est refusé | ✅ |
| **P14.2**  **P14.2**  Une désinscription libère la place | ✅ |
| **P14.3**  **P14.3**  `/api/evenements/<id>/inscrits` n'est servi **qu'à l'organisateur** | ✅ |
| **P14.4**  **P14.4**  Annuler l'événement prévient les inscrits | ✅ |
| **P14.5**  **P14.5**  Rétablir le remet en ligne | ✅ |

---

## P15 · La chaîne de l'effacement RGPD

1. `client@` demande son effacement.
2. Attendre le délai, ou l'avancer en base.
3. Déclencher le passage d'effacement.

| À vérifier | |
| --- | --- |
| **P15.1**  **P15.1**  Le compte et le profil sont effacés | ✅ |
| **P15.2**  **P15.2**  Les **commandes** survivent — un acheteur garde ce qu'il a payé | ✅ |
| **P15.3**  **P15.3**  Les ressources du créateur passent en archivé, pas en supprimé | ✅ |
| **P15.4**  **P15.4**  Une ressource sous **retrait juridique** reste retirée, pas archivée | ✅ |
| **P15.5**  **P15.5**  Les adresses IP des événements de consommation sont effacées | ✅ |

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

---

## Résultats — campagne du 25 septembre 2026

Même montage que le niveau 1 : build de production sur le port 3100, base de
développement, pilote `bac-a-sable`, courriels en console. Le remboursement
(P3) a été passé dans un **second montage en simulation**
(`CHECKOUT_SIMULATION_ENABLED=1`, aucun pilote) : le bac à sable ne sait pas
rembourser. Les délais qu'une campagne ne peut pas attendre — 2 h et 24 h
d'une commande impayée, 7 jours de rétention, 30 jours avant effacement,
échéances d'abonnement, date de parution — ont été **avancés en base**, et
chaque preuve concernée le dit.

Chaque case porte son numéro (**P4.2** = deuxième vérification du parcours
P4), dans l'ordre du document.

**Bilan : 76 cases — **66** ✅ · **4** ⚠️ · **3** ❌ · **3** 🚫.**

### Ce qui ne passe pas

| # | | Constat |
| --- | --- | --- |
| P1.4 | 🚫 | Non observable : taxAmount = 0 sur toute vente de ce montage, donc soustraire ou non la taxe donne le même net. L'égalité mesurée en P1.2 est bien brut = net + trois parts, sans la taxe. |
| P1.5 | 🚫 | Non éprouvable par l'interface : le tunnel d'achat n'a pas de sélecteur de quantité (une ressource numérique s'achète à l'unité). La règle « pourboire une seule fois » vit dans lib/domain/fees.ts (brut = prix × quantité + pourboire). |
| P4.3 | ⚠️ | Le troisième achat avec QAG4VNG3 est bien REFUSÉ (aucune commande, usesCount reste 2) — mais l’acheteur est renvoyé sur la fiche (?achat=<motif>) SANS AUCUN MESSAGE : la table MESSAGES_ACHAT de components/product/detail.tsx:216 connaît 8 motifs et pas CODE_REFUSE, CHAMPS_INVALIDES ni MONTANT_REFUSE, ajoutés en v1.63–v1.67 ; elle est typée Record<string, …>, donc rien ne l’a signalé. |
| P5.1 | ⚠️ | 1 000 F sous le minimum de 2 000 : bien REFUSÉ, aucune commande — mais l’acheteur est renvoyé sur la fiche (?achat=<motif>) SANS AUCUN MESSAGE : la table MESSAGES_ACHAT de components/product/detail.tsx:216 connaît 8 motifs et pas CODE_REFUSE, CHAMPS_INVALIDES ni MONTANT_REFUSE, ajoutés en v1.63–v1.67 ; elle est typée Record<string, …>, donc rien ne l’a signalé. |
| P5.3 | ⚠️ | « abc » comme montant : bien REFUSÉ, aucune commande, pas traité comme 0 — mais l’acheteur est renvoyé sur la fiche (?achat=<motif>) SANS AUCUN MESSAGE : la table MESSAGES_ACHAT de components/product/detail.tsx:216 connaît 8 motifs et pas CODE_REFUSE, CHAMPS_INVALIDES ni MONTANT_REFUSE, ajoutés en v1.63–v1.67 ; elle est typée Record<string, …>, donc rien ne l’a signalé. |
| P5.4 | ❌ | Une ressource en mode LIBRE au prix suggéré 0, minimum 1 000 F, NE S'ACHÈTE PAS : /acheter/qa-libre-zero-mugyxm4k redirige vers la fiche, qui l'affiche « GRATUIT · Télécharger » — et le fichier se télécharge sans rien payer (34325 octets reçus, 0 commande). Le minimum de 1 000 F fixé par le créateur est contourné en entier. Le tunnel (lib/checkout/achat.ts) ne refuse GRATUITE qu'en mode FIXED, mai |
| P8.7 | ⚠️ | Refusé avec un motif qui dit quoi faire (HTTP 403, « Ton abonnement n’est plus actif. Renouvelle-le pour reprendre tes téléchargements. ») — MAIS dès le lendemain de l’échéance, pendant la grâce que deux écrans promettent (« Accès maintenu jusqu’au 01/10/2026 », « Ton accès continue encore 6 jours »). Deux règles pour la même question : lib/domain/downloads.ts décide abonnementActif = cycleEnd > n |
| P9.3 | ❌ | Mesuré en H4 et lu dans le code : refuser une offre d'emploi ou un service ne prévient PAS l'auteur (0 appel à notifier dans lib/jobs/moderation.ts et lib/services/moderation.ts ; 0 Notification à l'agence après refus), et aucun écran ne lui montre le motif. Les événements, eux, préviennent (J5 : 2 notifications à l'organisatrice). |
| P10.6 | ❌ | Mesuré en O5/O6 — défaut de la v1.69.0 : le bilan des adresses non atteintes est calculé mais jamais affiché (le composant qui le garde est démonté au changement d'état du dossier). |
| P11.4 | 🚫 | Non mesurable dans ce montage : aucun vendeur n’a de solde non versé SANS compte de versement (requête du 25/09 : 0). Lu dans le code, non mesuré : preparerLeCycle ne retient que les comptes ayant payoutAccounts { some: { deletedAt: null } } (lib/payments/cycle.ts). |

### La preuve de chaque case

| # | | Preuve |
| --- | --- | --- |
| P1.1 | ✅ | Mesuré en E (P1) : vente de 10 000 F → net 8 850 F, positif. |
| P1.2 | ✅ | Mesuré en E (P1) : mouvement SALE crédité issuedNet 8 850 = brut 10 000 − commission 1 000 − opérateur 150 − affilié 0 ; brut du mouvement 10 000. |
| P1.3 | ✅ | Mesuré en E2 : /dashboard/gains affiche 8 850 F, exactement le net crédité. |
| P1.4 | 🚫 | Non observable : taxAmount = 0 sur toute vente de ce montage, donc soustraire ou non la taxe donne le même net. L'égalité mesurée en P1.2 est bien brut = net + trois parts, sans la taxe. |
| P1.5 | 🚫 | Non éprouvable par l'interface : le tunnel d'achat n'a pas de sélecteur de quantité (une ressource numérique s'achète à l'unité). La règle « pourboire une seule fois » vit dans lib/domain/fees.ts (brut = prix × quantité + pourboire). |
| P1.6 | ✅ | brut 10000 = 9 000 + pourboire 1 000 (une fois) ; commission 1000 + opérateur 150 + affilié 0 calculés sur le brut pourboire compris ; net crédité au vendeur 8850 |
| P2.1 | ✅ | Mesuré en D13 : « qa-source.png » reçu, 34 325 octets — exactement la taille du fichier téléversé — signature PNG valide. |
| P2.2 | ✅ | deux téléchargements successifs : 34325 puis 34325 octets, 2 ConsumptionEvent |
| P2.3 | ✅ | Mesuré en D13/P2 : downloadsCount de la ressource passé à 1 après un téléchargement. |
| P2.4 | ✅ | Mesuré en D13/P2 : un téléchargement → exactement 1 ConsumptionEvent. |
| P3.1 | ✅ | achat simulé (fournisseur simulation) de 10 000 F ; « Rembourser… » proposait 10000 F, confirmé → OrderItem.refundedAmount = 10000 |
| P3.2 | ✅ | mouvements de la vente : SALE 8850 ; REFUND -10000 ; solde du vendeur (somme des mouvements) 50445 → 40445, soit 10000 F — le TOTAL payé, pas seulement sa part (écrit sur l'écran des versements : « la commission déjà prélevée n'est pas restituée ») |
| P3.3 | ✅ | l'acheteur remboursé : HTTP 403, « Cette commande a été remboursée : le fichier n'est plus accessible. » |
| P4.1 | ✅ | code QAG4VNG3 (−10 %) + pourboire 1 000 : OrderItem.price 9000 (listPrice 10000), tipAmount 1000, Order.total 10000 — le montant réduit est celui encaissé, pas seulement affiché |
| P4.2 | ✅ | deux achats réussis avec QAG4VNG3, deux acheteurs distincts : usesCount 2 / maxUses 2 (la commande abandonnée en P6 a rendu la sienne) |
| P4.3 | ⚠️ | Le troisième achat avec QAG4VNG3 est bien REFUSÉ (aucune commande, usesCount reste 2) — mais l’acheteur est renvoyé sur la fiche (?achat=<motif>) SANS AUCUN MESSAGE : la table MESSAGES_ACHAT de components/product/detail.tsx:216 connaît 8 motifs et pas CODE_REFUSE, CHAMPS_INVALIDES ni MONTANT_REFUSE, ajoutés en v1.63–v1.67 ; elle est typée Record<string, …>, donc rien ne l’a signalé. |
| P4.4 | ✅ | code QA1RGNNS (1 utilisation) employé, puis « Le paiement échoue » → ligne FAILED, usesCount revenu à 0 |
| P4.5 | ✅ | le même code réutilisé après l'échec : accepté (−20 % → 8000 F), SUCCESSFUL ; usesCount 1 |
| P5.1 | ⚠️ | 1 000 F sous le minimum de 2 000 : bien REFUSÉ, aucune commande — mais l’acheteur est renvoyé sur la fiche (?achat=<motif>) SANS AUCUN MESSAGE : la table MESSAGES_ACHAT de components/product/detail.tsx:216 connaît 8 motifs et pas CODE_REFUSE, CHAMPS_INVALIDES ni MONTANT_REFUSE, ajoutés en v1.63–v1.67 ; elle est typée Record<string, …>, donc rien ne l’a signalé. |
| P5.2 | ✅ | Mesuré en O (préalable) : mode libre, 5 000 F donnés → OrderItem.price = 5 000, SUCCESSFUL. |
| P5.3 | ⚠️ | « abc » comme montant : bien REFUSÉ, aucune commande, pas traité comme 0 — mais l’acheteur est renvoyé sur la fiche (?achat=<motif>) SANS AUCUN MESSAGE : la table MESSAGES_ACHAT de components/product/detail.tsx:216 connaît 8 motifs et pas CODE_REFUSE, CHAMPS_INVALIDES ni MONTANT_REFUSE, ajoutés en v1.63–v1.67 ; elle est typée Record<string, …>, donc rien ne l’a signalé. |
| P5.4 | ❌ | Une ressource en mode LIBRE au prix suggéré 0, minimum 1 000 F, NE S'ACHÈTE PAS : /acheter/qa-libre-zero-mugyxm4k redirige vers la fiche, qui l'affiche « GRATUIT · Télécharger » — et le fichier se télécharge sans rien payer (34325 octets reçus, 0 commande). Le minimum de 1 000 F fixé par le créateur est contourné en entier. Le tunnel (lib/checkout/achat.ts) ne refuse GRATUITE qu'en mode FIXED, mai |
| P5.5 | ✅ | Mesuré en C16 : cocher la parité fait apparaître « Réduction maximale (%) » et « aucun coefficient n'est chargé pour l'instant ». |
| P5.6 | ✅ | parité activée sur « QA Prix libre » (pppEnabled true, plafond 3000 bp) ; achat depuis GH, SUCCESSFUL : pppDiscountBp = 0 — la table PppFactor est vide, comportement attendu |
| P5.7 | ✅ | prix payé 3000 F : exactement le montant choisi (3 000), inchangé par la parité |
| P6.1 | ✅ | vieillie à 25 h → passage 200 {"fermees":1,"abonnements":0,"candidatures":0,"relances":{"envoyees":0,"ecartees":{"dejaRelancee":0,"dejaAcquise":0,"sansAdresse":0}}} → commande ABANDONED, ligne FAILED |
| P6.2 | ✅ | commande impayée vieillie à 3 h (createdAt modifié en base : seul moyen d'éprouver un délai de 2 h) → passage 200 {"fermees":0,"abonnements":0,"candidatures":0,"relances":{"envoyees":1,"ecartees":{"dejaRelancee":0,"dejaAcquise":0,"sansAdresse":0}}} → 1 RelancePaiement, commande toujours IN_PROGRESS, 1 courriel en file pour l'acheteur |
| P6.3 | ✅ | le code QAG4VNG3 que tenait la commande est rendu : usesCount 2 → 1 |
| P6.4 | ✅ | second passage immédiat (200 {"fermees":0,"abonnements":0,"candidatures":0,"relances":{"envoyees":0,"ecartees":{"dejaRelancee":1,"dejaAcquise":0,"sansAdresse":0}}}) : toujours 1 seule relance — la clé unique (orderId) tient |
| P7.1 | ✅ | Mesuré en D10 : après le paiement de « QA Affiche fixe », l'upsell « QA Prix libre » est proposé. |
| P7.2 | ✅ | l'acheteur possédait déjà « QA Prix libre » : après le paiement de « QA Affiche fixe », aucune offre ne lui est proposée |
| P7.3 | ✅ | achat échoué : la page de la commande ne propose aucune offre |
| P7.4 | ✅ | même commande payée de A : upsell désactivé → l'offre disparaît de la page ; réactivé → elle revient. L'offre est décidée à l'affichage, pas figée à l'achat. |
| P8.1 | ✅ | Mesuré en L5 : après paiement du renouvellement, cycleEnd 2026-10-23 → 2026-11-22. |
| P8.2 | ✅ | Mesuré en L3–L5 : SubscriptionPayment créé PENDING (7 500 F), passé PAID avec paidAt après le rappel du bac à sable. |
| P8.3 | ✅ | (forfait passé sur Explorer, 15 téléchargements/mois, EN BASE : Studio est illimité et ne tient aucun quota) téléchargement d'une ressource payante non achetée → HTTP 302 au titre de l'abonnement ; quota 2026-09 : 1/15. Le quota est compté PAR MOIS CIVIL (periodeQuota, lib/domain/delivery.ts:228) : un renouvellement ne le remet pas à zéro, le changement de mois si. |
| P8.4 | ✅ | échéance avancée à J+2 (en base) → /api/cron/abonnements 200 {"vus":1,"relances":1,"suspendus":0,"clos":0,"injoignables":0} → 1 rappel(s) ; second passage → toujours 1 |
| P8.5 | ✅ | Échéance passée d’un jour (en base), renouvellement « Le paiement échoue » : paiement FAILED, échéance inchangée — rien n’est prolongé ni réactivé. Le statut reste ACTIVE PAR CONCEPTION : les 7 jours de grâce se déduisent de l’échéance et ne sont pas stockés (lib/ndank/baobart.ts). Les écrans le disent : « Accès maintenu jusqu’au 01/10/2026 — 7 jours de grâce ». |
| P8.6 | ✅ | l'abonné prévenu : notifications ABONNEMENT_A_RENOUVELER, ABONNEMENT_A_RENOUVELER, INSCRIPTION_EVENEMENT ; courriels en file RELANCE_ABONNEMENT, RELANCE_ABONNEMENT |
| P8.7 | ⚠️ | Refusé avec un motif qui dit quoi faire (HTTP 403, « Ton abonnement n’est plus actif. Renouvelle-le pour reprendre tes téléchargements. ») — MAIS dès le lendemain de l’échéance, pendant la grâce que deux écrans promettent (« Accès maintenu jusqu’au 01/10/2026 », « Ton accès continue encore 6 jours »). Deux règles pour la même question : lib/domain/downloads.ts décide abonnementActif = cycleEnd > n |
| P9.1 | ✅ | offre déposée avant le service : l'offre apparaît AVANT dans la file (plus ancien d'abord) ; types présents à cet instant : OFFRE D’EMPLOI, SERVICE (les quatre y sont passés pendant la campagne : H4, I3, J5, K6) |
| P9.2 | ✅ | « Refuser cette offre » avec le motif vide : rien n'est envoyé (champ required : oui, validity.valueMissing true) ; l'offre reste SOUMIS. Côté serveur, trancher() refuse aussi un motif de moins de 8 caractères (MOTIF_REQUIS, lib/jobs/moderation.ts). |
| P9.3 | ❌ | Mesuré en H4 et lu dans le code : refuser une offre d'emploi ou un service ne prévient PAS l'auteur (0 appel à notifier dans lib/jobs/moderation.ts et lib/services/moderation.ts ; 0 Notification à l'agence après refus), et aucun écran ne lui montre le motif. Les événements, eux, préviennent (J5 : 2 notifications à l'organisatrice). |
| P9.4 | ✅ | Mesuré en H4, I3, J5, K7–K8 : « Publier » depuis la file met l'offre dans /jobs, le service dans /services, l'événement dans /evenements, l'article dans /blog. |
| P9.5 | ✅ | service publié depuis la file : il n'y figure plus au rechargement ; l'offre non tranchée, elle, y reste (oui) |
| P10.1 | ✅ | Mesuré en O5 : après le retrait provisoire, la ressource est absente de /explore et de la recherche. |
| P10.2 | ✅ | Mesuré en O5 : /products/<slug> → HTTP 404. |
| P10.3 | ✅ | Mesuré en O9 : l'acheteur (5 000 F payés) reçoit HTTP 403 « Cette ressource fait l'objet d'une notification juridique… ». |
| P10.4 | ✅ | Mesuré en O7 : pastille « Retirée (juridique) » et référence du dossier sur la fiche du créateur. |
| P10.5 | ✅ | les quatre gestes, un par un : publier → ?erreur=retrait-juridique, SUSPENDED ; dépublier : pas de bouton proposé ; modifier → ?erreur=retrait-juridique, SUSPENDED ; supprimer → ?erreur=retrait-juridique, SUSPENDED. La ressource reste SUSPENDED, titre intact. |
| P10.6 | ❌ | Mesuré en O5/O6 — défaut de la v1.69.0 : le bilan des adresses non atteintes est calculé mais jamais affiché (le composant qui le garde est démonté au changement d'état du dossier). |
| P10.7 | ✅ | Mesuré en O11 : après « Remettre en ligne », la ressource revient PUBLISHED, l'état qu'elle avait au retrait (le cas du brouillon est en P10.7b plus bas). |
| P10.8 | ✅ | Mesuré en O11 : l'acheteur est de nouveau redirigé vers le fichier signé (HTTP 302). |
| P10.9 | ✅ | ligne de suspension de « QA Prix libre » après la remise en ligne (O11) : liftedAt 2026-09-25 09:23, previousStatus PUBLISHED |
| P11.1 | ✅ | compte passé sur Moov par l'interface ; vérification 24 h et rétention 7 jours avancées EN BASE ; cycle → {"cycle":"2026-09-25","rails":["moov"],"prepares":1,"montantTotal":41595,"ecartes":{},"erreurs":[],"envoi":{"envoyes":0,… → Payout 41595 F (CREATING) = exactement le solde disponible (41595 F, deux soldes journaliers) |
| P11.2 | ✅ | après la préparation : solde disponible non versé = 0 F (les soldes journaliers sont rattachés au versement) ; /dashboard/gains mentionne le versement : oui |
| P11.3 | ✅ | second passage immédiat : {"cycle":"2026-09-25","rails":["moov"],"prepares":0,"montantTotal":0,"ecartes":{"RIEN_A_VERSER":1},"erreurs":[],"envoi":{"envoyes":0,"echoues":0,"ignores":0,"bl — Payout 1 → 1, aucun doublon |
| P11.4 | 🚫 | Non mesurable dans ce montage : aucun vendeur n’a de solde non versé SANS compte de versement (requête du 25/09 : 0). Lu dans le code, non mesuré : preparerLeCycle ne retient que les comptes ayant payoutAccounts { some: { deletedAt: null } } (lib/payments/cycle.ts). |
| P12.1 | ✅ | Mesuré en B (P12) : un nouveau code de secours ouvre le compte à l'étape de vérification. |
| P12.2 | ✅ | Mesuré en B (P12) : le même code, à la connexion suivante, est refusé (« Ce code ne correspond pas… »). |
| P12.3 | ✅ | Mesuré en B10/P12 : après renouvellement, 8 nouveaux codes sans commun avec les anciens, et un ancien code est refusé. |
| P12.4 | ✅ | Mesuré en B11 : couper la double authentification → totpActiveLe nul, connexion suivante sans défi. |
| P13.1 | ✅ | deux brouillons planifiés à J+2 ; le premier avancé à H−1 (en base) ; /api/cron/blog → 200 {"vus":1,"publies":1} → le premier PUBLIE, visible sur /blog |
| P13.2 | ✅ | le second, planifié dans le futur, reste BROUILLON |
| P13.3 | ✅ | second passage immédiat : 200 {"vus":0,"publies":0} — rien de republié |
| P13.4 | ✅ | le bilan dit ce qui a été vu et ce qui a été publié : {"vus":1,"publies":1} |
| P14.1 | ✅ | capacité 2, 1 inscrit(s) au départ ; deux nouveaux essais : PLACES / pas de bouton « M'inscrire » (PLACES) ; inscrits en base 1 → 2, jamais au-delà de la capacité |
| P14.2 | ✅ | Mesuré en J7 : « Me désinscrire » supprime l'inscription et « M'inscrire » revient. |
| P14.3 | ✅ | Mesuré en J9 : export CSV servi à l'organisatrice (HTTP 200), HTTP 404 pour un inscrit. |
| P14.4 | ✅ | Mesuré en J10 : l'inscrit reçoit 1 notification et 1 courriel en file à l'annulation. |
| P14.5 | ✅ | Mesuré en J11 : « Lever l'annulation » remet cancelledAt à nul, l'événement revient (état PUBLIE). |
| P15.1 | ✅ | demande faite par l'interface, délai de 30 j avancé EN BASE → /api/cron/securite 200 {"blocages":0,"defis":1,"effacements":{"traites":1,"echecs":0}} → demande exécutée ; adresse remplacée (« efface-cmugysgle0002ukosheazisyo@baobart ») ; profils restants 0 |
| P15.2 | ✅ | commandes de l'acheteur effacé : 1 → 1 (dont 1 lignes payées) — elles survivent, et avec elles le revenu du vendeur |
| P15.3 | ✅ | sa ressource publiée : ARCHIVED, pas supprimée |
| P15.4 | ✅ | sa ressource sous retrait juridique (NOT-2026-006) : reste SUSPENDED, pas archivée — la restauration du dossier retrouvera ce qu'elle doit rendre |
| P15.5 | ✅ | événements de consommation : 2 conservés, adresses IP 2 → 0 |

### Mesures complémentaires

| # | | Preuve |
| --- | --- | --- |
| P7.1b | ✅ | rejouée le 25/09 (la première exécution avait échoué dans le harnais : « Cannot read properties of undefined », pas dans l'application) — second acheteur (admin@), « QA Affiche fixe » payée (SUCCESSFUL) : l'upsell « QA Prix libre » est proposé sur la page de confirmation, comme en D10 |
| P10.7b | ✅ | un BROUILLON visé : DRAFT → retrait → SUSPENDED → « Remettre en ligne » → DRAFT. La restauration rend l'état pris, elle ne publie pas le travail de son auteur. |
| P11-rail | ✅ | Cycle lancé un vendredi avec un compte Wave (rail du mardi) : {"cycle":"2026-09-25","rails":["moov"],"prepares":0,"montantTotal":0,"ecartes":{},"erreurs":[],"envoi":{"envoyes":0,"echoues":0,"ignores":0,"bloqueParOtp":false}} — aucun versement préparé, 0 Payout. Les rails ont chacun leur jour (lib/payments/payout-schedule.ts). |
