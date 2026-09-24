# Qualitytest — Niveau 4 : le silence

**Les trois niveaux précédents cherchaient des symptômes. Celui-ci cherche ce
qui n'en a pas.**

Un défaut qui plante se corrige : quelqu'un le voit, quelqu'un l'ouvre. Un
défaut qui **réussit en ne faisant rien** ne se corrige jamais, parce que
personne ne le voit. L'écran dit « c'est fait ». Le journal dit « c'est fait ».
La notification dit « c'est fait ». Et rien n'a eu lieu.

Aucune épreuve des niveaux 1, 2 et 3 ne le trouve. Le niveau 1 coche « l'écran
s'ouvre » : il s'ouvre. Le niveau 2 coche « la chaîne aboutit » : elle aboutit,
puisqu'elle annonce son aboutissement. Le niveau 3 coche « le refus refuse » :
il n'y a pas de refus à tester, tout a été accepté.

**Ce document ne donne pas une liste à cocher. Il donne huit formes, tirées de
défauts réels de ce dépôt, et la méthode pour les chercher partout ailleurs.**

---

## 1. Ce qui rend ce niveau nécessaire

Onze défauts trouvés sur ce projet entre le 3 et le 24 septembre 2026. **Aucun
n'a levé d'erreur.** Voici ce qu'ils avaient en commun.

| Ce qui a été trouvé | Ce que l'écran disait | Comment il a été trouvé |
| --- | --- | --- |
| Le retrait juridique ne retirait aucun produit | « Contenu retiré » — au dossier, au journal, et au créateur par courriel | En lisant la fonction ligne à ligne |
| `/api/cron/blog` n'avait aucune ligne dans `vercel.json` | La route répondait parfaitement | Par hasard, six versions plus tard |
| Dix visuels écartés pour marque réelle étaient servis publiquement | Ils n'apparaissaient nulle part dans l'application | En tapant leur URL |
| Une saisie invalide devenait un pourboire de zéro franc | « Merci pour ton achat » | Un test écrit exprès pour ce cas |
| Le script de vérification comptait faux — deux fois, dans les deux sens | Il rendait un nombre plausible | En le comparant à la source |
| Le test censé empêcher la dérive d'une liste vérifiait 3 types sur 8 | Vert | En comptant ce qu'il vérifiait |
| Une garde de prix plancher ne pouvait pas se déclencher | Vert | En cherchant à l'exercer |
| `JSON.stringify` n'échappe pas `</script>` dans le JSON-LD | La page se rendait | En relisant l'affirmation du commentaire |
| Les codes de secours 2FA n'étaient jamais affichés | Ils étaient bien générés, et les tests le prouvaient | Au navigateur |
| `ModerationLog` n'est écrit par aucun code | La table existe, le schéma est cohérent | En cherchant qui la lit |
| Une base d'ombre mal nommée a vidé la base de développement | Le SQL correct est sorti deux fois | Vingt minutes plus tard, au hasard d'une connexion |

**Deux choses ressortent.** D'abord, la plupart ont été trouvés en **regardant
ailleurs que là où le travail avait été fait**. Ensuite, dans presque tous les
cas, quelque chose affirmait le contraire — un commentaire, un message, un
journal, un test vert.

---

## 2. Les huit formes

### Forme A · L'effet annoncé là où il n'est pas produit

Un module change son propre état et annonce un effet qui appartient à un autre
module. Personne ne vérifie jamais l'autre module, parce que l'annonce suffit.

> Le retrait juridique écrivait « contenu.retirer » dans le journal, posait
> l'état `RETRAIT_PROVISOIRE` et envoyait « un de tes contenus a été retiré ».
> Il ne touchait pas au produit. L'en-tête du module affirmait que « le contenu
> est masqué par la modération » — vrai pour le forum, faux pour les produits.

**Comment le chercher.** Pour chaque geste qui produit un message de succès,
faire la liste des endroits que ce message engage, et les ouvrir **un par un**.

| # | Geste | Endroits engagés par son message — tous à vérifier | |
| --- | --- | --- | --- |
| S1 | « Contenu retiré » | La fiche (404), le fil, la recherche, le téléchargement, le tableau de bord du créateur | ☐ |
| S2 | « Ressource publiée » | `/explore`, `/products/<slug>`, le profil du créateur, l'API du fil, la recherche | ☐ |
| S3 | « Ressource dépubliée » | Les cinq mêmes, en négatif | ☐ |
| S4 | « Commande remboursée » | Le solde du vendeur, le droit de télécharger, l'écran de l'acheteur | ☐ |
| S5 | « Compte bloqué » | La connexion, les sessions ouvertes, les ressources, les versements | ☐ |
| S6 | « Événement annulé » | La page publique, les inscrits prévenus, la liste des événements | ☐ |
| S7 | « Communauté fermée » | La liste publique, l'écriture dans le fil, les membres | ☐ |
| S8 | « Notification envoyée » | La cloche, le courriel dans la file, la préférence de l'utilisateur | ☐ |
| S9 | « Effacement RGPD exécuté » | Le compte, le profil, les IP, les ressources — et ce qui doit **survivre** | ☐ |

**La question à poser, pour chacun : « qu'est-ce que ce message promet à
quelqu'un qui ne lit pas le code ? »** C'est cette promesse-là qu'on vérifie,
pas l'écriture en base.

---

### Forme B · La liste recopiée

Une liste écrite à la main à côté d'une source d'autorité. Elle est juste le
jour où on l'écrit. Elle ne le reste pas.

> Trois écrans écrivaient `status === "PUBLISHED" ? "En ligne" : "Brouillon"`.
> Le jour où un quatrième état est apparu, il s'est affiché « Brouillon » — et
> le créateur d'une ressource sous retrait juridique lisait qu'elle était en
> brouillon.
>
> Pire : le test **censé empêcher** ce genre de dérive annonçait vérifier huit
> types et en vérifiait trois. Un `try/catch` transformait « absent » en « pas
> vérifié », sans un mot.

**Comment le chercher.** Repérer toute énumération qui existe deux fois, et
vérifier que la seconde copie connaît le dernier ajout de la première.

| # | Liste | Sa source d'autorité | |
| --- | --- | --- | --- |
| S10 | Les libellés d'état de ressource | `enum ProductStatus` | ☐ |
| S11 | Les libellés de motif de refus de téléchargement | `type RefusAcces` | ☐ |
| S12 | Les routes planifiées | `vercel.json` ↔ `app/api/cron/*` — **dans les deux sens** | ☐ |
| S13 | Les familles du rail latéral | `enum ProductFamily` | ☐ |
| S14 | Les pouvoirs affichés par rôle | la table de `administration.ts` | ☐ |
| S15 | Les états de commande affichés | `enum PurchaseState` / `OrderStatus` | ☐ |
| S16 | Les modèles de courriel | le catalogue des événements de notification | ☐ |
| S17 | Les devises acceptées | `enum Currency` | ☐ |

**S12 mérite les deux sens.** Une route sans horaire est du code mort qu'on
croit vivant ; un horaire sans route est un 404 périodique qu'on apprend à
ignorer. Aucun des deux ne se voit dans un diff, les fichiers étant dans des
dossiers différents.

**L'épreuve au navigateur** : ajouter une valeur à une énumération n'est pas
faisable en test manuel. Ce qu'on peut faire, c'est **chercher l'état le plus
récent partout** — ici `SUSPENDED` — et vérifier qu'aucun écran ne le rend
comme autre chose.

---

### Forme C · La garde qui ne peut pas se déclencher

Un `if` qui ne sera jamais vrai. Il ne casse rien. Il laisse croire qu'un cas
est couvert.

> Une garde « le corps ne contient aucun texte affichable » ne pouvait jamais
> s'exécuter. Une garde de prix plancher non plus : `prixPlancher()` rend 1, la
> remise est arrondie vers le bas, donc `prix − remise ≥ 1` toujours.

**Comment le chercher.** Pour chaque garde annoncée dans l'interface, essayer de
la faire tomber. Si on n'y arrive pas, ce n'est pas une garde solide : c'est une
garde qu'on n'a pas su exercer, et les deux se ressemblent.

| # | Garde annoncée | Essayer de la déclencher | |
| --- | --- | --- | --- |
| S18 | « Pas moins de X francs » sur le montant libre | Y arriver, ou constater qu'elle est inatteignable | ☐ |
| S19 | La réduction de parité ne descend pas sous le plancher | Inatteignable tant que `PppFactor` est vide — **le noter, pas le cocher** | ☐ |
| S20 | Le quota de téléchargements d'abonnement | L'épuiser vraiment | ☐ |
| S21 | Le plafond de pourboire | L'atteindre | ☐ |
| S22 | La limite de places d'un événement | La saturer | ☐ |
| S23 | Le nombre maximal de mots-clés | Le dépasser | ☐ |

**Quand une garde est inatteignable, l'écrire ainsi** — « inatteignable
aujourd'hui, parce que X » — plutôt que de la cocher ou de la barrer. Une garde
qu'on retire « parce qu'elle ne sert pas » est une garde qu'il faudra réécrire
sous pression.

---

### Forme D · Le zéro qui passe pour une valeur

`null`, `0`, `[]`, `undefined` acceptés là où ils signifient « je n'ai pas su
lire » plutôt que « la valeur est zéro ».

> `lireUnEntier(saisie) ?? 0` : une saisie invalide devenait un pourboire de
> zéro franc. Aucun message, achat normal, créateur volé de son pourboire.
>
> Ailleurs, une route rendait `{"status": "succeeded"}` sans montant, et
> l'adaptateur en tirait un paiement réussi à zéro franc.

**Comment le chercher.** Sur chaque **chemin de succès**, demander explicitement
ce qui manque. Le chemin d'erreur crie ; le chemin de succès chuchote.

| # | Écran de succès | Ce qui pourrait manquer sans que ça se voie | |
| --- | --- | --- | --- |
| S24 | Confirmation d'achat | Le montant est-il **affiché** et non nul ? | ☐ |
| S25 | Écran des gains | Un solde à 0 après une vente est-il distingué d'un solde vide ? | ☐ |
| S26 | Liste des ventes | Une vente à 0 F apparaît-elle, ou est-elle filtrée en silence ? | ☐ |
| S27 | Statistiques | Zéro vue est-il « 0 » ou une absence d'affichage ? | ☐ |
| S28 | Liste des fichiers d'une ressource | Zéro fichier est-il dit, ou juste une zone vide ? | ☐ |
| S29 | Résultats de recherche | Zéro résultat est-il dit, ou une page vide ? | ☐ |
| S30 | Bilan d'un passage cron | `{"vus":0,"publies":0}` distingue-t-il « rien à faire » de « rien lu » ? | ☐ |
| S31 | Bilan d'un retrait juridique | « 0 ressource retirée » est-il dit ? | ☐ |
| S32 | Export des inscrits | Un fichier vide est-il distingué d'un export échoué ? | ☐ |

**S31 est celui qui a motivé ce document.** Sans lui, « retiré » s'affiche à
l'identique qu'on ait retiré trois ressources ou zéro.

---

### Forme E · Le vérificateur qui se trompe

Un contrôle qui rend un résultat faux. C'est pire que pas de contrôle du tout,
parce qu'on lui fait confiance.

> Le script de vérification du catalogue s'est trompé **deux fois en deux
> jours**, dans les deux sens : 128 au lieu de 150, puis 239 au lieu de 229. Les
> deux fois, il a rendu un nombre plausible, et les deux nombres ont été
> publiés.

**Comment le chercher.** Pour chaque compteur affiché, le recompter à la main
une fois. Une seule fois suffit — c'est l'écart qui renseigne, pas la
répétition.

| # | Compteur affiché | Recompter à la main | |
| --- | --- | --- | --- |
| S33 | « N ressources » sur un profil | Les compter dans la liste | ☐ |
| S34 | « N ventes » sur le tableau de bord | Les compter dans `/dashboard/ventes` | ☐ |
| S35 | Le compteur de notifications non lues | Les compter dans la liste | ☐ |
| S36 | « N en attente » sur la file de modération | Les compter dans la file | ☐ |
| S37 | Le compteur de téléchargements d'une ressource | Télécharger une fois, vérifier +1 | ☐ |
| S38 | Le compteur de « j'aime » | Aimer, vérifier +1, retirer, vérifier −1 | ☐ |
| S39 | Le nombre de places restantes d'un événement | S'inscrire, vérifier −1 | ☐ |
| S40 | Le solde affiché | Le recalculer depuis les lignes de mouvement | ☐ |

**Un écart de 1 est plus grave qu'un écart de 100.** Un écart de 100 se voit ;
un écart de 1 se prend pour un arrondi.

---

### Forme F · La portée du garde-fou

Un contrôle qui passe au vert en ne regardant pas là où ça se passe.

> `tsc --noEmit` lit la **source** ; le consommateur d'un paquet lit le
> **paquet construit**. Quatre voyants au vert, et le champ annoncé livré
> n'atteignait personne.
>
> Un `grep` en quatre termes avec un glob qui excluait `.mjs` et `.js` a servi
> à affirmer qu'un projet ne rendait d'HTML nulle part.

**Comment le chercher.** Pour chaque vérification qu'on s'apprête à croire,
écrire d'abord **ce qu'elle ne regarde pas**.

| # | Vérification | Ce qu'elle ne regarde pas | |
| --- | --- | --- | --- |
| S41 | Le typecheck | Les règles `"use server"`, le rendu, les données | ☐ |
| S42 | Les tests d'intégration | Que Next serve la route à l'adresse appelée | ☐ |
| S43 | La campagne e2e | Ce qui n'est pas dans ses 19 parcours | ☐ |
| S44 | « L'écran affiche le bon nombre » | Que le nombre vienne de la bonne source | ☐ |
| S45 | « La base contient la bonne ligne » | Que toutes les portes soient fermées | ☐ |
| S46 | `npm run build` | Que la page soit lisible et utilisable | ☐ |

**La règle** : un contrôle qui ne dit rien ne veut pas dire « rien n'a changé ».
Il veut dire « rien n'a changé **dans ce que je regarde** ».

---

### Forme G · Le second écrivain

Deux endroits écrivent la même chose. Le dernier gagne, et le premier disparaît
sans bruit.

> `PutBucketPolicy` **remplace** le document entier. Deux scripts en posaient
> un : toutes les vignettes sont passées en 403, sans rien dans les journaux.
>
> Une base d'ombre mal nommée a détruit la base de développement. Le SQL correct
> est sorti les deux fois.

**Comment le chercher.** Identifier ce qui n'a qu'un seul exemplaire et
plusieurs candidats pour l'écrire.

| # | Ressource unique | Ses écrivains | |
| --- | --- | --- | --- |
| S47 | La politique du bucket MinIO | Deux `Sid` doivent coexister, pas un | ☐ |
| S48 | Le statut d'une ressource | Créateur, risque, RGPD, juridique — ils ne doivent pas s'écraser | ☐ |
| S49 | Le solde d'un vendeur | Vente, remboursement, litige, versement | ☐ |
| S50 | Les préférences de notification | L'écran de réglages et les valeurs par défaut | ☐ |
| S51 | Le cache d'une page | La revalidation après chaque geste qui la change | ☐ |

**S51 est le plus discret de tous au navigateur.** Une ressource retirée de la
base mais laissée en cache s'affiche encore. Toujours recharger **sans cache**
(Ctrl+Maj+R) avant de conclure qu'un retrait n'a pas eu lieu — et si elle
disparaît seulement alors, ce n'est pas un faux positif : c'est la revalidation
qui manque.

---

### Forme H · La branche qui masque l'autre

Deux affichages possibles, et le premier gagne toujours.

> Les codes de secours de la double authentification n'étaient **jamais**
> affichés : la branche « c'est activé » se rendait avant la branche « voici tes
> codes ». Les tests étaient verts — et ils avaient raison, la fonction
> *rendait* bien les codes. Personne ne les voyait.

**Comment le chercher.** Cette forme ne se trouve qu'au navigateur. Aucun test
d'unité ne l'attrape, parce que la fonction testée fait ce qu'on lui demande.

| # | Écran à deux états | Les deux se voient-ils vraiment ? | |
| --- | --- | --- | --- |
| S52 | Activation 2FA → codes de secours | **Les lire à l'écran**, pas les supposer | ☐ |
| S53 | Après un achat → l'upsell | Le voir | ☐ |
| S54 | Après un retrait → le bilan des adresses non atteintes | Le voir | ☐ |
| S55 | Après une publication refusée → le motif | Le voir | ☐ |
| S56 | Message de succès **et** message d'erreur sur le même écran | Provoquer les deux | ☐ |
| S57 | Liste vide vs. liste en chargement | Les distinguer | ☐ |

**La règle de ce document tout entier tient dans S52** : une fonctionnalité
qu'aucun humain n'a **vue** n'est pas livrée, quel que soit le nombre de tests
verts.

---

## 3. La méthode, pour les cas qui ne sont pas dans ce document

Les huit formes viennent de onze défauts. Il y en aura d'autres, d'autres
formes. Voici comment les chercher sans liste.

**Sur tout chemin de succès, poser trois questions.**

1. **Qu'est-ce que ce message promet ?** Pas ce que le code fait — ce qu'une
   personne qui lit le message en conclura. Puis vérifier cette conclusion-là.
2. **Qu'est-ce qui manque et ne se verrait pas ?** Un montant à zéro, un
   tableau vide, un identifiant nul, une date absente, une liste filtrée.
3. **Qui d'autre aurait dû bouger ?** Nommer les écrans, les tables, les
   fichiers, les caches. Les ouvrir. Un par un.

**Et quand on s'apprête à affirmer que quelque chose n'existe pas :** écrire
d'abord ce qu'il faudrait avoir lu pour en être sûr. Souvent, la phrase s'arrête
là.

---

## 4. Comment écrire ce qu'on trouve

Un constat de niveau 4 n'a pas de capture d'écran. Il faut donc qu'il porte sa
preuve.

**Distinguer ce qui est mesuré de ce qui est déduit, dans le texte.** Les deux
mots coûtent trois secondes et changent ce qu'un lecteur — soi-même dans six
mois — a le droit d'en faire.

```
Mesuré le 24/09 : /products/copie rend 200 après le retrait, contenu complet.
Déduit, non vérifié : la recherche doit aussi la servir, elle lit la même table.
```

Un fait mesuré porte sa date. Un fait déduit porte son raisonnement, et se
vérifie avant d'être relayé.

**Nommer ce qu'on n'a pas regardé.** « Le retrait ne ferme pas le
téléchargement » est utile. « Le retrait ne ferme pas le téléchargement ; je
n'ai pas vérifié la recherche ni le flux RSS » est utilisable.

---

## 5. Ce que ce niveau ne dit pas

**Il ne se termine pas.** Les trois premiers documents ont un nombre fini de
lignes et un moment où toutes sont cochées. Celui-ci n'en a pas : il décrit une
façon de regarder, et il y aura toujours un endroit où l'on n'a pas encore
regardé.

**Il ne remplace pas les tests automatiques.** Un défaut silencieux trouvé au
navigateur doit repartir en test, sinon il reviendra. Sur ce dépôt, une
affirmation fausse a survécu onze jours dans quatre fichiers parce que la garde
qu'elle décrivait n'avait aucun test — recopiée de l'un à l'autre, elle est
devenue une source.

**Il ne protège pas contre lui-même.** Ce document est une liste écrite à la
main. C'est exactement la forme B.
