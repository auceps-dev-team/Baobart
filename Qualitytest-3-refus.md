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
| R1 | `/dashboard/produits/<id d'un autre>` | 404, jamais la fiche | ✅ |
| R2 | `/dashboard/evenements/<id d'un autre>` | 404 | ✅ |
| R3 | `/dashboard/evenements/<id>/inscrits` d'un autre | 404 | ✅ |
| R4 | `/dashboard/blog/<id d'un autre>` | 404 | ✅ |
| R5 | `/dashboard/jobs/<id>/candidatures` d'une autre offre | 404 | ✅ |
| R6 | `/api/jobs/candidatures/<id>/cv` d'un autre recruteur | Refus — **le CV est une donnée personnelle** | ✅ |
| R7 | `/api/evenements/<id>/inscrits` d'un autre organisateur | Refus | ✅ |
| R8 | `/achat/<orderId>` d'un autre acheteur | Refus | ✅ |
| R9 | `/api/telechargement/<fichierId>` sans l'avoir acheté | Refus, motif « pas dans tes achats » | ✅ |
| R10 | `/abonnement/<id>/renouveler` d'un autre abonné | Refus | ✅ |

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
| R11 | `MEMBER` ouvre `/dashboard/systeme/membres` | Refus | ✅ |
| R12 | `MEMBER` ouvre `/dashboard/moderation` | Refus | ✅ |
| R13 | `MODERATOR` ouvre `/dashboard/systeme/versements` | Refus — il ne touche pas à l'argent | ✅ |
| R14 | `ACCOUNTANT` ouvre `/dashboard/moderation` | Refus | ✅ |
| R15 | `ADMIN` tente de changer un rôle | Refus — seul `SUPER_ADMIN` distribue | 🚫 |
| R16 | `CONTENT_MANAGER` ouvre la file de modération | Il voit les événements, **pas** les offres d'emploi | ✅ |
| R17 | Un rôle sans pouvoir voit-il le menu ? | Le menu ne propose **pas** l'écran qu'il ne peut pas ouvrir | ✅ |

**R17 est le plus important des sept.** Promettre un écran qui répondra non est
pire que ne rien promettre : la personne croit à une panne.

---

## 4. Validité — les valeurs limites

Pour chaque champ, trois essais : **juste en dessous**, **exactement**, **juste
au-dessus**. La limite se trompe presque toujours d'un cran, jamais de dix.

### Le montant libre

| # | Saisie | Attendu | |
| --- | --- | --- | --- |
| R18 | Minimum − 1 | Refus | ⚠️ |
| R19 | Minimum exact | Accepté | ✅ |
| R20 | Texte (`abc`) | **Refus**, jamais traité comme 0 | ⚠️ |
| R21 | Vide | Refus | ✅ |
| R22 | Négatif (`-500`) | Refus | ✅ |
| R23 | `1e9` en notation scientifique | Refus | ✅ |
| R24 | `5000.5` (décimal) | Refus ou arrondi annoncé, jamais tronqué en silence | ❌ |

### Le pourboire

| # | Saisie | Attendu | |
| --- | --- | --- | --- |
| R25 | Pourboire au-dessus du plafond (1 000 000) | Refus | ✅ |
| R26 | Pourboire négatif | Refus | ✅ |
| R27 | Pourboire invalide alors que le pourboire est **fermé** | Ignoré, achat normal | ✅ |

### Les autres champs

| # | Champ | Épreuve | |
| --- | --- | --- | --- |
| R28 | Prix d'une ressource | Au-dessus de 100 000 000 → refus | ✅ |
| R29 | Mots-clés | Au-delà de 12 → refus ou troncature annoncée | ⚠️ |
| R30 | Motif de refus en modération | Moins de 8 caractères → refus | ✅ |
| R31 | Slug | Deux ressources, même titre → deux slugs distincts | ✅ |
| R32 | Mot de passe à l'inscription | Trop court → refus avec la règle énoncée | ✅ |
| R33 | Courriel | `pas-une-adresse` → refus | ✅ |
| R34 | Champ personnalisé obligatoire | Laissé vide → l'achat est refusé | ✅ |
| R35 | Code promo inexistant | Refus, sans révéler s'il a existé | ✅ |
| R36 | Code promo désactivé | Refus | ⚠️ |

### Les fichiers

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R37 | Téléverser un fichier au-delà de la taille permise | Refus avant l'envoi complet | ✅ |
| R38 | Téléverser un type non permis | Refus | ✅ |
| R39 | Publier une ressource **sans fichier source** | Refus — sinon l'acheteur paie pour rien | ✅ |
| R40 | Publier avec seulement un aperçu | Refus | ✅ |

---

## 5. Validité — l'article 47

Le formulaire de notification juridique porte **six** exigences légales. Chacune
manquante doit être nommée, et la notification **enregistrée quand même** — la
date de première tentative est celle qui compte devant un juge.

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R41 | Déposer sans la correspondance préalable | Enregistré, « correspondance » listée comme manquante | ❌ |
| R42 | Déposer avec « tout mon site » comme localisation | Refus de la localisation — elle doit être précise | ✅ |
| R43 | Déposer sans les motifs | Enregistré, « motifs » manquant | ❌ |
| R44 | Compléter la notification | La **référence** et la **date d'origine** ne changent pas | ❌ |
| R45 | Une notification incomplète fait-elle courir le délai ? | **Non** — aucune échéance n'est posée | ✅ |

---

## 6. Le moment — deux onglets, deux gestes

Ces épreuves demandent deux fenêtres ouvertes côte à côte. Elles sont
fastidieuses et elles trouvent ce qu'aucune autre ne trouve.

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R46 | Double-cliquer « Acheter » | **Une** commande, pas deux | ✅ |
| R47 | Deux onglets achètent en même temps avec le même code à 1 usage | Un seul aboutit | ✅ |
| R48 | Deux onglets s'inscrivent à la dernière place d'un événement | Un seul aboutit | ✅ |
| R49 | Deux modérateurs tranchent le même dossier | Le second reçoit « déjà tranché », pas une seconde décision | ⚠️ |
| R50 | Deux modérateurs retirent le même contenu | Une seule échéance posée | ✅ |
| R51 | Publier depuis un onglet, supprimer depuis l'autre | Le second geste échoue proprement | ✅ |
| R52 | Rembourser deux fois la même vente | Le second refus, le solde n'est pas débité deux fois | ✅ |
| R53 | Revenir en arrière après un paiement et renvoyer le formulaire | Pas de second débit | ✅ |

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
| R54 | 11 connexions ratées de suite | Refusé, avec le délai d'attente — un message à l'écran pour un formulaire ; le HTTP 429 avec Retry-After est celui des routes API *(ligne corrigée le 25/09)* | ✅ |
| R55 | 4 dépôts juridiques en une heure | Refusé dès le quatrième *(ligne corrigée le 25/09)* | ✅ |
| R56 | Le refus dit-il quand revenir ? | Oui — et à l'heure dite, on repasse *(ligne corrigée le 25/09)* | ❌ |
| R57 | Le compteur repart-il à zéro sur un changement de page ? | **Non** | ✅ |

**Le dépôt juridique est à 3, sous le plancher de 5 de toutes les autres.** Ce
n'est pas une erreur de saisie : une offre d'emploi de trop ajoute une ligne
dans une file, une notification de trop fait retirer le travail de quelqu'un.

---

## 8. Les refus d'état — le bon geste au mauvais moment

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R58 | Acheter sa **propre** ressource | Refus | ✅ |
| R59 | Acheter une ressource déjà achetée | L'écran propose de télécharger, pas de repayer | ✅ |
| R60 | Supprimer une ressource **déjà vendue** | Refus, avec « dépublier » proposé à la place | ✅ |
| R61 | Publier une ressource sous **retrait juridique** | Refus expliqué | ✅ |
| R62 | Modifier une ressource sous retrait juridique | Refus | ✅ |
| R63 | Supprimer une ressource sous retrait juridique | Refus — c'est la pièce du litige | ✅ |
| R64 | Trancher un dossier **déjà tranché** | Refus | ✅ |
| R65 | Répondre à un dossier après l'échéance | Refus, ou réponse hors délai clairement dite | ✅ |
| R66 | S'inscrire deux fois au même événement | Refus | ✅ |
| R67 | Postuler deux fois à la même offre | Refus | ✅ |
| R68 | Rejoindre deux fois la même communauté | Sans effet, pas d'erreur | ✅ |
| R69 | Renouveler un abonnement annulé | Refus | ✅ |
| R70 | Télécharger après un remboursement | Refus, motif « remboursée » | ✅ |
| R71 | Télécharger avec le quota d'abonnement épuisé | Refus, motif « quota » | ✅ |
| R72 | Utiliser deux fois le même code de secours 2FA | Refus au second | ✅ |
| R73 | Réutiliser un jeton de réinitialisation déjà servi | Refus | ✅ |
| R74 | Ouvrir un lien de réinitialisation expiré | Refus daté | ✅ |

---

## 9. Ce qu'on n'a pas le droit de fuir

Un refus mal écrit renseigne autant qu'une acceptation.

| # | Épreuve | Attendu | |
| --- | --- | --- | --- |
| R75 | Connexion avec une adresse **inexistante** vs. un mauvais mot de passe | Le **même** message, et le même temps de réponse | ✅ |
| R76 | « Mot de passe oublié » sur une adresse inexistante | Le même message que sur une adresse connue | ✅ |
| R77 | Inscription avec une adresse déjà prise | Ne doit pas confirmer qu'elle est prise | ⚠️ |
| R78 | Page de dossier juridique du créateur | N'affiche **pas** le domicile du notifiant | ✅ |
| R79 | Message d'erreur technique | Aucune trace de pile, aucun nom de table | ✅ |
| R80 | Route cron sans secret | **404**, pas 401 | ✅ |

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

---

## Résultats — campagne du 25 septembre 2026

Passée au navigateur (Chromium sans tête, piloté par Playwright) contre un
**build de production** servi sur le port 3100, base de développement,
pilote de paiement `bac-a-sable`, courriels en console (vérifiés dans la
file `EmailOutbox`). Chaque case vient d'une vérification qui a réellement
tourné : écran ouvert, geste fait, et presque toujours une lecture en base à
la suite. Les captures d'écran sont dans le dossier de campagne.

**Bilan : 80 cases — **68** ✅ · **6** ⚠️ · **5** ❌ · **1** 🚫.**

Convention : ✅ conforme · ⚠️ marche, mais quelque chose cloche · ❌ défaut
réel · 🚫 pas éprouvable dans ce montage (la raison est dite).

### Ce qui ne passe pas

| # | | Constat |
| --- | --- | --- |
| R15 | 🚫 | Non éprouvable : AUCUN écran ne change un rôle, pour personne (N5). Le pouvoir « gérer les rôles » est déclaré et utilisé nulle part ; le seul chemin est scripts/promouvoir-admin.mjs, en ligne de commande. Un ADMIN ne peut donc pas changer de rôle par l'application — mais un SUPER_ADMIN non plus. |
| R18 | ⚠️ | Mesuré en P5.1 : 1 000 F sous un minimum de 2 000 → refusé, aucune commande — mais renvoyé sur la fiche SANS message : la table MESSAGES_ACHAT de la fiche produit ne connaît ni MONTANT_REFUSE ni CODE_REFUSE ni CHAMPS_INVALIDES (voir P4.3). |
| R20 | ⚠️ | Mesuré en P5.3 : « abc » comme montant → refusé, aucune commande, pas traité comme 0 — mais renvoyé sur la fiche SANS message : la table MESSAGES_ACHAT de la fiche produit ne connaît ni MONTANT_REFUSE ni CODE_REFUSE ni CHAMPS_INVALIDES (voir P4.3). |
| R24 | ❌ | « 5000.5 » dans le montant libre est ACCEPTÉ et la commande est créée à 50 005 F — dix fois le montant voulu, sans aucun message. Cause (lib/commerce/montant.ts, lireUnEntier) : tout point est retiré comme séparateur de milliers (/[s. ]/g), y compris là où il ne peut pas en être un. L’intention est écrite et juste (« 2.500 » doit valoir 2 500), mais un séparateur de milliers est suivi de trois chi |
| R29 | ⚠️ | 13 mots-clés : ressource créée avec 12 mots-clés — tronqué SANS le dire à l'écran |
| R36 | ⚠️ | Code désactivé (QAJ4VNG3), « Vérifier » : refusé — « Ce code n'est plus actif. » Mais ce message DIFFÈRE de celui d'un code inexistant (« Ce code n'existe pas. », R35) : l'écart dit qu'un code a existé sous ce nom. Portée faible (codes propres à chaque créateur), mais c'est exactement ce que R35 demandait de ne pas révéler. |
| R41 | ❌ | Mesuré en O2 (premier passage) : impossible de déposer une notification SANS correspondance préalable — le champ est `required`, le navigateur bloque l'envoi : aucune requête, aucun dossier, aucune référence. Le chemin « enregistrée, et l'écran dit ce qui manque » est inatteignable pour cet élément. Le commentaire du formulaire dit de `required` : « raccourci d'affichage, pas une garde » — c'est f |
| R43 | ❌ | Même cause que R41 : `motifs` est `required` dans components/juridique/formulaire.tsx, donc une notification sans motifs ne part jamais — elle n'est pas « enregistrée avec l'élément manquant ». Seuls prénoms, profession, nationalité, date et lieu de naissance peuvent manquer (O2, réf. NOT-2026-002). |
| R44 | ❌ | Mesuré en O3 : aucun moyen de compléter une notification — renvoyer le formulaire crée un SECOND dossier (NOT-2026-002 INCOMPLETE puis NOT-2026-003 RECUE) : référence et date d'origine ne suivent pas. |
| R49 | ⚠️ | Mesuré : NOT-2026-009, admin tranche « Remettre en ligne » et qa5 (MODERATOR) « Retrait définitif » au même instant → UNE seule décision (RETIREE, par qa5), une seule ligne au journal ; le second geste est refusé. Mais il lit « Écris un motif d'au moins huit caractères — et vérifie que le dossier est encore ouvert. » alors que son motif en faisait 46 : le refus est juste, le message ne dit pas « d |
| R56 | ❌ | Mesuré le 25/09, serveur redémarré à 13:55 UTC. Le refus DIT quand revenir — mais il dit faux. À 13:57, 11e connexion ratée : « Réessaie dans 3 minutes » ; 4e dépôt juridique : « Réessaie dans 4 minutes ». Réessayé à 14:00:10 et 14:00:16, soit 10 et 16 s APRÈS l'échéance annoncée : toujours refusé, et le message dit maintenant « 15 minutes » puis « 60 minutes ». Lu dans lib/securite/limites.ts : ` |
| R77 | ⚠️ | inscription avec une adresse déjà prise : « Un compte existe déjà avec cette adresse. » — le message CONFIRME qu'un compte existe pour cette adresse (/inscription). |

### Mesures complémentaires

Faites à côté d'une ligne, sans ligne à elles. Elles ne comptent pas dans le bilan.

| # | | Preuve |
| --- | --- | --- |
| R14b | ⚠️ | Mesuré à côté de R14 : le même ACCOUNTANT sur /dashboard/systeme/versements → HTTP 404 aussi, et son menu compte 10 liens, les mêmes qu'un MEMBER. Lu dans le code : `consulter_l_argent` n'est vérifié NULLE PART ; `agir_sur_l_argent` n'est exigé que par lib/payments/actions-admin.ts, une action posée sur l'écran des versements — que la garde `exigerAdministrateur` (consulter_le_systeme) ferme au co |
| R46b | ✅ | Mesuré : même acheteur (qa2), deux onglets, « Payer » au même instant sur « Illu femme au foulard » → 1 seule commande ; le second onglet revient sur la fiche avec « Deux achats sont partis en même temps. Réessaie. » (?achat=CONFLIT). |
| R79b | ⚠️ | Mesuré le 25/09 : /api/recherche?q=%00 (un octet nul, seul ou au milieu d'un mot) → HTTP 500. PostgreSQL rejette l'octet (« invalid byte sequence for encoding UTF8: 0x00 », code 22021) et l'erreur remonte telle quelle. Aucune trace dans la réponse, et les guillemets passent (requêtes paramétrées) — mais n'importe quel visiteur peut provoquer une erreur 500 et du bruit dans les journaux. Une recher |

### La preuve de chaque case

| # | | Preuve |
| --- | --- | --- |
| R1 | ✅ | sous le compte du client : HTTP 404, rien d'autrui affiché (« Modifier la fiche » absent) |
| R2 | ✅ | sous le compte du client : HTTP 404, rien d'autrui affiché (« Enregistrer les modifications » absent) |
| R3 | ✅ | sous le compte du client : HTTP 404, rien d'autrui affiché (« Kofi Mensah » absent) |
| R4 | ✅ | sous le compte du client : HTTP 404, rien d'autrui affiché (« Envoyer en relecture » absent) |
| R5 | ✅ | sous le compte du client : HTTP 404, rien d'autrui affiché (« candidature QA » absent) |
| R6 | ✅ | Mesuré en H8 : le CV est servi au recruteur (HTTP 303 → PDF de 599 octets) et refusé à un autre compte connecté — le candidat lui-même, qui n'est pas recruteur — en HTTP 404. |
| R7 | ✅ | Mesuré en J9 : l'export CSV des inscrits est servi à l'organisatrice et répond HTTP 404 à un inscrit. |
| R8 | ✅ | sous le compte du client : HTTP 404, rien d'autrui affiché (« Le paiement réussit » absent) |
| R9 | ✅ | fichier d'une ressource payante non achetée : HTTP 403, « Cette ressource n'est pas dans tes achats. Achète-la pour la télécharger. » |
| R10 | ✅ | sous le compte du client : HTTP 404, rien d'autrui affiché (« Renouveler · » absent) |
| R11 | ✅ | MEMBER (client) sur /dashboard/systeme/membres : HTTP 404 |
| R12 | ✅ | MEMBER (client) sur /dashboard/moderation : HTTP 404 |
| R13 | ✅ | MODERATOR : /dashboard/systeme/versements → HTTP 404 (refusé) ; témoin /dashboard/moderation → HTTP 200 (ouvert) |
| R14 | ✅ | Mesuré : un ACCOUNTANT (qa7, rôle posé par scripts/promouvoir-admin.mjs) sur /dashboard/moderation → HTTP 404, le refus attendu. |
| R15 | 🚫 | Non éprouvable : AUCUN écran ne change un rôle, pour personne (N5). Le pouvoir « gérer les rôles » est déclaré et utilisé nulle part ; le seul chemin est scripts/promouvoir-admin.mjs, en ligne de commande. Un ADMIN ne peut donc pas changer de rôle par l'application — mais un SUPER_ADMIN non plus. |
| R16 | ✅ | CONTENT_MANAGER sur /dashboard/moderation : HTTP 200 ; 2 offre(s) d'emploi en attente en base, AUCUNE à l'écran (elles exigent moderer_le_contenu) ; types affichés : aucun en attente |
| R17 | ✅ | chaque lien du menu, ouvert sous le rôle qui le voit — MEMBER : 10 liens, tous ouverts · MODERATOR : 11 liens, tous ouverts · ACCOUNTANT : 10 liens, tous ouverts · ADMIN : 19 liens, tous ouverts · CONTENT_MANAGER : 13 liens, tous ouverts |
| R18 | ⚠️ | Mesuré en P5.1 : 1 000 F sous un minimum de 2 000 → refusé, aucune commande — mais renvoyé sur la fiche SANS message : la table MESSAGES_ACHAT de la fiche produit ne connaît ni MONTANT_REFUSE ni CODE_REFUSE ni CHAMPS_INVALIDES (voir P4.3). |
| R19 | ✅ | Mesuré au niveau 2 : « QA Prix libre » (minimum 2 000 F) achetée à exactement 2 000 F par qa2 → OrderItem.price 2 000, SUCCESSFUL. |
| R20 | ⚠️ | Mesuré en P5.3 : « abc » comme montant → refusé, aucune commande, pas traité comme 0 — mais renvoyé sur la fiche SANS message : la table MESSAGES_ACHAT de la fiche produit ne connaît ni MONTANT_REFUSE ni CODE_REFUSE ni CHAMPS_INVALIDES (voir P4.3). |
| R21 | ✅ | montant vide : pas envoyé — le navigateur bloque (montant: Please fill out this field.) ; aucune commande |
| R22 | ✅ | montant −500 : refusé, aucune commande — renvoyé sur la fiche sans message (voir P4.3) |
| R23 | ✅ | « 1e9 » : refusé, aucune commande — renvoyé sur la fiche sans message |
| R24 | ❌ | « 5000.5 » dans le montant libre est ACCEPTÉ et la commande est créée à 50 005 F — dix fois le montant voulu, sans aucun message. Cause (lib/commerce/montant.ts, lireUnEntier) : tout point est retiré comme séparateur de milliers (/[s. ]/g), y compris là où il ne peut pas en être un. L’intention est écrite et juste (« 2.500 » doit valoir 2 500), mais un séparateur de milliers est suivi de trois chi |
| R25 | ✅ | pourboire 1 000 001 (plafond 1 000 000) : refusé, aucune commande — renvoyé sur la fiche sans message (MONTANT_REFUSE non traduit, voir P4.3) |
| R26 | ✅ | pourboire −100 : refusé, aucune commande — renvoyé sur la fiche sans message |
| R27 | ✅ | pourboire fermé sur B : le champ n'est pas rendu ; un « pourboire=abc » INJECTÉ dans le formulaire est ignoré par le serveur → commande normale à 2500 F, tipAmount 0 |
| R28 | ✅ | prix 200 000 000 (maximum 100 000 000) : refusé — « Ce prix n'est pas valide. » |
| R29 | ⚠️ | 13 mots-clés : ressource créée avec 12 mots-clés — tronqué SANS le dire à l'écran |
| R30 | ✅ | motif « Court » (5 caractères, minimum 8) : refus rejeté, l'offre reste SOUMIS ; écran « » |
| R31 | ✅ | deux ressources, même titre : deux slugs distincts — qa-doublon-mugzoj9e et qa-doublon-mugzoj9e-2 |
| R32 | ✅ | mot de passe « abc » : refusé, aucun compte — « Le mot de passe doit faire au moins 8 caractères. » |
| R33 | ✅ | « pas-une-adresse » : refusé, aucun compte — navigateur : email: Please include an '@' in the email address. 'pas-une-adresse' is missing an '@'. |
| R34 | ✅ | question obligatoire du créateur laissée vide : pas d'achat — navigateur : champ:cmug4yxsy001mukc07d4xbuio: Please fill out this field. |
| R35 | ✅ | code inexistant, « Vérifier » : « Ce code n'existe pas. » |
| R36 | ⚠️ | Code désactivé (QAJ4VNG3), « Vérifier » : refusé — « Ce code n'est plus actif. » Mais ce message DIFFÈRE de celui d'un code inexistant (« Ce code n'existe pas. », R35) : l'écart dit qu'un code a existé sous ce nom. Portée faible (codes propres à chaque créateur), mais c'est exactement ce que R35 demandait de ne pas révéler. |
| R37 | ✅ | archive de 201 Mo (maximum annoncé : 200 Mo) : refusée, aucun fichier ajouté — « enorme.zip — Le fichier dépasse 200 Mo. » |
| R38 | ✅ | « installeur.exe » : refusé, aucun fichier ajouté — « installeur.exe — Format non accepté. Formats acceptés : PNG, JPG, AI, PSD, SVG, TTF, MP4, ZIP. » |
| R39 | ✅ | Mesuré en C5 : sans fichier source, « Publier la ressource » est désactivé (« Attache au moins un fichier avant de publier »). |
| R40 | ✅ | ressource avec 1 aperçu et 0 fichier source : « Publier la ressource » reste désactivé — un aperçu n'est pas une livraison |
| R41 | ❌ | Mesuré en O2 (premier passage) : impossible de déposer une notification SANS correspondance préalable — le champ est `required`, le navigateur bloque l'envoi : aucune requête, aucun dossier, aucune référence. Le chemin « enregistrée, et l'écran dit ce qui manque » est inatteignable pour cet élément. Le commentaire du formulaire dit de `required` : « raccourci d'affichage, pas une garde » — c'est f |
| R42 | ✅ | « tout mon site » : enregistré INCOMPLETE (NOT-2026-007), manque « localisation » — l'écran : « L'adresse exacte de chaque contenu visé, une par ligne. « Tout le profil » ne localise rien. » |
| R43 | ❌ | Même cause que R41 : `motifs` est `required` dans components/juridique/formulaire.tsx, donc une notification sans motifs ne part jamais — elle n'est pas « enregistrée avec l'élément manquant ». Seuls prénoms, profession, nationalité, date et lieu de naissance peuvent manquer (O2, réf. NOT-2026-002). |
| R44 | ❌ | Mesuré en O3 : aucun moyen de compléter une notification — renvoyer le formulaire crée un SECOND dossier (NOT-2026-002 INCOMPLETE puis NOT-2026-003 RECUE) : référence et date d'origine ne suivent pas. |
| R45 | ✅ | Mesuré en O2 : la notification incomplète NOT-2026-002 est enregistrée sans échéance (replyDueAt nul) — aucun délai ne court. |
| R46 | ✅ | double-clic sur « Payer » (qa7, icônes transport) : 1 commande (IN_PROGRESS / IN_PROGRESS), arrivé sur /achat/cmuh0p4c6000puk7w29j1cxbg |
| R47 | ✅ | Mesuré : code UNIQUE0OXJR à 1 usage (posé en base), qa3 et qa5 paient « Nappe sonore Harmattan » au même instant → 1 seule commande porte le code, usesCount 1/1. Le perdant lit « Deux achats sont partis en même temps. Réessaie. » — exact sur le moment, mais s'il réessaie avec le code épuisé il tombe sur le refus muet de P4.3 (CODE_REFUSE sans message). |
| R48 | ✅ | Mesuré : une seule place (capacité posée en base au compteur + 1), qa3 et qa7 cliquent « M'inscrire » au même instant → 1 inscription nouvelle, compteur 3/3 ; le second lit « Toutes les places sont prises. » Réserve : la capacité a dû être ajustée parce que le compteur de l'événement était déjà faux (2 pour 1 inscrit — voir S39). |
| R49 | ⚠️ | Mesuré : NOT-2026-009, admin tranche « Remettre en ligne » et qa5 (MODERATOR) « Retrait définitif » au même instant → UNE seule décision (RETIREE, par qa5), une seule ligne au journal ; le second geste est refusé. Mais il lit « Écris un motif d'au moins huit caractères — et vérifie que le dossier est encore ouvert. » alors que son motif en faisait 46 : le refus est juste, le message ne dit pas « d |
| R50 | ✅ | Mesuré : NOT-2026-009 (cible : un brouillon QA), admin et qa5 cliquent « Retirer à titre provisoire » au même instant → RETRAIT_PROVISOIRE, UNE échéance (05/10 13:43), 1 ligne LegalSuspension, 1 « contenu.retirer » au journal ; l'autre lit « Ce dossier n'est plus dans un état qui permet ce geste. » |
| R51 | ✅ | Mesuré : brouillon QA muni d'un fichier (posé en base). Onglet A « Supprimer » → ligne effacée. Onglet B, resté sur l'ancienne page, « Publier la ressource » → POST 404, page « Erreur 404 », rien de ressuscité ni publié. Propre, mais muet : l'écran ne dit pas que la ressource a été supprimée entre-temps. |
| R52 | ✅ | Mesuré (serveur en mode simulation) : vente simulée de 10 000 F à qa7 ; deux onglets du créateur ouvrent « Rembourser… » (10 000 F proposés des deux côtés) et confirment au même instant → refundedAmount 10 000, UN mouvement REFUND −10 000 à côté du SALE 8 850, solde du vendeur 49 295 → 39 295 : débité une fois. Le second onglet affiche l'état à jour (« Intégralement remboursée, accès retiré. État  |
| R53 | ✅ | qa7 paie le pack icônes cuisine, puis : page de paiement rouverte : plus de bouton de paiement ; retour arrière : formulaire sans bouton « Payer » → 1 commande(s) dont 1 réussie, 1 crédit au vendeur — un seul débit |
| R54 | ✅ | dix essais ratés : « Adresse ou mot de passe incorrect. » ; le 11e : « Trop de tentatives. Réessaie dans 3 minutes. » — c'est un message d'action serveur (HTTP 200), pas un HTTP 429 : le 429 à en-tête Retry-After (lib/securite/garde.ts) sert les routes API |
| R55 | ✅ | quatre dépôts depuis la même adresse, serveur redémarré juste avant : 1 : NOT-2026-010 · 2 : NOT-2026-011 · 3 : NOT-2026-012 · 4 : refusé « Trop de dépôts depuis cette connexion. Réessaie dans 4 minutes. Si tu dois signaler plusieurs contenus, une seule notification peut en lister plusieurs — une adresse par ligne. » ; 3 dossiers créés en base |
| R56 | ❌ | Mesuré le 25/09, serveur redémarré à 13:55 UTC. Le refus DIT quand revenir — mais il dit faux. À 13:57, 11e connexion ratée : « Réessaie dans 3 minutes » ; 4e dépôt juridique : « Réessaie dans 4 minutes ». Réessayé à 14:00:10 et 14:00:16, soit 10 et 16 s APRÈS l'échéance annoncée : toujours refusé, et le message dit maintenant « 15 minutes » puis « 60 minutes ». Lu dans lib/securite/limites.ts : ` |
| R57 | ✅ | 5 échecs, puis /explore, puis un navigateur NEUF (aucun cookie) sur /connexion, puis 5 échecs encore acceptés et le 11e refusé — le compteur a suivi l'adresse, pas la page ni la session |
| R58 | ✅ | Refusé : aucune commande possible sur sa propre ressource — la fiche ne propose pas « Acheter » au créateur, et /acheter/<sa ressource> le renvoie sur la fiche. Réserve : ce renvoi se fait SANS le motif (?achat=SA_PROPRE_RESSOURCE), donc sans le message « On n'achète pas sa propre ressource. » qui existe dans la table de la fiche. |
| R59 | ✅ | ressource déjà achetée : aucun « Acheter », 1 lien(s) de téléchargement |
| R60 | ✅ | ressource vendue (7 lignes de commande) : « Supprimer » n'est pas proposé, « Retirer de la vente » l'est (1) ; côté serveur, supprimerRessource refuse aussi (?erreur=vendue) |
| R61 | ✅ | Mesuré en P10.5 et O8 : « Publier la ressource » sur une ressource retirée → ?erreur=retrait-juridique, message « Cette ressource fait l'objet d'une notification juridique… », statut inchangé. |
| R62 | ✅ | Mesuré en P10.5 : « Enregistrer les modifications » sur une ressource retirée → refusé (?erreur=retrait-juridique), titre intact en base. |
| R63 | ✅ | Mesuré en P10.5 : « Supprimer » sur une ressource retirée → refusé (?erreur=retrait-juridique), la ressource existe toujours, SUSPENDED. |
| R64 | ✅ | dossier NOT-2026-005 déjà tranché (RESTAUREE) : sorti de la liste des dossiers en cours ; côté serveur, trancher() refuse tout état hors RECUE/INCOMPLETE/RETRAIT_PROVISOIRE/CONTESTEE |
| R65 | ✅ | échéance dépassée (posée en base, dossier rattaché en base) : plus de formulaire de réponse sur « Mes dossiers » —  |
| R66 | ✅ | déjà inscrit : l'écran propose « Me désinscrire », jamais une seconde inscription ; 1 seule ligne EventRegistration |
| R67 | ✅ | le candidat revient sur « postuler » : plus de formulaire ; écran « Ta candidature est partie · Envoyée le 25 septembre. L'annonceur te répondra directement — nous ne gardons pas de fil de discussion ici. » ; toujours 1 JobApplication (unicité offre × personne) |
| R68 | ✅ | déjà membre : l'écran propose « Quitter », jamais un second « Rejoindre » ; 1 seule adhésion |
| R69 | ✅ | abonnement annulé (posé en base) : l'écran dit « ABONNEMENT CLOS », aucun bouton de paiement ; il propose « Prendre un nouvel abonnement » — qui, faute de souscription dans l'application (L-souscrire), ne mène nulle part |
| R70 | ✅ | télécharger après un remboursement : HTTP 403, motif « remboursée » (Cette commande a été remboursée : le fichier n'est plus accessible.) |
| R71 | ✅ | forfait Explorer, quota du mois 15/15 (posé en base) : nouvelle ressource refusée, HTTP 403, « Tu as utilisé tous les téléchargements de ton forfait ce mois-ci. » |
| R72 | ✅ | Mesuré en P12.2 : un code de secours accepté une fois est refusé à la connexion suivante. |
| R73 | ✅ | lien lu dans le courriel en file, mot de passe changé (→ /connexion) ; le même lien rouvert : « LIEN ÉPUISÉ » — il ne sert qu'une fois |
| R74 | ✅ | lien expiré (échéance posée en base à H−1 min) : pas de formulaire, « LIEN ÉPUISÉ » |
| R75 | ✅ | Mesuré en B3 : mot de passe faux et adresse inconnue donnent le même message — « Adresse ou mot de passe incorrect. » — en 671 ms et 675 ms. |
| R76 | ✅ | ce qui apparaît après l'envoi, pour une adresse connue et pour une adresse inconnue : identique — « Si un compte existe à cette adresse, un lien vient d'y partir. Il est valable une heure. » |
| R77 | ⚠️ | inscription avec une adresse déjà prise : « Un compte existe déjà avec cette adresse. » — le message CONFIRME qu'un compte existe pour cette adresse (/inscription). |
| R78 | ✅ | page « Mes dossiers » du créateur (dossier rattaché en O10) : le domicile du notifiant (« 12 rue des Jardins, Cocody, Abidjan ») n'apparaît pas ; son nom : affiché |
| R79 | ✅ | six requêtes malformées, aucune trace de pile ni nom de table dans les réponses : /api/recherche?q=%00%27%22 → 500 ; /api/feed?cursor=nimportequoi → 200 ; /api/feed?filtre=%3Cscript%3E → 200 ; /products/%E0%A4%A → 400 ; /api/telechargement/xxxxxxxxxxxxxxxx → 404 ; /achat/pas-un-identifiant → 404 |
| R80 | ✅ | Mesuré au niveau 1 (section P) : les cinq routes cron sans secret répondent HTTP 404, jamais 401. |
