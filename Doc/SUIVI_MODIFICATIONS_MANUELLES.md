# Suivi manuel des modifications Baobart

**Date : 2026-08-22**  
**But du document :** servir de journal de reprise lorsque les opérations Git distantes sont indisponibles.  
**Contexte :** la PR précédente a été mergée, puis la session Arena a continué localement. Les prochains changements devront donc être repris manuellement depuis VS Code ou dans une nouvelle session propre.

---

## 0. Règle de fonctionnement retenue

Comme cette session ne doit plus être utilisée pour pousser/merger vers GitHub, ce document devient la trace temporaire des changements.

Processus recommandé :

1. Depuis VS Code, repartir de `main` à jour.
2. Vérifier si le merge commit de la PR précédente est déjà présent.
3. Appliquer uniquement les fichiers manquants selon les lots ci-dessous.
4. Relancer les vérifications.
5. Commiter/pousser depuis l'environnement Git normal.
6. Reprendre ensuite les prochaines tâches de développement.

---

## 1. État Git observé dans cette session

Branche locale de session :

```txt
arena/01a0261e-baobart
```

Historique local récent :

```txt
1e48f79 Continue dashboard and product card polish
6f35d28 Restore publishing before upload is available
093ac8a Audit project and harden critical flows
56f819d feat: publier, retirer, supprimer — la boucle créateur est fermée (v1.8.0)
```

PR précédente mergée :

```txt
PR #1 — Audit Baobart and harden critical flows
Merge commit : 2fe180d4a9fc495f6ac1d4c36706c7ce73131efc
```

Important : si `main` contient déjà `2fe180d4a9fc495f6ac1d4c36706c7ce73131efc`, ne pas réappliquer le lot A. Appliquer seulement le lot B.

---

## 2. Lot A — Changements déjà mergés via PR #1

Ces changements ont été mergés dans GitHub par la PR #1. Ils sont listés ici pour suivi, mais ils devraient déjà être dans `main` après mise à jour.

### 2.1 Documentation ajoutée

Fichiers ajoutés :

```txt
Doc/AUDIT_COMPLET_PROJET_BAOBART.md
Doc/CARTE_MENTALE_BAOBART.mmd
Doc/CARTE_MENTALE_BAOBART.svg
Doc/VERIFICATION_GUMROAD_APPROFONDIE_2026-08-21.md
```

Contenu :

- audit complet du projet ;
- carte mentale graphique ;
- source Mermaid de la carte ;
- vérification approfondie des fonctionnalités Gumroad au commit `182df6a8`.

### 2.2 Sécurité dépendances

Fichiers modifiés :

```txt
package.json
pnpm-lock.yaml
```

Ajout des overrides pnpm :

```json
"overrides": {
  "postcss": "8.5.26",
  "nanoid": "3.3.18",
  "sharp": "0.35.3",
  "deepmerge-ts": "8.0.2"
}
```

Objectif : obtenir un `pnpm audit --audit-level moderate` propre.

### 2.3 Build/typecheck sans Prisma généré

Fichiers concernés :

```txt
lib/db.ts
lib/domain/prisma-types.ts
lib/feed/types.ts
lib/feed/queries.ts
lib/products/queries.ts
lib/products/actions.ts
lib/domain/balances.ts
lib/domain/downloads.ts
lib/domain/orders.ts
prisma/seed-demo.ts
```

Objectif :

- éviter que les tests unitaires et le build échouent uniquement parce que `prisma generate` ne peut pas télécharger ses engines ;
- ajouter des types miroir d'enums Prisma pour les décideurs purs et les composants client ;
- rendre le client Prisma paresseux dans `lib/db.ts`.

### 2.4 Google Fonts au build

Fichier modifié :

```txt
app/layout.tsx
```

Changement : suppression du chargement build-time via `next/font/google`, pour éviter les erreurs réseau vers `fonts.googleapis.com` dans les environnements isolés.

La CSS conserve les familles nominales et les fallbacks.

### 2.5 Durcissement argent / quotas / slugs

Fichiers modifiés :

```txt
lib/domain/orders.ts
lib/domain/downloads.ts
lib/products/actions.ts
```

Changements :

- encaissement protégé contre double webhook via `updateMany` conditionnel ;
- remboursement protégé contre concurrence et sur-remboursement ;
- remboursement interdit sur ligne non encaissée ;
- transactions critiques en isolation `Serializable` ;
- débit de quota de téléchargement atomique ;
- retry sur collision unique de slug produit.

### 2.6 Intégrité DB `Save`

Migration ajoutée :

```txt
prisma/migrations/20260821193000_integrite_saves/migration.sql
```

Contrainte ajoutée :

```sql
CHECK (num_nonnulls("workItemId", "productId") = 1)
```

Objectif : une sauvegarde vise exactement un `WorkItem` ou un `Product`.

### 2.7 Règle publication sans fichier restaurée

Fichiers modifiés :

```txt
lib/products/actions.ts
app/dashboard/produits/[id]/page.tsx
Doc/AUDIT_COMPLET_PROJET_BAOBART.md
```

Règle à conserver :

> Tant que le module d'upload n'existe pas, une ressource sans fichier affiche un avertissement, mais reste publiable. Bloquer la publication maintenant casserait la boucle créateur `ATELIER → BOUTIQUE`.

Cette règle ne doit pas être retouchée avant l'implémentation réelle de l'upload produit.

---

## 3. Lot B — Changements locaux non poussés après le merge

Ces changements correspondent au commit local :

```txt
1e48f79 Continue dashboard and product card polish
```

Ils doivent être repris manuellement dans `main` si cette session ne peut plus pousser.

### 3.1 Objectif fonctionnel

Continuer la finalisation :

- du dashboard acheteur ;
- du dashboard vendeur ;
- de l'affichage des cartes produits ;
- sans toucher à la règle de publication sans fichier.

### 3.2 Fichiers créés

Nouvelles routes dashboard :

```txt
app/dashboard/profil/page.tsx
app/dashboard/achats/page.tsx
app/dashboard/telechargements/page.tsx
app/dashboard/suivis/page.tsx
app/dashboard/collections/page.tsx
app/dashboard/abonnements/page.tsx
app/dashboard/forfait/page.tsx
app/dashboard/revenus/page.tsx
app/dashboard/commandes/page.tsx
app/dashboard/ventes/page.tsx
app/dashboard/commissions/page.tsx
app/dashboard/statistiques/page.tsx
app/dashboard/boutique/page.tsx
app/dashboard/avis/page.tsx
```

Nouveaux utilitaires dashboard :

```txt
components/dashboard/frame.tsx
lib/dashboard/queries.ts
```

### 3.3 Fichiers modifiés

```txt
app/dashboard/page.tsx
components/feed/feed.tsx
components/feed/resource-card.tsx
lib/dashboard/nav.ts
lib/feed/queries.ts
lib/feed/types.ts
```

### 3.4 Détail des nouvelles pages dashboard

| Route | Rôle |
|---|---|
| `/dashboard/profil` | Lecture profil public + facturation privée. |
| `/dashboard/achats` | Historique des commandes acheteur. |
| `/dashboard/telechargements` | Journal de consommation/téléchargements. |
| `/dashboard/suivis` | Emplacement pour likes/follows/saves. |
| `/dashboard/collections` | Tableaux/collections de l'utilisateur. |
| `/dashboard/abonnements` | Abonnements actifs et quotas. |
| `/dashboard/forfait` | Plans Découverte/Explorer/Studio. |
| `/dashboard/revenus` | Soldes, transactions et payouts. |
| `/dashboard/commandes` | Vue vendeur des lignes de commande. |
| `/dashboard/ventes` | Suivi commercial vendeur. |
| `/dashboard/commissions` | Commissions/services créatifs. |
| `/dashboard/statistiques` | Compteurs produits, ventes, téléchargements. |
| `/dashboard/boutique` | Profil public de boutique créateur. |
| `/dashboard/avis` | Feedback, notes, avis créateur. |

### 3.5 Composant `components/dashboard/frame.tsx`

Exports ajoutés :

```ts
DashboardFrame
MetricCard
DashboardPanel
EmptyState
BLANC
CADRE
ENCRE
JAUNE
LAVANDE_CLAIR
```

Rôle : factoriser la structure sidebar + main content + panels, afin que chaque page dashboard soit cohérente visuellement.

### 3.6 Requêtes centralisées `lib/dashboard/queries.ts`

Fonctions ajoutées :

```ts
lireProduitsCreateur
lireCommandesAcheteur
lireVentesCreateur
lireProfilDashboard
lireResumeDashboard
lireCollections
lireTelechargements
lireAbonnements
lirePlans
lireRevenus
lireCommissions
```

Rôle : centraliser les lectures Prisma du dashboard et éviter de dupliquer les `select` dans chaque page.

### 3.7 Navigation dashboard

Fichier :

```txt
lib/dashboard/nav.ts
```

Changement : les entrées qui étaient encore `href: null` pointent maintenant vers de vraies routes.

Exemples :

```txt
/dashboard/profil
/dashboard/achats
/dashboard/telechargements
/dashboard/collections
/dashboard/forfait
/dashboard/revenus
/dashboard/ventes
/dashboard/statistiques
/dashboard/boutique
/dashboard/avis
```

La logique de verrouillage progressive reste inchangée :

```txt
ACHETEUR → ATELIER → BOUTIQUE
```

### 3.8 Dashboard principal enrichi

Fichier :

```txt
app/dashboard/page.tsx
```

Ajouts :

- métriques de synthèse ;
- solde disponible ;
- produits récents ;
- raccourcis vers achats, collections, produits, gains ;
- usage de `DashboardFrame`, `MetricCard`, `DashboardPanel`, `EmptyState`.

### 3.9 Cartes produits améliorées

Fichiers :

```txt
components/feed/resource-card.tsx
components/feed/feed.tsx
lib/feed/types.ts
lib/feed/queries.ts
```

Ajouts :

- `downloadsCount` et `salesCount` dans `CarteRessource` ;
- récupération de ces compteurs depuis `listerFeed` et `listerAlaUne` ;
- affichage téléchargements/ventes sur les cartes ;
- badge `Sélection` / `Sélection éditoriale` si `isStaffPicked` ;
- catégorie visible dans les infos de carte ;
- navigation clavier via `Enter` / `Space` ;
- remplacement du pattern invalide `Link` contenant des boutons par une navigation `router.push` déclenchée depuis la carte ;
- les boutons like/save/download stoppent la propagation.

### 3.10 Point non modifié volontairement

La règle suivante a été explicitement préservée :

```txt
Une ressource sans fichier reste publiable tant que le module d'upload n'est pas livré.
```

Ne pas réintroduire de blocage `sans-fichier` dans :

```txt
lib/products/actions.ts
app/dashboard/produits/[id]/page.tsx
```

---

## 4. Vérifications réalisées après le lot B

Commandes exécutées avec succès :

```bash
pnpm typecheck
pnpm lint
pnpm test:unite
pnpm build
```

Résultats :

```txt
Typecheck : OK
Lint : OK
Tests unitaires : 151 tests OK
Build Next.js : OK
```

Routes dashboard visibles dans le build :

```txt
/dashboard
/dashboard/abonnements
/dashboard/achats
/dashboard/avis
/dashboard/boutique
/dashboard/collections
/dashboard/commandes
/dashboard/commissions
/dashboard/forfait
/dashboard/produits
/dashboard/produits/[id]
/dashboard/produits/nouveau
/dashboard/profil
/dashboard/revenus
/dashboard/statistiques
/dashboard/suivis
/dashboard/telechargements
/dashboard/ventes
```

---

## 5. Instructions de reprise manuelle dans VS Code

### Cas 1 — `main` contient déjà le merge de la PR #1

Appliquer seulement le lot B :

```txt
app/dashboard/profil/page.tsx
app/dashboard/achats/page.tsx
app/dashboard/telechargements/page.tsx
app/dashboard/suivis/page.tsx
app/dashboard/collections/page.tsx
app/dashboard/abonnements/page.tsx
app/dashboard/forfait/page.tsx
app/dashboard/revenus/page.tsx
app/dashboard/commandes/page.tsx
app/dashboard/ventes/page.tsx
app/dashboard/commissions/page.tsx
app/dashboard/statistiques/page.tsx
app/dashboard/boutique/page.tsx
app/dashboard/avis/page.tsx
components/dashboard/frame.tsx
lib/dashboard/queries.ts
app/dashboard/page.tsx
components/feed/feed.tsx
components/feed/resource-card.tsx
lib/dashboard/nav.ts
lib/feed/queries.ts
lib/feed/types.ts
```

Puis relancer :

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test:unite
pnpm build
```

### Cas 2 — `main` ne contient pas la PR #1

Appliquer d'abord le lot A, puis le lot B.

Attention : le lot A modifie aussi des fichiers que le lot B touche indirectement (`lib/feed/queries.ts`, `lib/feed/types.ts`, etc.). Il faut donc appliquer dans cet ordre :

1. Lot A.
2. Vérifications.
3. Lot B.
4. Vérifications.

---

## 6. Prochaines tâches après reprise Git

Une fois ces changements récupérés dans `main`, les prochaines tâches recommandées sont :

1. **Upload produit S3/MinIO**
   - réservation upload ;
   - URL signée ;
   - association `ProductFile` ;
   - cover produit ;
   - aperçu sur cartes.

2. **Téléchargement signé**
   - route d'autorisation ;
   - `ConsumptionEvent` ;
   - quota abonnement ;
   - génération URL signée.

3. **Checkout minimal**
   - achat gratuit ;
   - commande ;
   - ligne d'achat ;
   - accès fichier après achat.

4. **Paiement réel + webhooks idempotents**
   - Flutterwave/Paystack/CinetPay/Stripe ;
   - `encaisserLigne` ;
   - ledger ;
   - emails reçus.

5. **Édition du dashboard**
   - formulaires profil ;
   - édition boutique ;
   - paramètres payout ;
   - liens sociaux.

---

## 7. Check-list avant commit manuel

Avant de committer manuellement depuis VS Code :

- [ ] `main` est à jour.
- [ ] La PR #1 est bien intégrée, ou le lot A a été appliqué.
- [ ] Le lot B est appliqué.
- [ ] La règle publication sans fichier n'est pas bloquée.
- [ ] `pnpm install --frozen-lockfile` passe.
- [ ] `pnpm typecheck` passe.
- [ ] `pnpm lint` passe.
- [ ] `pnpm test:unite` passe.
- [ ] `pnpm build` passe.
- [ ] Si possible : `pnpm db:generate`, puis tests d'intégration avec Postgres.

---

## 8. Message de commit suggéré pour reprise manuelle

Pour le lot B :

```txt
feat: compléter dashboard acheteur/vendeur et cartes produits

- ajoute les routes dashboard acheteur et vendeur manquantes
- factorise le layout dashboard avec DashboardFrame/MetricCard/Panel/EmptyState
- centralise les requêtes dashboard
- raccorde la navigation progressive à de vraies routes
- enrichit l'aperçu dashboard avec métriques et raccourcis
- améliore les cartes produit : compteurs, badge sélection, navigation clavier
- conserve la publication sans fichier tant que l'upload n'est pas livré
```
