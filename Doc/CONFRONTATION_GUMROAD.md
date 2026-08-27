# Nos systèmes éprouvés au regard de Gumroad

**Août 2026 · Baobart v1.24.0 · référence `antiwork/gumroad` @ `a475e3f9`**

> Le dépôt Gumroad (MIT) sert de **spécification**, jamais de source à copier.
> Il est cloné hors de ce dépôt — aucun fichier sous licence tierce n'entre
> dans notre historique. Ce document décrit des logiques observées, dans nos
> propres mots.
>
> L'exercice ne cherche pas la ressemblance. Il cherche les cas qu'une
> plateforme de vente finit par rencontrer et que nous n'avons pas prévus.

---

## Ce que la confrontation a révélé

### 1. La plateforme n'a pas de compte — et cela se voit sur un remboursement

**Prouvé, pas supposé.** `lib/domain/argent-remboursement.integration.test.ts`
fixe le trajet des fonds sur une vente à 5 000 F :

| Étape | Acheteur | Créateur | Plateforme |
|---|---|---|---|
| Vente | −5 000 | +4 425 | +575 *(nulle part inscrit)* |
| Remboursement intégral | +5 000 | −4 425 | −575 |

Notre grand livre est tenu **par utilisateur** : chaque écriture porte un
`userId`. La plateforme n'étant pas un utilisateur, ce qu'elle prélève —
500 F de commission, 75 F de frais d'opérateur — n'existe que comme différence
entre ce que l'acheteur a payé et ce que le créateur a reçu.

Deux conséquences, l'une comptable, l'autre financière.

**On ne peut pas répondre à « combien la plateforme a-t-elle gagné ce mois-ci ».**
Il faut la recalculer en sommant les frais figés sur chaque ligne. C'est
faisable, mais ce n'est pas une lecture de solde — c'est une reconstitution.

**Sur un remboursement, la plateforme rend sa commission et absorbe en plus les
frais d'opérateur.** Les 75 F de la passerelle ne reviennent pas : le
prestataire de paiement les garde. Personne n'a décidé cela ; c'est ce qui
arrive faute de compte plateforme.

Gumroad, de son côté, garde sur chaque remboursement une notion de commission
**retenue** (`retained_fee_cents` dans `app/models/refund.rb`), et distingue les
cas où les frais sont dispensés. Autrement dit : chez eux, rendre ou garder la
commission est un **choix inscrit ligne par ligne**. Chez nous, il n'y a pas de
choix — il n'y a qu'un effet de bord.

**Ce n'est pas un bug.** Rembourser intégralement l'acheteur, commission
comprise, est une politique commerciale défendable, et même généreuse. Mais
elle doit être décidée, pas subie. Sur un marché où le remboursement est un
argument de confiance, chaque retour coûte à Baobart la commission *et* les
frais de passerelle.

### 1 bis. Tranché : le vendeur finance le remboursement

**Décision d'août 2026.** La commission reste acquise à la plateforme, et les
frais d'opérateur restent à la charge du vendeur. L'acheteur reçoit le prix
entier ; la plateforme ne verse rien ; le vendeur est donc débité du **brut**,
pas de son net.

Le tableau devient :

| Étape | Acheteur | Créateur | Plateforme |
|---|---|---|---|
| Vente | −5 000 | +4 425 | +575 |
| Remboursement intégral | +5 000 | −5 000 | +0 *(garde ses 500)* |

**Conséquence à connaître : le solde du vendeur peut devenir négatif.** Sur
l'exemple, il avait reçu 4 425 et rend 5 000 — son solde descend à −575. Aucune
contrainte ne l'interdit, et les ventes suivantes absorbent le déficit. C'est
voulu : rembourser coûte au vendeur, pas à la plateforme.

Cela crée une **obligation d'information**. Découvrir la règle sur un solde
négatif serait une mauvaise surprise ; l'écran `/dashboard/versements` l'énonce
avant, chiffres à l'appui.

La commission gardée est consignée sur chaque remboursement (`Refund.retainedFee`).
Elle n'entre dans aucun calcul — faute de compte plateforme, elle n'existerait
sinon nulle part, et l'on ne pourrait pas répondre à « combien avons-nous
conservé ».

### 2. Une licence émise que rien ne consomme

Nous générons une clé à chaque achat et l'oublions. Gumroad suit un compteur
d'usages sur la sienne, sait la désactiver puis la réactiver, plafonne le
nombre d'usages, et — détail qui trahit l'expérience — sépare « fixer le
compteur à cette valeur » de « l'incrémenter », les deux opérations prises sous
verrou.

La distinction n'est pas gratuite : deux activations simultanées d'un même
greffon qui liraient puis écriraient le compteur en perdraient une.

Sans interface de vérification de licence, notre clé reste décorative. Ce n'est
pas urgent — mais le jour où on l'exposera, le compteur devra naître verrouillé.

### 3. Les états d'achat : un écart qui n'en est pas un

Leur machine à états en compte beaucoup plus que nos quatre. La différence
tient à des fonctionnalités que nous n'avons pas : cadeaux, préventes, achats
de test par le vendeur lui-même.

Aucune correction à faire. Noté pour qu'on ne prenne pas cet écart pour une
lacune la prochaine fois qu'on ouvrira leur code.

---

## Seconde passe : les gardes qui ne peuvent pas se déclencher

La première passe comparait des calculs. Celle-ci pose une autre question :
**nos garde-fous sont-ils atteignables ?** Elle a produit le constat le plus
lourd de l'exercice.

### 4. Un étage de confiance entièrement déclaratif

`lib/domain/trust.ts` contient une machine à états du risque complète et
éprouvée : transitions autorisées, refus de suspension illégitime, coupure
automatique des remboursements quand le solde plonge. Seuls ses **types** et un
prédicat sont importés ailleurs. `applyRiskEvent` et `decideLowBalance` ne sont
appelés par personne.

Le symptôme se lit aussi dans le schéma. Ces colonnes sont **lues** par le code
qui décide, et **écrites par aucun** :

| Colonne | Lue par | Écrite par |
|---|---|---|
| `chargebackAt` / `chargebackReversedAt` | livraison, achat, fiche produit | *rien* |
| `accessRevokedAt` | livraison, achat, fiche produit | *rien* |
| `payoutsPausedAt` | éligibilité au versement | *rien* |
| `suspendedAt` | session, éligibilité | *rien* |
| `kycStatus`, `PayoutAccount.verifiedAt` | lecture seule | *rien* |

Autrement dit : trois modules refusent correctement l'accès à une ressource
dont le paiement est contesté — mais rien ne peut inscrire cette contestation.
Un compte suspendu perd sa session immédiatement — mais personne ne peut
suspendre un compte.

**Ce n'est pas une lacune de conception, c'est une lacune de câblage.** La
lecture est juste, les règles sont bonnes, les tests passent. Simplement, aucun
de ces états n'existera jamais en production.

Chez Gumroad, le litige a un chemin d'écriture complet : l'événement de
l'opérateur débite le vendeur — de façon **idempotente**, un rejeu ne débitant
jamais deux fois —, suspend ses versements, annule l'abonnement associé et
déclenche la constitution du dossier. Un litige gagné recrédite. Chez nous, le
grand livre n'a même pas de type de mouvement pour un litige.

### 5. Le remboursement existe, mais personne ne peut le déclencher

`rembourserLigne` est écrite, transactionnelle, protégée contre le dépassement
et contre la concurrence — et **appelée par aucun écran, aucune action, aucune
route**. La politique dont nous venons de décider ne peut donc s'appliquer à
personne.

Même constat pour `marquerVersement`, la transition d'état d'un versement : la
machine à huit états existe, rien ne la fait avancer.

### 6. Le prix plancher, dormant mais pas fautif

`minimumViablePrice` n'est appelée nulle part, et la validation d'un produit
n'exige qu'un prix strictement positif. Aujourd'hui c'est sans conséquence :
notre barème n'a **aucune part fixe**, et la fonction renvoie donc zéro.

Le jour où les frais fixes des opérateurs seront mesurés et posés, une ressource
à 1 F coûterait plus cher à encaisser qu'elle ne rapporte. Le contrôle devra
alors être branché — pas avant.

---

## Ce sur quoi nous sommes plus stricts

Trois points où notre implémentation refuse ce que la leur laisse passer.

**Le grand livre est immuable par contrainte de base.** Un déclencheur
PostgreSQL refuse tout `UPDATE` et tout `DELETE` sur `BalanceTransaction` :
corriger passe obligatoirement par une écriture inverse. Chez Gumroad, la
même discipline existe, mais elle repose sur les habitudes du code. La nôtre
tient même contre un `psql` ouvert par mégarde — vérifié à mes dépens en
tentant d'effacer une vente d'essai.

**On n'achète pas sa propre ressource.** Nous refusons ; leur modèle d'achat ne
porte pas ce garde-fou. Sans lui, un créateur pourrait faire tourner ses
propres ventes pour gonfler ses compteurs, et se créditer le net de son propre
argent.

**Deux achats simultanés donnent une commande.** Transaction sérialisable et
vérification de possession à l'intérieur, éprouvées par un test qui lance deux
achats en parallèle et vérifie qu'un seul crédit atteint le créateur.

---

## Ce que la confrontation a confirmé

Ces choix, faits plus tôt sans certitude, se révèlent alignés :

- **Le remboursement est un enregistrement, pas un statut.** Plusieurs
  remboursements partiels s'empilent sur la même ligne — comme chez eux.
- **Le litige est distinct du remboursement.** L'argent repris par la banque
  n'est pas un geste du vendeur ; les deux colonnes restent séparées.
- **Le seuil minimum de versement existe** des deux côtés, et le compte
  suspendu, l'enquête en cours et les versements suspendus sont bien trois
  motifs de refus distincts — un créateur peut être payé alors qu'il est sous
  contrôle, ou suspendu sans que ses versements le soient.
- **Un produit gratuit aboutit sans encaissement**, dans un état dédié.

---

## Ce que je n'ai pas vérifié

Par honnêteté sur la portée de l'exercice : je n'ai pas confronté la fiscalité,
la conformité par pays, les abonnements récurrents, les préventes, ni la
détection de fraude. Ce sont des pans entiers de leur code, et nous n'avons rien
en face à comparer.

Je n'ai pas non plus mesuré nos taux de commission contre les leurs : les
nôtres sont des décisions commerciales ouvertes, déjà signalées comme telles
dans `lib/domain/fees.ts`, et ce n'est pas une question technique.

---

## Suite

La politique de remboursement est tranchée et implémentée. La seconde passe a
déplacé la priorité : ce n'est plus une règle qui manque, c'est un câblage.

**Par ordre d'urgence :**

1. **Déclencher le remboursement.** La fonction est prête ; il lui manque un
   écran côté vendeur et une garde d'autorisation. Sans elle, la politique
   qu'on vient d'arrêter ne s'applique à personne.
2. **Écrire les états de confiance.** Litige, retrait d'accès, suspension de
   compte, suspension de versements : les lectures existent, les décisions
   aussi. Il manque les chemins d'écriture, et un type de mouvement `LITIGE`
   au grand livre.
3. **Faire avancer la machine à versements** — `marquerVersement` n'est
   appelée par rien.

Puis, quand le besoin viendra : le compteur d'usages de licence sous verrou, le
prix plancher le jour où des frais fixes seront posés, et un compte plateforme
au grand livre — le jour où « combien la plateforme a-t-elle gagné ce mois-ci »
devra se lire, et non se reconstituer.
