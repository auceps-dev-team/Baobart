# Qualitytest — Niveau 3 : les refus

**Les deux niveaux précédents vérifiaient que ce qui doit marcher marche.
Celui-ci vérifie que ce qui doit échouer échoue.**

C'est le niveau le plus ingrat, parce qu'une garde qui fonctionne ne produit
rien de visible : un message, une redirection, un 404. Personne ne félicite une
porte fermée. Mais une garde absente ne se voit pas non plus — jusqu'au jour où
quelqu'un la cherche.

**La règle de lecture de tout ce document :** un refus doit refuser *et* dire
pourquoi, dans des termes que la personne peut corriger. Un refus muet est à
moitié un défaut : l'utilisateur recommence, échoue encore, et écrit au
support.

---

## 1. Les trois familles de refus

| Famille | La question | Ce qu'un manque coûte |
| --- | --- | --- |
| **Autorisation** | Est-ce ton droit ? | Quelqu'un fait ce qui ne le regarde pas |
| **Validité** | Est-ce une valeur possible ? | Des données fausses entrent et ne ressortent plus |
| **Moment** | Est-ce le bon instant ? | Deux gestes se marchent dessus |

Les trois se testent différemment. L'autorisation demande **deux comptes**, la
validité demande des **valeurs limites**, le moment demande **deux onglets**.

---

## 2. Autorisation — l'accès direct par l'URL

Le piège classique s'appelle **IDOR** (*Insecure Direct Object Reference*, «
référence directe non sécurisée ») : un identifiant dans l'URL, un serveur qui
sert sans vérifier à qui il appartient. Il ne se voit jamais en cliquant, parce
que l'interface ne propose pas le lien — il faut le taper.

**Méthode.** Se connecter en `createur@`, relever un identifiant. Se
déconnecter, se connecter en `client@`, coller l'URL.

| # | URL à coller sous un autre compte | Attendu | |
| --- | --- | --- | --- |
| R1 | `/dashboard/produits/<id d'un autre>` | 404, jamais la fiche | ☐ |
| R2 | `/dashboard/evenements/<id d'un autre>` | 404 | ☐ |
| R3 | `/dashboard/evenements/<id>/inscrits` d'un autre | 404 | ☐ |
| R4 | `/dashboard/blog/<id d'un autre>` | 404 | ☐ |
| R5 | `/dashboard/jobs/<id>/candidatures` d'une autre offre | 404 | ☐ |
| R6 | `/api/jobs/candidatures/<id>/cv` d'un autre recruteur | Refus — **le CV est une donnée personnelle** | ☐ |
| R7 | `/api/evenements/<id>/inscrits` d'un autre organisateur | Refus | ☐ |
| R8 | `/achat/<orderId>` d'un autre acheteur | Refus | ☐ |
| R9 | `/api/telechargement/<fichierId>` sans l'avoir acheté | Refus, motif « pas dans tes achats » | ☐ |
| R10 | `/abonnement/<id>/renouveler` d'un autre abonné | Refus | ☐ |

**404 plutôt que 403, et c'est délibéré.** Un 403 confirmerait que l'objet
existe. Si un écran répond « interdit » là où un autre répond « introuvable »,
le signaler : l'incohérence renseigne autant que la réponse.

---

## 3. Autorisation — les pouvoirs d'exploitation

Sept rôles, onze pouvoirs, et aucun n'hérite d'un autre : la table de
`lib/auth/administration.ts` les écrit un par un, exprès.

| Rôle | Ce qu'il peut |
| --- | --- |
| `MEMBER` | rien d'exploitation |
| `CONTENT_MANAGER` | publier du contenu |
| `MARKETING` | promouvoir du contenu |
| `MODERATOR` | modérer le contenu |
| `SUPPORT` | traiter les litiges |
| `ACCOUNTANT` | consulter et agir sur l'argent |
| `COMPLIANCE` | gérer la conformité, consulter l'audit |
| `ADMIN` | tout sauf distribuer les rôles |
| `SUPER_ADMIN` | tout, y compris les rôles |

**Méthode.** Depuis `admin@`, changer le rôle d'un compte d'essai, se
reconnecter avec lui, et essayer.

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R11 | `MEMBER` ouvre `/dashboard/systeme/membres` | Refus | ☐ |
| R12 | `MEMBER` ouvre `/dashboard/moderation` | Refus | ☐ |
| R13 | `MODERATOR` ouvre `/dashboard/systeme/versements` | Refus — il ne touche pas à l'argent | ☐ |
| R14 | `ACCOUNTANT` ouvre `/dashboard/moderation` | Refus | ☐ |
| R15 | `ADMIN` tente de changer un rôle | Refus — seul `SUPER_ADMIN` distribue | ☐ |
| R16 | `CONTENT_MANAGER` ouvre la file de modération | Il voit les événements, **pas** les offres d'emploi | ☐ |
| R17 | Un rôle sans pouvoir voit-il le menu ? | Le menu ne propose **pas** l'écran qu'il ne peut pas ouvrir | ☐ |

**R17 est le plus important des sept.** Promettre un écran qui répondra non est
pire que ne rien promettre : la personne croit à une panne.

---

## 4. Validité — les valeurs limites

Pour chaque champ, trois essais : **juste en dessous**, **exactement**, **juste
au-dessus**. La limite se trompe presque toujours d'un cran, jamais de dix.

### Le montant libre

| # | Saisie | Attendu | |
| --- | --- | --- | --- |
| R18 | Minimum − 1 | Refus | ☐ |
| R19 | Minimum exact | Accepté | ☐ |
| R20 | Texte (`abc`) | **Refus**, jamais traité comme 0 | ☐ |
| R21 | Vide | Refus | ☐ |
| R22 | Négatif (`-500`) | Refus | ☐ |
| R23 | `1e9` en notation scientifique | Refus | ☐ |
| R24 | `5000.5` (décimal) | Refus ou arrondi annoncé, jamais tronqué en silence | ☐ |

### Le pourboire

| # | Saisie | Attendu | |
| --- | --- | --- | --- |
| R25 | Pourboire au-dessus du plafond (1 000 000) | Refus | ☐ |
| R26 | Pourboire négatif | Refus | ☐ |
| R27 | Pourboire invalide alors que le pourboire est **fermé** | Ignoré, achat normal | ☐ |

### Les autres champs

| # | Champ | Épreuve | |
| --- | --- | --- | --- |
| R28 | Prix d'une ressource | Au-dessus de 100 000 000 → refus | ☐ |
| R29 | Mots-clés | Au-delà de 12 → refus ou troncature annoncée | ☐ |
| R30 | Motif de refus en modération | Moins de 8 caractères → refus | ☐ |
| R31 | Slug | Deux ressources, même titre → deux slugs distincts | ☐ |
| R32 | Mot de passe à l'inscription | Trop court → refus avec la règle énoncée | ☐ |
| R33 | Courriel | `pas-une-adresse` → refus | ☐ |
| R34 | Champ personnalisé obligatoire | Laissé vide → l'achat est refusé | ☐ |
| R35 | Code promo inexistant | Refus, sans révéler s'il a existé | ☐ |
| R36 | Code promo désactivé | Refus | ☐ |

### Les fichiers

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R37 | Téléverser un fichier au-delà de la taille permise | Refus avant l'envoi complet | ☐ |
| R38 | Téléverser un type non permis | Refus | ☐ |
| R39 | Publier une ressource **sans fichier source** | Refus — sinon l'acheteur paie pour rien | ☐ |
| R40 | Publier avec seulement un aperçu | Refus | ☐ |

---

## 5. Validité — l'article 47

Le formulaire de notification juridique porte **six** exigences légales. Chacune
manquante doit être nommée, et la notification **enregistrée quand même** — la
date de première tentative est celle qui compte devant un juge.

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R41 | Déposer sans la correspondance préalable | Enregistré, « correspondance » listée comme manquante | ☐ |
| R42 | Déposer avec « tout mon site » comme localisation | Refus de la localisation — elle doit être précise | ☐ |
| R43 | Déposer sans les motifs | Enregistré, « motifs » manquant | ☐ |
| R44 | Compléter la notification | La **référence** et la **date d'origine** ne changent pas | ☐ |
| R45 | Une notification incomplète fait-elle courir le délai ? | **Non** — aucune échéance n'est posée | ☐ |

---

## 6. Le moment — deux onglets, deux gestes

Ces épreuves demandent deux fenêtres ouvertes côte à côte. Elles sont
fastidieuses et elles trouvent ce qu'aucune autre ne trouve.

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R46 | Double-cliquer « Acheter » | **Une** commande, pas deux | ☐ |
| R47 | Deux onglets achètent en même temps avec le même code à 1 usage | Un seul aboutit | ☐ |
| R48 | Deux onglets s'inscrivent à la dernière place d'un événement | Un seul aboutit | ☐ |
| R49 | Deux modérateurs tranchent le même dossier | Le second reçoit « déjà tranché », pas une seconde décision | ☐ |
| R50 | Deux modérateurs retirent le même contenu | Une seule échéance posée | ☐ |
| R51 | Publier depuis un onglet, supprimer depuis l'autre | Le second geste échoue proprement | ☐ |
| R52 | Rembourser deux fois la même vente | Le second refus, le solde n'est pas débité deux fois | ☐ |
| R53 | Revenir en arrière après un paiement et renvoyer le formulaire | Pas de second débit | ☐ |

**R46 et R53 sont ceux qu'un utilisateur réel déclenche sans le vouloir.** Les
autres demandent de la mauvaise volonté ; ces deux-là demandent une connexion
lente.

---

## 7. Les limites par adresse

Sept règles, chacune avec un chiffre choisi, pas deviné. Les dépasser doit
donner un **429** avec de quoi savoir quand revenir.

| Geste | Quota | Fenêtre |
| --- | --- | --- |
| Connexion | 10 | 15 min |
| Inscription | 5 | 1 h |
| Mot de passe oublié | 5 | 15 min |
| Dépôt d'offre d'emploi | 5 | 1 h |
| Candidature | 20 | 1 h |
| Dépôt de service | 5 | 1 h |
| Inscription à un événement | 30 | 1 h |
| **Notification juridique** | **3** | 1 h |
| Rappel de paiement | 300 | 1 min |

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R54 | 11 connexions ratées de suite | 429, avec le délai d'attente | ☐ |
| R55 | 4 dépôts juridiques en une heure | 429 dès le quatrième | ☐ |
| R56 | Le 429 dit-il quand revenir ? | Oui, en secondes | ☐ |
| R57 | Le compteur repart-il à zéro sur un changement de page ? | **Non** | ☐ |

**Le dépôt juridique est à 3, sous le plancher de 5 de toutes les autres.** Ce
n'est pas une erreur de saisie : une offre d'emploi de trop ajoute une ligne
dans une file, une notification de trop fait retirer le travail de quelqu'un.

---

## 8. Les refus d'état — le bon geste au mauvais moment

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R58 | Acheter sa **propre** ressource | Refus | ☐ |
| R59 | Acheter une ressource déjà achetée | L'écran propose de télécharger, pas de repayer | ☐ |
| R60 | Supprimer une ressource **déjà vendue** | Refus, avec « dépublier » proposé à la place | ☐ |
| R61 | Publier une ressource sous **retrait juridique** | Refus expliqué | ☐ |
| R62 | Modifier une ressource sous retrait juridique | Refus | ☐ |
| R63 | Supprimer une ressource sous retrait juridique | Refus — c'est la pièce du litige | ☐ |
| R64 | Trancher un dossier **déjà tranché** | Refus | ☐ |
| R65 | Répondre à un dossier après l'échéance | Refus, ou réponse hors délai clairement dite | ☐ |
| R66 | S'inscrire deux fois au même événement | Refus | ☐ |
| R67 | Postuler deux fois à la même offre | Refus | ☐ |
| R68 | Rejoindre deux fois la même communauté | Sans effet, pas d'erreur | ☐ |
| R69 | Renouveler un abonnement annulé | Refus | ☐ |
| R70 | Télécharger après un remboursement | Refus, motif « remboursée » | ☐ |
| R71 | Télécharger avec le quota d'abonnement épuisé | Refus, motif « quota » | ☐ |
| R72 | Utiliser deux fois le même code de secours 2FA | Refus au second | ☐ |
| R73 | Réutiliser un jeton de réinitialisation déjà servi | Refus | ☐ |
| R74 | Ouvrir un lien de réinitialisation expiré | Refus daté | ☐ |

---

## 9. Ce qu'on n'a pas le droit de fuir

Un refus mal écrit renseigne autant qu'une acceptation.

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R75 | Connexion avec une adresse **inexistante** vs. un mauvais mot de passe | Le **même** message, et le même temps de réponse | ☐ |
| R76 | « Mot de passe oublié » sur une adresse inexistante | Le même message que sur une adresse connue | ☐ |
| R77 | Inscription avec une adresse déjà prise | Ne doit pas confirmer qu'elle est prise | ☐ |
| R78 | Page de dossier juridique du créateur | N'affiche **pas** le domicile du notifiant | ☐ |
| R79 | Message d'erreur technique | Aucune trace de pile, aucun nom de table | ☐ |
| R80 | Route cron sans secret | **404**, pas 401 | ☐ |

**R78 vient d'une décision écrite** : un litige de droit d'auteur n'a pas à
exposer l'adresse personnelle de celui qui le dépose.

---

## 10. Ce que ce niveau ne dit pas

**Il suppose que le refus se voit.** Chaque ligne ci-dessus se conclut par un
message, un 404, un 429 — quelque chose qui apparaît. Il ne couvre pas le cas
où le geste est accepté, l'écran dit « c'est fait », et rien ne s'est produit.

Ce cas-là n'a aucun symptôme. Il ne fait échouer aucune des 80 épreuves de ce
document, ni aucune des deux niveaux précédents.

C'est le niveau 4.
