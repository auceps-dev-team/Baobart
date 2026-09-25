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
| S1 | « Contenu retiré » | La fiche (404), le fil, la recherche, le téléchargement, le tableau de bord du créateur | ✅ |
| S2 | « Ressource publiée » | `/explore`, `/products/<slug>`, le profil du créateur, l'API du fil, la recherche | ✅ |
| S3 | « Ressource dépubliée » | Les cinq mêmes, en négatif | ✅ |
| S4 | « Commande remboursée » | Le solde du vendeur, le droit de télécharger, l'écran de l'acheteur | ✅ |
| S5 | « Compte bloqué » | La connexion, les sessions ouvertes, les ressources, les versements | ❌ |
| S6 | « Événement annulé » | La page publique, les inscrits prévenus, la liste des événements | ❌ |
| S7 | « Communauté fermée » | La liste publique, l'écriture dans le fil, les membres | ⚠️ |
| S8 | « Notification envoyée » | La cloche, le courriel dans la file, la préférence de l'utilisateur | ✅ |
| S9 | « Effacement RGPD exécuté » | Le compte, le profil, les IP, les ressources — et ce qui doit **survivre** | ❌ |

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
| S10 | Les libellés d'état de ressource | `enum ProductStatus` | ✅ |
| S11 | Les libellés de motif de refus de téléchargement | `type RefusAcces` | ✅ |
| S12 | Les routes planifiées | `vercel.json` ↔ `app/api/cron/*` — **dans les deux sens** | ✅ |
| S13 | Les familles du rail latéral | `enum ProductFamily` | ✅ |
| S14 | Les pouvoirs affichés par rôle | la table de `administration.ts` | ⚠️ |
| S15 | Les états de commande affichés | `enum PurchaseState` / `OrderStatus` | ❌ |
| S16 | Les modèles de courriel | le catalogue des événements de notification | ✅ |
| S17 | Les devises acceptées | `enum Currency` | ✅ |

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
| S18 | « Pas moins de X francs » sur le montant libre | Y arriver, ou constater qu'elle est inatteignable | ⚠️ |
| S19 | La réduction de parité ne descend pas sous le plancher | Inatteignable tant que `PppFactor` est vide — **le noter, pas le cocher** | 🚫 |
| S20 | Le quota de téléchargements d'abonnement | L'épuiser vraiment | ✅ |
| S21 | Le plafond de pourboire | L'atteindre | ⚠️ |
| S22 | La limite de places d'un événement | La saturer | ✅ |
| S23 | Le nombre maximal de mots-clés | Le dépasser | ⚠️ |

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
| S24 | Confirmation d'achat | Le montant est-il **affiché** et non nul ? | ✅ |
| S25 | Écran des gains | Un solde à 0 après une vente est-il distingué d'un solde vide ? | ❌ |
| S26 | Liste des ventes | Une vente à 0 F apparaît-elle, ou est-elle filtrée en silence ? | 🚫 |
| S27 | Statistiques | Zéro vue est-il « 0 » ou une absence d'affichage ? | ✅ |
| S28 | Liste des fichiers d'une ressource | Zéro fichier est-il dit, ou juste une zone vide ? | ✅ |
| S29 | Résultats de recherche | Zéro résultat est-il dit, ou une page vide ? | ❌ |
| S30 | Bilan d'un passage cron | `{"vus":0,"publies":0}` distingue-t-il « rien à faire » de « rien lu » ? | ✅ |
| S31 | Bilan d'un retrait juridique | « 0 ressource retirée » est-il dit ? | ❌ |
| S32 | Export des inscrits | Un fichier vide est-il distingué d'un export échoué ? | ✅ |

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
| S33 | « N ressources » sur un profil | Les compter dans la liste | ✅ |
| S34 | « N ventes » sur le tableau de bord | Les compter dans `/dashboard/ventes` | ❌ |
| S35 | Le compteur de notifications non lues | Les compter dans la liste | ✅ |
| S36 | « N en attente » sur la file de modération | Les compter dans la file | ℹ️ |
| S37 | Le compteur de téléchargements d'une ressource | Télécharger une fois, vérifier +1 | ✅ |
| S38 | Le compteur de « j'aime » | Aimer, vérifier +1, retirer, vérifier −1 | ✅ |
| S39 | Le nombre de places restantes d'un événement | S'inscrire, vérifier −1 | ❌ |
| S40 | Le solde affiché | Le recalculer depuis les lignes de mouvement | ❌ |

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
| S41 | Le typecheck | Les règles `"use server"`, le rendu, les données | ✅ |
| S42 | Les tests d'intégration | Que Next serve la route à l'adresse appelée | ✅ |
| S43 | La campagne e2e | Ce qui n'est pas dans ses 19 parcours | ✅ |
| S44 | « L'écran affiche le bon nombre » | Que le nombre vienne de la bonne source | ✅ |
| S45 | « La base contient la bonne ligne » | Que toutes les portes soient fermées | ✅ |
| S46 | `npm run build` | Que la page soit lisible et utilisable | ✅ |

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
| S47 | La politique du bucket MinIO | Deux `Sid` doivent coexister, pas un | ✅ |
| S48 | Le statut d'une ressource | Créateur, risque, RGPD, juridique — ils ne doivent pas s'écraser | ✅ |
| S49 | Le solde d'un vendeur | Vente, remboursement, litige, versement | ⚠️ |
| S50 | Les préférences de notification | L'écran de réglages et les valeurs par défaut | ✅ |
| S51 | Le cache d'une page | La revalidation après chaque geste qui la change | ✅ |

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
| S52 | Activation 2FA → codes de secours | **Les lire à l'écran**, pas les supposer | ✅ |
| S53 | Après un achat → l'upsell | Le voir | ✅ |
| S54 | Après un retrait → le bilan des adresses non atteintes | Le voir | ❌ |
| S55 | Après une publication refusée → le motif | Le voir | ❌ |
| S56 | Message de succès **et** message d'erreur sur le même écran | Provoquer les deux | ❌ |
| S57 | Liste vide vs. liste en chargement | Les distinguer | ❌ |

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

---

## Résultats — campagne du 25 septembre 2026

Passée au navigateur (Chromium sans tête, piloté par Playwright) contre un
**build de production** servi sur le port 3100, base de développement,
pilote de paiement `bac-a-sable`, courriels en console (vérifiés dans la
file `EmailOutbox`). Chaque case vient d'une vérification qui a réellement
tourné : écran ouvert, geste fait, et presque toujours une lecture en base à
la suite. Les captures d'écran sont dans le dossier de campagne.

**Bilan : 57 cases — **34** ✅ · **6** ⚠️ · **14** ❌ · **2** 🚫.**

Convention : ✅ conforme · ⚠️ marche, mais quelque chose cloche · ❌ défaut
réel · 🚫 pas éprouvable dans ce montage (la raison est dite).

### Ce qui ne passe pas

| # | | Constat |
| --- | --- | --- |
| S5 | ❌ | Mesuré le 25/09 sur createur@ (7 ressources en ligne, 3 sous retrait juridique, 1 brouillon). « Suspendre (conditions) » + motif → SUSPENDED_TOS : 7 sessions → 0, adresse ::1 bloquée, les 7 ressources en ligne passent ARCHIVED, fiche et profil publics en 404, connexion refusée. Tout ce que « suspendu » promet a lieu. Puis « Lever la suspension » + motif → COMPLIANT, adresse débloquée, connexion ro |
| S6 | ❌ | Mesuré le 25/09 sur « Atelier QA » (inscrits : client@ et qa7). Annulé depuis l'écran de l'organisatrice : la page publique dit « Cet événement est annulé » avec la raison, « M'inscrire » disparaît, la liste /evenements le marque « ANNULÉ » — les deux endroits publics tiennent la promesse. Les inscrits, non : trois annulations dans la journée (08:34, 14:18, 14:21), chacune suivie d'une levée. clie |
| S7 | ⚠️ | Mesuré le 25/09 : « Fermer » + motif sur « Communauté QA mugosqo4 » → closed. Les trois endroits engagés tiennent : sortie de la liste publique /communautes ; page HTTP 404 pour tous, donc plus d'écriture possible dans le fil ; les deux adhésions conservées (2 → 2), rendues intactes par « Rouvrir ». Ce que la fermeture tait : 0 avis aux membres (le catalogue n'a aucun type pour une fermeture — lib |
| S9 | ❌ | Mesuré en P15 : compte caviardé (efface-…@baobart.invalid), IP des téléchargements 2 → 0, ressource publiée ARCHIVED, ressource sous retrait laissée SUSPENDED, commandes et revenu du vendeur conservés — ce qui doit survivre survit. Mais l'effacement laisse une trace fausse ailleurs : qa4 occupait la dernière place de « Atelier QA » (P14.1, 13:05) ; effacé à 13:10, son inscription est supprimée (li |
| S14 | ⚠️ | Lu le 25/09 : les libellés des pouvoirs (LIBELLE_POUVOIR) ne sont affichés NULLE PART ; le seul affichage des pouvoirs est le menu, filtré par pouvoir. Mesuré en R17 : sous chacun des cinq rôles, chaque lien du menu s'ouvre — le menu dit vrai sur les pages. Mais il suit les gardes des pages, pas la table : ACCOUNTANT reçoit « consulter_l_argent » et « agir_sur_l_argent » dans administration.ts, et |
| S15 | ❌ | Mesuré : sur /dashboard/ventes, deux paiements ÉCHOUÉS (OrderItem FAILED, commandes ABANDONED : W3ZB2UY0 9 000 F, 8PPJ4MSD 8 000 F) et deux EN COURS (Y2NZ0MN7 50 005 F, 2MAZEWTB 2 500 F) s'affichent « PAYÉ · ENCAISSEE · Paiement encaissé, accès actif », avec « Rembourser… » et « Retirer l'accès… ». Le même achat Y2NZ0MN7 est « EN ATTENTE » sur l'écran de l'acheteur qa7. Lu dans lib/ventes/etats.ts |
| S18 | ⚠️ | Mesuré en P5.1/R18 : la garde se déclenche — 1 000 F sous un minimum de 2 000 F : aucune commande. Elle est atteignable et tient. Mais l'acheteur revient sur la fiche SANS message (MONTANT_REFUSE absent de MESSAGES_ACHAT, P4.3). |
| S19 | 🚫 | Inatteignable aujourd'hui, parce que la table PppFactor est vide : mesuré en P5.6, un achat depuis le Ghana avec la parité activée (plafond 30 %) donne pppDiscountBp = 0 — aucune réduction, donc aucun plancher à approcher. Noté, pas coché. |
| S21 | ⚠️ | « qa-affiche-fixe-mug4vng3 » : pourboire 1 000 001 F → aucune commande, renvoyé sur /products/qa-affiche-fixe-mug4vng3?achat=MONTANT_REFUSE SANS AUCUN MESSAGE (même table MESSAGES_ACHAT que P4.3 : POURBOIRE_TROP_HAUT arrive en MONTANT_REFUSE) ; pourboire 1 000 000 F → commande créée (/achat/cmuhkn2df001qukzoopj2x523), non payée — le plafond est atteint et tenu au franc près |
| S23 | ⚠️ | Mesuré en R29 : 13 mots-clés saisis → ressource créée avec 12. La limite tient, mais la troncature est silencieuse : l'écran ne dit pas lequel a été écarté. |
| S25 | ❌ | Mesuré en S40 : un solde NÉGATIF (−2 300 F) s'affiche « 0 F — rien à verser », à l'identique d'un solde vide. Le zéro ne distingue ni « rien gagné », ni « tout versé », ni « tu dois de l'argent ». |
| S26 | 🚫 | Inatteignable aujourd'hui : une vente à 0 F ne peut pas exister — prixPlancher() rend 1 F et la remise est arrondie vers le bas (forme C du document) ; une ressource gratuite ne crée pas de commande (D, P5.4). Ce qui a été trouvé en cherchant est l'inverse du cas prévu : la liste ne filtre RIEN, pas même les paiements échoués (S15). |
| S29 | ❌ | Mesuré : « zzqxwvk » tapé dans la recherche de l'en-tête, 2,5 s d'attente puis Entrée → RIEN : pas de « aucun résultat », pas de page de résultats, /explore inchangé (24 ressources). /api/recherche rend {"items":[]}. Lu dans components/shell/header.tsx : les suggestions ne s'affichent que si `suggestions.length > 0` — zéro résultat, recherche en cours et recherche en panne (R79b : HTTP 500 sur un  |
| S31 | ❌ | Mesuré en O6 / P10.6 : le bilan « Ces adresses ne désignent aucune ressource… » n'apparaît JAMAIS — il vit dans l'état du composant RetirerProvisoirement, démonté dès que le dossier change d'état. « Retiré » s'affiche à l'identique qu'on ait retiré trois ressources ou zéro. (Défaut de la v1.69.0.) |
| S34 | ❌ | Mesuré : /dashboard/statistiques affiche « VENTES 0 », et « QA Affiche fixe · 4 dl · 0 ventes » alors que cette ressource compte plusieurs ventes réussies ; en base, 9 lignes de vente réussies pour ce créateur. Lu dans le code : ce compteur, le profil public (lib/createurs/queries.ts) et les cartes du fil (lib/feed/queries.ts) lisent Product.salesCount ; recherche du 25/09 dans lib, app, prisma et |
| S39 | ❌ | Mesuré le 25/09 : « s'inscrire → −1 » tient (R48 : compteur 2 → 3). Mais le compteur est faux d'une unité : participantsCount 2 pour 1 inscription réelle, puis 3 pour 2 après R48 ; la page publique affiche « PLACES 3 / 3 » avec deux inscrits et refuse le suivant. Cause mesurée et lue : l'effacement RGPD de qa4 a supprimé son inscription sans rendre la place (S9). Un écart de 1, pris pour une afflu |
| S40 | ❌ | Mesuré : /dashboard/gains du créateur affiche « SOLDE DISPONIBLE 0 F — rien à verser » et « EN ATTENTE DE VALIDATION 0 F ». En base, le solde du jour vaut −2 300 F (Balance du 25/09, UNPAID) : 41 595 F ont été préparés au versement (P11), puis deux ventes de 8 850 F et deux remboursements de 10 000 F ont suivi (P3, R52). Recalcul depuis les mouvements : 39 295 F gagnés, 41 595 F versés — le créate |
| S49 | ⚠️ | Mesuré : vente (+8 850), remboursement (−10 000, une seule fois même en double clic simultané, R52), versement (41 595 préparé une fois, pas de doublon au second passage, P11.3) — aucun n'écrase l'autre, la somme des mouvements est juste. Mais l'ordre compte et ne se voit pas : deux remboursements APRÈS le versement laissent le vendeur débiteur de 2 300 F, et l'écran l'affiche zéro (S40). Non épro |
| S54 | ❌ | Mesuré en O6 : le bilan des adresses non atteintes n'est jamais vu (voir S31) — la branche « changement d'état du dossier » démonte le composant qui le gardait. |
| S55 | ❌ | Mesuré en P9.3 et H4 : refuser une offre d'emploi ou un service n'envoie rien à l'auteur (0 notification) et aucun écran ne lui montre le motif. Lu le 25/09 : seuls les ÉVÉNEMENTS envoient CONTENU_REFUSE / CONTENU_PUBLIE (lib/evenements/redaction.ts) ; offres, services, articles et ressources n'appellent jamais notifier pour une décision de modération. |
| S56 | ❌ | Mesuré en B16 : « Annuler la demande » d'effacement réussit en base (0 demande ouverte), et juste après l'écran affiche « Demande enregistrée. L'effacement aura lieu le 24 octobre 2026, sauf annulation de ta part. » avec le formulaire rouvert — le message de succès du geste PRÉCÉDENT, l'inverse de la vérité. Un rechargement rétablit l'écran. |
| S57 | ❌ | Mesuré en S29 : la recherche de l'en-tête rend pareil une liste vide, une liste en chargement et une requête en échec — rien du tout (condition `suggestions.length > 0`, et aucun état de chargement ni d'erreur dans le composant). Les listes des écrans serveur, elles, disent leur vide (« Aucune commande », « Aucun fichier attaché… », « 12 non lues. »). |

### Mesures complémentaires

Faites à côté d'une ligne, sans ligne à elles. Elles ne comptent pas dans le bilan.

| # | | Preuve |
| --- | --- | --- |
| S5b | ❌ | Mesuré le 25/09 : pendant la suspension de createur@, client@ — un autre compte, en règle, connecté depuis la même adresse ::1 — ne peut plus se connecter. Reproduit seul avec la même ligne de blocage : il lit « Ce compte ne peut pas être utilisé. Écris-nous si tu penses que c'est une erreur. » — faux pour lui, c'est l'adresse qui est bloquée, pas son compte. Lu dans lib/domain/risque.ts : BLOQUER |
| S-90pc | ⚠️ | Mesuré : l'écran des gains annonce « 90 % du prix de vente te reviennent ». La vente de 10 000 F a crédité 8 850 F, soit 88,5 % : 1 000 F de commission ET 150 F de frais d'opérateur (P1.6). La phrase compte la commission et oublie les frais. |

### La preuve de chaque case

| # | | Preuve |
| --- | --- | --- |
| S1 | ✅ | Mesuré aux niveaux 1–2, les cinq endroits un par un : fiche /products/<slug> → 404 (O5, P10.2) ; absente de /explore (O5, P10.1) ; absente de la recherche (O5) ; téléchargement de l'acheteur refusé HTTP 403 avec le motif juridique (O9, P10.3) ; tableau de bord du créateur : pastille « Retirée (juridique) » + référence du dossier (O7, P10.4). Hors de cette liste, deux trous déjà notés : le créateur |
| S2 | ✅ | « QA brouillon visé mugz2hnr » publiée (PUBLISHED) — les cinq endroits, ouverts un par un, sans session : fiche HTTP 200 · /explore oui · profil oui · /api/feed oui · /api/recherche oui |
| S3 | ✅ | « Retirer de la vente » → DRAFT — les cinq mêmes, en négatif : fiche HTTP 404 · /explore non · profil non · /api/feed non · /api/recherche non |
| S4 | ✅ | Mesuré : les trois endroits engagés par « remboursée » — solde du vendeur débité une fois de 10 000 F (R52, P3.2) ; téléchargement refusé HTTP 403 « Cette commande a été remboursée : le fichier n'est plus accessible » (P3.3) ; écran de l'acheteur qa7 : « Commande #GCVXKY · 10 000 F · REMBOURSÉE » et « Total dépensé 6 000 F — remboursements déduits ». Réserve connue (D11) : le même écran affiche en |
| S5 | ❌ | Mesuré le 25/09 sur createur@ (7 ressources en ligne, 3 sous retrait juridique, 1 brouillon). « Suspendre (conditions) » + motif → SUSPENDED_TOS : 7 sessions → 0, adresse ::1 bloquée, les 7 ressources en ligne passent ARCHIVED, fiche et profil publics en 404, connexion refusée. Tout ce que « suspendu » promet a lieu. Puis « Lever la suspension » + motif → COMPLIANT, adresse débloquée, connexion ro |
| S6 | ❌ | Mesuré le 25/09 sur « Atelier QA » (inscrits : client@ et qa7). Annulé depuis l'écran de l'organisatrice : la page publique dit « Cet événement est annulé » avec la raison, « M'inscrire » disparaît, la liste /evenements le marque « ANNULÉ » — les deux endroits publics tiennent la promesse. Les inscrits, non : trois annulations dans la journée (08:34, 14:18, 14:21), chacune suivie d'une levée. clie |
| S7 | ⚠️ | Mesuré le 25/09 : « Fermer » + motif sur « Communauté QA mugosqo4 » → closed. Les trois endroits engagés tiennent : sortie de la liste publique /communautes ; page HTTP 404 pour tous, donc plus d'écriture possible dans le fil ; les deux adhésions conservées (2 → 2), rendues intactes par « Rouvrir ». Ce que la fermeture tait : 0 avis aux membres (le catalogue n'a aucun type pour une fermeture — lib |
| S8 | ✅ | « Soirée QA ter muh1tlfd » publié depuis la file : 1 notification dans la cloche (lue sur /dashboard/notifications : oui), 0 courriel en file — la préférence « courriel coupé » de S50 est respectée |
| S9 | ❌ | Mesuré en P15 : compte caviardé (efface-…@baobart.invalid), IP des téléchargements 2 → 0, ressource publiée ARCHIVED, ressource sous retrait laissée SUSPENDED, commandes et revenu du vendeur conservés — ce qui doit survivre survit. Mais l'effacement laisse une trace fausse ailleurs : qa4 occupait la dernière place de « Atelier QA » (P14.1, 13:05) ; effacé à 13:10, son inscription est supprimée (li |
| S10 | ✅ | Lu le 25/09 : une seule table, LIBELLE_STATUT: Record<ProductStatus, string> (lib/dashboard/lectures.ts), lue par les trois écrans (tableau de bord, liste des produits, fiche) — un état ajouté sans libellé ne compile pas. Mesuré au navigateur : l'état le plus récent, SUSPENDED, s'affiche « Retirée (juridique) » (O7), jamais « Brouillon ». Reste une couleur binaire `status === "PUBLISHED" ? jaune : |
| S11 | ✅ | Lu le 25/09 : MESSAGES: Record<RefusAcces, string> dans app/api/telechargement/[fichierId]/route.ts — les 8 motifs du type ont leur message, un 9e sans message ne compile pas. Mesurés au navigateur : REMBOURSE (P3.3), RETRAIT_JURIDIQUE (O9), ACCES_RETIRE (E4), QUOTA_EPUISE (R71, S20), ABONNEMENT_INACTIF (P8.7). |
| S12 | ✅ | Lu le 25/09, dans les deux sens : vercel.json déclare 7 routes (versements, courriels, commandes, abonnements, blog, juridique, securite) ; app/api/cron/ en contient 7, les mêmes. Aucune route sans horaire, aucun horaire sans route. Mesuré au niveau 1 (section P) : les 7 répondent, 404 sans secret. |
| S13 | ✅ | Lu et mesuré le 25/09 : enum ProductFamily = 10 familles ; les filtres de /explore (vus en S29) et le rail latéral (components/shell/nav-data.ts, ENTREES_RAIL) en montrent 10 + « Tous », les mêmes. Juste aujourd'hui, fragile demain : FAMILLE_PAR_LIBELLE est typé Record<Filtre, …> et non Record<ProductFamily, …>, et ENTREES_RAIL est une liste à la main — une famille ajoutée au schéma compilerait sa |
| S14 | ⚠️ | Lu le 25/09 : les libellés des pouvoirs (LIBELLE_POUVOIR) ne sont affichés NULLE PART ; le seul affichage des pouvoirs est le menu, filtré par pouvoir. Mesuré en R17 : sous chacun des cinq rôles, chaque lien du menu s'ouvre — le menu dit vrai sur les pages. Mais il suit les gardes des pages, pas la table : ACCOUNTANT reçoit « consulter_l_argent » et « agir_sur_l_argent » dans administration.ts, et |
| S15 | ❌ | Mesuré : sur /dashboard/ventes, deux paiements ÉCHOUÉS (OrderItem FAILED, commandes ABANDONED : W3ZB2UY0 9 000 F, 8PPJ4MSD 8 000 F) et deux EN COURS (Y2NZ0MN7 50 005 F, 2MAZEWTB 2 500 F) s'affichent « PAYÉ · ENCAISSEE · Paiement encaissé, accès actif », avec « Rembourser… » et « Retirer l'accès… ». Le même achat Y2NZ0MN7 est « EN ATTENTE » sur l'écran de l'acheteur qa7. Lu dans lib/ventes/etats.ts |
| S16 | ✅ | Lu le 25/09 : le catalogue compte 16 avis ; 14 désignent un modèle, tous présents dans enum EmailTemplate ; les 2 sans modèle (nouveau message, nouveau membre de communauté) sont annoncés à l'écran des réglages par « pas encore de courriel pour cet avis » plutôt qu'une bascule qui n'enverrait rien. La liste MODELES de lib/email/modeles.ts et l'enum du schéma : 17 = 17, dans les deux sens (comparai |
| S17 | ✅ | Lu le 25/09 : enum Currency = 8 devises ; les deux tables qui en dépendent (EXPONENT et SYMBOL, lib/i18n/money.ts) sont des Record<Currency, …> — une devise ajoutée sans format ne compile pas. Mesuré : tous les prix de la campagne s'affichent en F (XOF). |
| S18 | ⚠️ | Mesuré en P5.1/R18 : la garde se déclenche — 1 000 F sous un minimum de 2 000 F : aucune commande. Elle est atteignable et tient. Mais l'acheteur revient sur la fiche SANS message (MONTANT_REFUSE absent de MESSAGES_ACHAT, P4.3). |
| S19 | 🚫 | Inatteignable aujourd'hui, parce que la table PppFactor est vide : mesuré en P5.6, un achat depuis le Ghana avec la parité activée (plafond 30 %) donne pppDiscountBp = 0 — aucune réduction, donc aucun plancher à approcher. Noté, pas coché. |
| S20 | ✅ | forfait Explorer, quota posé en base à 14/15 : 15e ressource (affiche-wax-futurism) servie HTTP 302, quota 14/15 → 15/15 PAR LE TÉLÉCHARGEMENT ; 16e (boucle-kora-12-samples) refusée HTTP 403 « Tu as utilisé tous les téléchargements de ton forfait ce mois-ci. », quota inchangé 15/15 ; re-télécharger la 15e : HTTP 302, quota 15/15 (une ressource déjà prise ce mois ne recompte pas) |
| S21 | ⚠️ | « qa-affiche-fixe-mug4vng3 » : pourboire 1 000 001 F → aucune commande, renvoyé sur /products/qa-affiche-fixe-mug4vng3?achat=MONTANT_REFUSE SANS AUCUN MESSAGE (même table MESSAGES_ACHAT que P4.3 : POURBOIRE_TROP_HAUT arrive en MONTANT_REFUSE) ; pourboire 1 000 000 F → commande créée (/achat/cmuhkn2df001qukzoopj2x523), non payée — le plafond est atteint et tenu au franc près |
| S22 | ✅ | Mesuré en P14.1 (la dernière place prise, pas d'inscription au-delà) et en R48 (deux inscriptions simultanées pour une place : une seule passe, l'autre lit « Toutes les places sont prises. »). Réserve : le compteur que la garde lit peut être faux après un effacement RGPD (S9, S39). |
| S23 | ⚠️ | Mesuré en R29 : 13 mots-clés saisis → ressource créée avec 12. La limite tient, mais la troncature est silencieuse : l'écran ne dit pas lequel a été écarté. |
| S24 | ✅ | confirmation de la commande payée (6000 F en base) : montant affiché 6 000 F, non nul |
| S25 | ❌ | Mesuré en S40 : un solde NÉGATIF (−2 300 F) s'affiche « 0 F — rien à verser », à l'identique d'un solde vide. Le zéro ne distingue ni « rien gagné », ni « tout versé », ni « tu dois de l'argent ». |
| S26 | 🚫 | Inatteignable aujourd'hui : une vente à 0 F ne peut pas exister — prixPlancher() rend 1 F et la remise est arrondie vers le bas (forme C du document) ; une ressource gratuite ne crée pas de commande (D, P5.4). Ce qui a été trouvé en cherchant est l'inverse du cas prévu : la liste ne filtre RIEN, pas même les paiements échoués (S15). |
| S27 | ✅ | Mesuré le 25/09 sur /dashboard/statistiques (capture S34-stats) : chaque zéro est écrit « 0 » — « 0 dl · 0 ventes » par ressource, « VENTES 0 » en tête — jamais une case vide. Lu dans le schéma : Product n'a pas de compteur de vues (salesCount, downloadsCount, likesCount, commentsCount, ratingCount seulement), donc l'écran n'affiche pas de vues du tout plutôt qu'un zéro trompeur. Le zéro des vente |
| S28 | ✅ | brouillon sans fichier (0 en base) : l'écran le dit — « Aucun fichier attaché : un acheteur n'aurait rien à télécharger. » |
| S29 | ❌ | Mesuré : « zzqxwvk » tapé dans la recherche de l'en-tête, 2,5 s d'attente puis Entrée → RIEN : pas de « aucun résultat », pas de page de résultats, /explore inchangé (24 ressources). /api/recherche rend {"items":[]}. Lu dans components/shell/header.tsx : les suggestions ne s'affichent que si `suggestions.length > 0` — zéro résultat, recherche en cours et recherche en panne (R79b : HTTP 500 sur un  |
| S30 | ✅ | Mesuré en P13.3 : second passage de /api/cron/blog → {"vus":0,"publies":0}. Lu dans app/api/cron/blog/route.ts : une lecture qui échoue répond HTTP 500 « Erreur » et s'écrit au journal (« passage du blog en échec ») — un zéro n'arrive donc que si la lecture a réussi, et vus ≠ publies dirait une publication ratée. |
| S31 | ❌ | Mesuré en O6 / P10.6 : le bilan « Ces adresses ne désignent aucune ressource… » n'apparaît JAMAIS — il vit dans l'état du composant RetirerProvisoirement, démonté dès que le dossier change d'état. « Retiré » s'affiche à l'identique qu'on ait retiré trois ressources ou zéro. (Défaut de la v1.69.0.) |
| S32 | ✅ | événement sans inscrit : export HTTP 200 text/csv; charset=utf-8, 1 ligne (l'en-tête seul : « Nom;Adresse;Profil;Ville;Billet payé;Inscrit le ») ; un export impossible (événement inconnu) répond HTTP 404 — les deux se distinguent. L'écran des inscrits dit : « Personne pour l'instant » |
| S33 | ✅ | profil awa-createur : annoncé « 7 RESSOURCES », 7 fiches listées, 7 ressources en ligne en base |
| S34 | ❌ | Mesuré : /dashboard/statistiques affiche « VENTES 0 », et « QA Affiche fixe · 4 dl · 0 ventes » alors que cette ressource compte plusieurs ventes réussies ; en base, 9 lignes de vente réussies pour ce créateur. Lu dans le code : ce compteur, le profil public (lib/createurs/queries.ts) et les cartes du fil (lib/feed/queries.ts) lisent Product.salesCount ; recherche du 25/09 dans lib, app, prisma et |
| S35 | ✅ | pastille du menu « ◔ Notifications 12 », 12 non lues en base ; la liste dit « 12 non lues. » |
| S36 | ℹ️ | annonces : 2 EN ATTENTE ; cartes typées : 2 ; menu « ⚑ File de modération » ; base SOUMIS : JobPosting 2, ServiceOffer 0, Event 0, BlogPost 0 |
| S37 | ✅ | qa2 télécharge une fois (HTTP 302) : fiche « Téléchargements 4 » → « Téléchargements 5 », colonne 4 → 5 ; 5 ConsumptionEvent au total pour la ressource |
| S38 | ✅ | Mesuré le 25/09 à 08:11 : +1 en aimant, −1 en retirant (F1/F2), et aucun écart likesCount / commentsCount sur tout le catalogue. Refait à 13:5x, après l'effacement RGPD de qa4 : toujours aucun écart sur les j'aime ni sur les commentaires actifs (le seul écart trouvé ce jour-là est celui des places d'événement, S39). |
| S39 | ❌ | Mesuré le 25/09 : « s'inscrire → −1 » tient (R48 : compteur 2 → 3). Mais le compteur est faux d'une unité : participantsCount 2 pour 1 inscription réelle, puis 3 pour 2 après R48 ; la page publique affiche « PLACES 3 / 3 » avec deux inscrits et refuse le suivant. Cause mesurée et lue : l'effacement RGPD de qa4 a supprimé son inscription sans rendre la place (S9). Un écart de 1, pris pour une afflu |
| S40 | ❌ | Mesuré : /dashboard/gains du créateur affiche « SOLDE DISPONIBLE 0 F — rien à verser » et « EN ATTENTE DE VALIDATION 0 F ». En base, le solde du jour vaut −2 300 F (Balance du 25/09, UNPAID) : 41 595 F ont été préparés au versement (P11), puis deux ventes de 8 850 F et deux remboursements de 10 000 F ont suivi (P3, R52). Recalcul depuis les mouvements : 39 295 F gagnés, 41 595 F versés — le créate |
| S41 | ✅ | Mesuré le 25/09 : `npx tsc --noEmit` passe, 0 erreur, en 21 s — sur un code où la campagne a trouvé, entre autres, un état de vente qui ignore son état (S15), un solde négatif affiché zéro (S40), un bouton recouvert par un texte (N11) et un « 5000.5 » lu 50 005 (R24). Ce que le typecheck ne regarde pas : le rendu, les données, le sens. |
| S42 | ✅ | Lu le 25/09 : 56 fichiers *.integration.test.ts ; ils importent les fonctions et parlent à la base — deux seulement appellent fetch(), et pour simuler un tiers (WebAuthn, relance de paiement). Aucun ne demande à Next de servir une route à son adresse. etatDeLaVente et lireVentesCreateur (S15) n'ont AUCUN test ; gainsDe en a douze, aucun sur un solde négatif (S40). |
| S43 | ✅ | Lu le 25/09 : e2e/ compte 4 fichiers (achat, gardes, limitation, ordonnanceur) et 15 déclarations test(), dont une boucle sur les chemins d'administration. Aucun ne touche aux ventes du créateur, aux gains, aux réglages de notification, à la recherche ni aux suspensions — là où le niveau 4 a trouvé S15, S40, S29, S5. Et le test « finit par répondre 429, avec de quoi savoir quand revenir » vérifie  |
| S44 | ✅ | Mesuré le 25/09, trois exemples où le nombre est bien affiché et vient de la mauvaise source : « VENTES 0 » lit une colonne jamais écrite (S34) ; « PLACES 3 / 3 » lit un compteur que l'effacement ne rend pas (S39) ; « SOLDE 0 F » est un Math.max(0, …) sur −2 300 F (S40). Et un exemple juste : la pastille « 12 » des notifications = 12 non lues en base = « 12 non lues. » dans la liste (S35). |
| S45 | ✅ | Mesuré le 25/09 : la bonne ligne en base n'a pas fermé toutes les portes — S5 : le compte levé est COMPLIANT en base, ses ressources restent archivées ; S5b : la ligne de blocage IP ferme la porte à un compte innocent ; R14b : le rôle ACCOUNTANT est bien posé, aucune porte ne s'ouvre. |
| S46 | ✅ | Mesuré : le serveur de la campagne tourne sur le build de production courant (`next start`, NODE_ENV=production). Ce build passe, et l'on y a mesuré au navigateur : l'en-tête qui passe sur deux lignes et recouvre « Panier » (A1), le bouton « Relancer » masqué par un texte (N11), la recherche muette (S29). Le build dit « ça compile et ça s'assemble », pas « c'est utilisable ». |
| S47 | ✅ | Mesuré le 25/09 dans le conteneur (mc anonymous get-json baobart-media) : la politique porte DEUX déclarations — « LectureAnonymeDesVisuelsDeDemonstration » (demo/*) et « ApercusPublics » (public/*). Les deux écrivains (scripts/medias-demo.mjs, lib/upload/storage.ts) coexistent ; les images de démonstration et les aperçus sont servis (A1, K3). |
| S48 | ✅ | 3 ressource(s) sous retrait juridique (SUSPENDED) : intactes pendant la suspension du compte ET après sa levée — le risque n'écrit que sur PUBLISHED (lib/domain/risque.ts, DESACTIVER_PRODUITS). Mesuré ailleurs : l'effacement RGPD épargne une ressource sous retrait (P15.4), le créateur ne peut ni publier ni modifier ni supprimer une ressource retirée (R61–R63, P10.5), la restauration rend l'état d' |
| S49 | ⚠️ | Mesuré : vente (+8 850), remboursement (−10 000, une seule fois même en double clic simultané, R52), versement (41 595 préparé une fois, pas de doublon au second passage, P11.3) — aucun n'écrase l'autre, la somme des mouvements est juste. Mais l'ordre compte et ne se voit pas : deux remboursements APRÈS le versement laissent le vendeur débiteur de 2 300 F, et l'écran l'affiche zéro (S40). Non épro |
| S50 | ✅ | « Publication acceptée » · Courriel : true → false après rechargement ; en base : COURRIEL=false — le défaut du catalogue (COURRIEL: true) ne reprend pas la main |
| S51 | ✅ | Mesuré en S2/S3 : publier puis retirer de la vente se voit IMMÉDIATEMENT dans la fiche, /explore, le profil, /api/feed et /api/recherche, requêtes neuves sans cache navigateur. Lu dans le code : ces pages sont en `force-dynamic` (app/products/[slug], app/explore, app/createurs/[username], app/page.tsx) — elles ne reposent donc pas sur revalidatePath, qui ne vise que /dashboard (lib/products/action |
| S52 | ✅ | Mesuré en B7 et B10 : à l'activation, les 8 codes de secours s'AFFICHENT avec « Note ces codes maintenant » ; au renouvellement, 8 nouveaux, sans commun avec les anciens ; un code sert une fois (P12.1–P12.2, R72). Lu à l'écran, pas supposé. |
| S53 | ✅ | Mesuré en D10 et P7.1b : après le paiement, l'upsell déclaré (« QA Prix libre ») est proposé, pour deux acheteurs distincts. |
| S54 | ❌ | Mesuré en O6 : le bilan des adresses non atteintes n'est jamais vu (voir S31) — la branche « changement d'état du dossier » démonte le composant qui le gardait. |
| S55 | ❌ | Mesuré en P9.3 et H4 : refuser une offre d'emploi ou un service n'envoie rien à l'auteur (0 notification) et aucun écran ne lui montre le motif. Lu le 25/09 : seuls les ÉVÉNEMENTS envoient CONTENU_REFUSE / CONTENU_PUBLIE (lib/evenements/redaction.ts) ; offres, services, articles et ressources n'appellent jamais notifier pour une décision de modération. |
| S56 | ❌ | Mesuré en B16 : « Annuler la demande » d'effacement réussit en base (0 demande ouverte), et juste après l'écran affiche « Demande enregistrée. L'effacement aura lieu le 24 octobre 2026, sauf annulation de ta part. » avec le formulaire rouvert — le message de succès du geste PRÉCÉDENT, l'inverse de la vérité. Un rechargement rétablit l'écran. |
| S57 | ❌ | Mesuré en S29 : la recherche de l'en-tête rend pareil une liste vide, une liste en chargement et une requête en échec — rien du tout (condition `suggestions.length > 0`, et aucun état de chargement ni d'erreur dans le composant). Les listes des écrans serveur, elles, disent leur vide (« Aucune commande », « Aucun fichier attaché… », « 12 non lues. »). |
