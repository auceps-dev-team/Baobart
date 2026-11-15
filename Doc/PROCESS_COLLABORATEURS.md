# Notre façon de travailler — à coller dans ta session Claude

> **Pour qui :** toute personne qui rejoint Baobart, et sa session Claude Code.
>
> **Comment s'en servir :** copie tout ce fichier dans ton `CLAUDE.md` global
> (`~/.claude/CLAUDE.md`), ou colle-le au début de chaque session. Les règles
> **propres au dépôt** (git, la liste des tâches, les maquettes, la base de
> développement) sont dans le `CLAUDE.md` du dépôt : ta session les charge
> d'elle-même quand tu travailles dans le dossier. Celles d'ici valent partout.
>
> Version du 13/11/2026. Elle reprend le `CLAUDE.md` global du responsable du
> dépôt, sans ce qui ne concerne que sa machine.

---

## Premier jour sur Baobart

1. Cloner le dépôt, puis suivre « Démarrage rapide » dans `README.md`
   (`pnpm install`, la pile Docker, la base, les données de démonstration).
2. Lire `TACHES.md` : ce qui est fait, ce qui est en cours et par qui, ce qui
   reste. **On prend une ligne « À faire » libre, jamais une ligne déjà prise.**
3. Lire le `CLAUDE.md` du dépôt, ses quatre premières sections au moins.
4. Créer sa branche `prenom/sujet` depuis `origin/main` à jour, ouvrir tout de
   suite une PR en brouillon qui passe la ligne « En cours » à son nom.
5. Écrire la fiche (ci-dessous) dans la description de la PR, **avant** le
   premier fichier modifié.
6. Finir : CI verte, preuve jointe, ligne passée dans « Fait ». **L'auteur d'une
   PR complète la fusionne** s'il a le droit d'écriture ; sinon le
   responsable du dépôt. Personne ne pousse sur `main` : depuis le 14/11/2026,
   la protection de la branche l'impose (PR obligatoire, cinq contrôles verts).

Tout s'écrit en **français** : code, commits, PR, comptes rendus.

---

## Avant chaque tâche : les quatre questions

Règle posée le 12 novembre 2026 : **aucune tâche ne commence sans sa fiche.**
Quatre questions, répondues par écrit avant d'agir — et chaque réponse devient
une partie du process de la tâche, pas une réflexion qu'on oublie une fois
écrite.

| Question | Ce que la réponse devient |
|---|---|
| 1. Que ferait le meilleur expert du domaine, que je n'ai pas déjà demandé ? | **Le périmètre** : chaque point entre dans la liste de contrôle, ou en sort avec sa raison écrite. |
| 2. Quelle est la matière la plus brute dont tu partiras, plutôt que celle déjà disponible ? | **La première action** : la collecter ou la mesurer avant de construire. Si elle contredit le plan, le plan change d'abord. |
| 3. Quels méthodes et outils précis utiliserait un expert ? | **Le mode opératoire** : outils installés, méthode écrite avant de commencer. |
| 4. Qu'est-ce qui, à part toi ou moi, prouverait que les résultats sont bons ? | **Le critère de fin** : la tâche n'est finie que quand cette preuve existe, datée et jointe. |

### Les règles

1. **La fiche s'écrit avant, jamais après.** Écrite après coup, elle justifie
   ce qu'on a fait ; elle ne l'oriente plus.
2. **Une case vide bloque le départ.** « Rien à ajouter » se justifie en une
   phrase.
3. **La fiche ouvre la réponse**, en quatre lignes, avant le premier outil. Pour
   un plan ou une tâche longue, elle va aussi dans le document du projet (sur
   Baobart : la description de la PR).
4. **Chaque fait de la fiche dit s'il est mesuré ou lu** — un fait mesuré porte
   sa date, un fait lu porte son lien (section « Ce qu'on a le droit
   d'affirmer »).
5. **Une preuve qui ne vient que de toi ou de moi laisse la tâche ouverte.**
   Une empreinte de base, un test automatique, un outil tiers, un vrai
   utilisateur, une autre personne : voilà ce qui prouve.
6. **Répondre ne suffit pas : chaque réponse s'applique.** Le compte rendu final
   reprend les réponses point par point — appliqué (avec la preuve) ou non
   appliqué (avec la raison).
7. **En fin d'étape, relire les fiches ensemble** : ce qui a servi devient une
   règle des étapes suivantes.

### Ce qui n'en demande pas

Une question qui n'appelle aucun travail — expliquer, comparer, donner un avis
— se répond directement. La fiche est pour ce qui change un fichier, un site,
une base ou une décision.

---

## Isolation des tests Node

Plusieurs projets Node tournent en parallèle sur une même machine. **Vitest et
Jest lancent par défaut un processus par cœur.** Deux suites lancées en même
temps sur quatre cœurs, c'est huit processus ; trois suites, douze.

Les tests ne se corrompent pas entre eux : ils **ralentissent**. Et un test lent
dépasse son délai d'attente, échoue, et se lit comme une régression. C'est un
faux positif, et il coûte cher parce qu'on cherche le bogue dans le code au lieu
de le chercher dans l'ordonnancement.

Mesuré le 12 septembre 2026, la même suite, inchangée :

```
20,2 s        seule
107,1 s       avec une autre suite en arrière-plan
```

### Les règles

1. **Une seule suite à la fois, toujours.** Y compris celles lancées en
   arrière-plan par un agent. Avant de lancer les tests, vérifier qu'aucune
   autre suite n'est en cours.
2. **Ne jamais laisser une suite en arrière-plan puis en démarrer une autre.**
   La première est invisible, la seconde paraît anormalement lente.
3. **Borner les processus quand on doit partager la machine** :

   ```sh
   npx vitest run --pool=threads --poolOptions.threads.maxThreads=2
   ```

4. **Préférer une suite ciblée à la suite complète** pendant le travail :
   `npx vitest run chemin/du/fichier.test.ts`. La suite complète se garde pour
   la vérification finale.
5. **Avant d'annoncer une régression, rejouer le fichier seul.** Un échec qui
   disparaît à l'isolement n'était pas une régression.
6. **Distinguer l'échec d'assertion du dépassement de délai.** « expected X to
   be Y » est un vrai défaut ; « Test timed out in 5000ms » ne dit rien tant
   qu'on ne sait pas ce qui tournait à côté.

### Ce que cela ne règle pas

Un test qui dépend d'un port fixe, d'un fichier dans `/tmp` ou d'une base
partagée se corrompra vraiment, et pas seulement en ralentissant. Il faut alors
un port éphémère, un dossier créé par `mkdtemp`, ou une base par personne — sur
Baobart, voir « Travailler en même temps qu'un autre » dans le `CLAUDE.md` du
dépôt.

---

## Ce qu'on a le droit d'affirmer

Trois fois en une semaine, une affirmation confiante s'est révélée fausse. Les
trois fois, **l'observation était juste et la conclusion ne l'était pas**. Cette
section existe pour que la quatrième n'ait pas lieu.

### Une affirmation négative coûte plus cher qu'une positive

« Cette API rend un `202` » se prouve par un appel. « Cette API n'a pas de
signature de webhook » ne se prouve par **aucun** nombre d'appels : elle exige
d'avoir épuisé les sources, et on ne les épuise jamais.

Mesuré le 14 septembre 2026 : un vrai webhook de paiement capté, six en-têtes,
aucune signature. Observation exacte. Conclusion publiée — « le mécanisme
n'existe pas » — fausse : il est désactivé par défaut, compte par compte, et
documenté sur une page qui n'avait pas été ouverte.

**Avant d'écrire qu'une chose n'existe pas, écrire d'abord ce qu'il faudrait
avoir lu pour en être sûr.** Souvent, la phrase s'arrête là.

### Le silence d'une source n'est pas une preuve

« La documentation n'en parle pas » veut presque toujours dire « la
documentation **que j'ai lue** n'en parle pas ». Ce sont deux phrases
différentes, et seule la seconde est vérifiable.

Quand un index existe — `llms.txt`, un sommaire, une table des matières —
**nommer les pages qu'on n'a pas lues** avant de conclure.

### Avant de contredire, chercher d'où ça vient

Une fiche, un commentaire, un test, le code de quelqu'un d'autre : **personne ne
l'a écrit sans raison.** Contredire sans avoir cherché la raison, c'est parier
que l'auteur était négligent — un pari qu'on perd la plupart du temps.

La question à poser n'est pas « est-ce faux ? » mais « qu'est-ce qui pourrait le
rendre vrai que je ne vois pas ? ».

### Une incohérence remarquée est une piste, pas une note de bas de page

Quand on écrit « cette source se trompe ici », on vient de la disqualifier
ailleurs aussi — il faut le tirer tout de suite, pas six mois après. **Une
source périmée dans un paragraphe ne redevient pas fraîche au suivant.**

### Distinguer ce qui est mesuré de ce qui est lu, dans le texte

Pas dans sa tête : **dans le commentaire, le message de commit, la note.** Les
deux mots coûtent trois secondes et changent ce qu'un lecteur — soi-même dans
six mois — a le droit d'en faire.

```
Mesuré le 14/09 : amount: 2000 envoyé, 2000 relu.
Lu dans la doc, non vérifié : les montants seraient en centimes.
```

Un fait mesuré porte sa date. Un fait lu porte son lien.

### Chercher le succès silencieux

Un défaut qui plante se corrige. Un défaut qui **réussit en ne faisant rien** ne
se corrige jamais, parce que personne ne le voit.

Sur un chemin de succès, **demander explicitement ce qui manque** : un montant à
zéro, un tableau vide, un identifiant `null`, une date absente. Le chemin
d'erreur crie ; le chemin de succès chuchote. **Un défaut n'est pas silencieux
ou bruyant dans l'absolu — il l'est à l'endroit où l'on regarde.**

### Un test absent ne dément pas plus son auteur qu'un faux qu'on a écrit

**Quand un commentaire affirme ce que fait un autre module, cette affirmation a
besoin d'un test dans cet autre module.** Sinon ce n'est pas de la
documentation, c'est un souvenir — et un souvenir recopié devient une source.

### Un voyant vert ne dit rien de ce que reçoit l'autre

`tsc --noEmit` lit la source ; les tests importent par chemins relatifs ; un
dossier construit (`dist/`) est souvent ignoré par git ; et le consommateur lit
le paquet construit. Quatre voyants au vert, et rien qui arrive.

**Avant d'annoncer qu'une chose est livrée, vérifier qu'elle sort de ce que
l'autre consomme** — en l'appelant, pas en cherchant une chaîne dans un
fichier. La portée d'un garde-fou fait partie du garde-fou : un contrôle qui ne
dit rien veut dire « rien n'a changé **dans ce que je regarde** ».

### Ce que cela ne veut pas dire

Ni prudence paralysante, ni précautions oratoires. On continue d'affirmer —
c'est le travail. Mais une affirmation porte son niveau de preuve avec elle, et
une affirmation négative en porte un plus lourd.

Se corriger vite et nettement vaut mieux que ne jamais se tromper.
