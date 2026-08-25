# Écrans d'administration — ce qu'ils doivent montrer

**Août 2026 · pour la mise à jour de `Baobart Design/Baobart Dashboard.dc.html`**

> **À jour au 25 août 2026 : la maquette couvre désormais les trois écrans**
> (`a_sys_config`, `a_sys_emails`, `a_sys_paiements`). Ce document reste la
> référence des **données** ; la maquette fait foi pour la **forme**. Là où elle
> ajoute des éléments — pastilles de comptage dans le bandeau, encadré
> « REMÈDE », pied structuré — c'est elle qui décrit ce qu'il faut construire.
>
> Trois écrans sous `/dashboard/systeme`. Le premier existe et fonctionne ; les
> deux autres attendent leur substrat. Ce document décrit **les données que
> chacun a réellement à afficher** — pas une intention, les champs qui existent
> ou vont exister en base.
>
> Règle commune : ces écrans servent quelqu'un qu'on réveille la nuit. Chaque
> élément doit répondre à « qu'est-ce qui est cassé » et « qu'est-ce que je
> fais », pas à « combien ».

---

## Principes partagés par les trois

**Trois états, jamais plus.** `OK` (blanc), `À VOIR` (jaune), `PANNE` (orange,
texte blanc). Une quatrième nuance obligerait à réfléchir avant d'agir.

**Le pire l'emporte.** Le bandeau de tête prend la pire gravité de la page. Un
bandeau vert au-dessus d'une panne ne sert personne.

**Un remède avec chaque défaut.** Un écran qui signale sans dire quoi faire
déplace le problème. Quand il n'y a rien à faire, pas de ligne de remède.

**Rien de secret à l'écran.** Jamais de clé d'API, de jeton, de mot de passe,
ni d'URL signée de téléchargement — une capture d'écran d'incident circule
dans un fil de discussion et y reste.

**Aucune mise en cache.** Ces pages se relisent à chaque affichage.

---

## 1. Configuration — `/dashboard/systeme/configuration`

**Existe déjà.** À redessiner, pas à inventer.

### Bandeau de tête
Une phrase, sur le fond de la gravité globale :

| Gravité | Phrase |
|---|---|
| `ok` | Tout ce qui est livré fonctionne. |
| `attention` | La plateforme sert, mais quelque chose mérite un regard. |
| `panne` | Quelque chose d'essentiel ne fonctionne pas. |

### Bloc « État des dépendances »
Une ligne par constat. Chaque ligne porte quatre choses : **pastille**,
**libellé**, **détail** (une phrase), **remède** (optionnel).

Constats émis aujourd'hui :

| Libellé | Ce qu'il dit |
|---|---|
| Base de données | joignable ou non ; nombre de migrations non appliquées |
| Stockage des fichiers | configuré ; hôte des aperçus ; HTTP ou adresse locale en production |
| Connexion | fournisseurs actifs, ou mot de passe seul |
| Interrupteurs | fonctionnalités fermées volontairement |
| Migrations interrompues | *n'apparaît que si le cas se produit* |
| Dossier des migrations | *n'apparaît que si le dépôt n'est pas lisible* |

Le nombre de lignes varie donc de 4 à 6. Le dessin ne doit pas supposer un
compte fixe.

### Bloc « Pas encore écrit »
Liste plate, sans pastille : passage en caisse, paiements, courriels, envoi
effectif des versements, SMS. Précédée d'une phrase expliquant que renseigner
leurs variables ne branche rien.

### Pied
Rôle de la personne connectée, et rappel que les rôles se donnent depuis la
base — jamais depuis un écran.

---

## 2. Emails — `/dashboard/systeme/emails`

Supervise la file d'attente des messages transactionnels : reçu d'achat, lien
de téléchargement, avis de versement.

### Pourquoi une file, et pas un envoi direct
Un message part **après** la transaction qui le justifie. S'il partait pendant,
une commande annulée aurait déjà envoyé son reçu ; s'il partait avant, une
panne d'expéditeur ferait échouer la commande. La file découple les deux : la
commande écrit son intention, un passage l'envoie ensuite.

D'où l'écran : ce qui est découplé doit être surveillé, sinon la file se remplit
sans que personne ne le voie.

### Quatre compteurs de tête

| Compteur | Gravité |
|---|---|
| En attente | `attention` au-delà d'un seuil |
| Envoyés (24 h) | jamais alarmant |
| En échec définitif | `panne` dès 1 |
| Âge du plus ancien en attente | `panne` au-delà d'une heure |

Le dernier est le plus important et le moins évident : une file qui grossit se
voit, une file **figée** ne se voit pas. Dix messages en attente depuis deux
minutes vont bien ; un seul en attente depuis six heures veut dire que plus rien
ne part.

### Filtres
Statut, modèle de message, destinataire (recherche).

### Tableau

| Colonne | Contenu |
|---|---|
| Créé le | date et heure |
| Modèle | `RECU_ACHAT`, `LIEN_TELECHARGEMENT`, `AVIS_VERSEMENT`… |
| Destinataire | adresse |
| Statut | `EN_ATTENTE`, `EN_COURS`, `ENVOYE`, `ECHOUE` |
| Tentatives | `2 / 5` |
| Prochaine tentative | date, ou `—` |
| Dernière erreur | tronquée, en entier au survol |

Le statut `EN_COURS` mérite son propre traitement visuel : bloqué dans cet état,
il signale un processus mort en plein envoi.

### Détail d'une ligne
Panneau ou modale : modèle, destinataire, **contenu de la charge utile
caviardé** — jamais l'URL signée telle quelle —, l'erreur complète, l'historique
des tentatives.

### Deux actions
**Relancer** — remet en attente immédiatement. Disponible sur `ECHOUE`
seulement.

**Abandonner** — ferme définitivement. Utile quand l'adresse n'existe plus : sans
cela, la ligne resterait rouge à jamais et masquerait les vraies pannes.

Toutes deux demandent le pouvoir `agir_sur_l_exploitation`. Un lecteur simple
voit l'écran sans les boutons.

### Un pilote à nommer
Un bandeau discret dit lequel est actif : `console` (rien ne part vraiment),
`resend`, ou aucun. En `console`, il faut le dire fort — sinon on croit que les
messages partent.

---

## 3. Paiements — `/dashboard/systeme/paiements`

**Ne peut pas encore être construit** : il n'y a ni passage en caisse, ni
fournisseur, ni webhook. Le dessin peut se faire, le câblage suivra.

### Ce qu'il supervise
Les événements que les opérateurs — Wave, Orange Money, carte — envoient pour
dire qu'un paiement a abouti, échoué ou été contesté. Ces messages arrivent sans
qu'on les demande, parfois en double, parfois dans le désordre, parfois des
heures plus tard.

### Quatre compteurs de tête

| Compteur | Gravité |
|---|---|
| Reçus (24 h) | jamais alarmant |
| En échec de traitement | `panne` dès 1 |
| Signatures invalides | `panne` dès 1 |
| Commandes payées sans événement | `panne` dès 1 |

Les deux derniers demandent une explication.

Une **signature invalide** n'est pas une erreur technique : c'est quelqu'un qui
tente de faire croire à un paiement. Ce compteur ne doit jamais être noyé parmi
les autres.

Une **commande payée sans événement** est l'inverse — l'acheteur a été débité,
mais rien n'est arrivé chez nous. C'est le seul cas où quelqu'un a perdu de
l'argent, et il doit se voir en premier.

### Tableau

| Colonne | Contenu |
|---|---|
| Reçu le | date et heure |
| Fournisseur | Wave, Orange Money, CinetPay… |
| Type | `paiement.abouti`, `paiement.echoue`, `litige.ouvert` |
| Référence | identifiant côté opérateur |
| Signature | valide ou non |
| Statut | `RECU`, `TRAITE`, `IGNORE_DOUBLON`, `ECHEC` |
| Commande | lien vers la commande, ou `—` |

`IGNORE_DOUBLON` est un état normal, pas un défaut : un opérateur qui n'a pas vu
notre accusé de réception réémet, et refuser proprement le doublon est
exactement ce qu'il faut faire. À montrer en gris, jamais en rouge.

### Détail d'une ligne
Le **JSON brut tel qu'il est arrivé**, non reformaté. C'est la seule preuve de
ce que l'opérateur a réellement envoyé, et c'est ce qu'on lui renverra en cas de
désaccord. Les champs de secret y sont caviardés à l'affichage, jamais en base.

Plus : l'état de la signature, le nombre de tentatives de traitement, l'erreur.

### Deux actions
**Rejouer le traitement** — réapplique l'événement. Doit être idempotent : le
rejouer deux fois ne crée pas deux commandes.

**Marquer comme revu** — sort la ligne des compteurs d'alerte sans prétendre
qu'elle a réussi. Un humain a regardé et tranché.

### Ce que cet écran ne fait pas
Il ne rembourse pas, n'annule pas, ne modifie aucun montant. Superviser et
décider sont deux métiers ; les mélanger sur le même écran fait cliquer par
réflexe sur ce qui touche à l'argent.

---

## Résumé pour la maquette

| Écran | État | Blocs |
|---|---|---|
| Configuration | **livré** | bandeau, 4 à 6 constats, liste « pas encore écrit », pied |
| Emails | substrat en cours | bandeau, 4 compteurs, filtres, tableau, détail, 2 actions |
| Paiements | attend le checkout | bandeau, 4 compteurs, filtres, tableau, détail JSON, 2 actions |

Les trois partagent le même châssis : bandeau de gravité, puis panneaux
`DashboardPanel`, dans la charte du tableau de bord — cadre 2,5 px, ombre
portée, pastilles arrondies en `Space Mono`.
