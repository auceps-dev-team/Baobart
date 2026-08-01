# Baobart Shield — Spécification technique (Point C)

**Protection des droits d'auteur des créations visuelles — « Baobart Shield »**
**Document C — v1.0 — août 2026**

> Complète le plan directeur (§2.5). Ce document détaille les **4 couches de défense**, le **choix des librairies**, l'**intégration dans le flux d'upload**, les **niveaux de protection**, les **coûts**, et la **communication honnête**.

---

## 0. Principes (à relire avant tout)

1. **Aucune technologie ne rend une image publiée « impossible à voler ».** Si un humain peut la voir, une IA peut (en général) l'analyser. Le Shield est une **défense en profondeur** qui rend le vol : **plus coûteux**, **traçable**, et **prouvable**.
2. **Ne jamais promettre « impénétrable »** — promettre « la meilleure protection du marché » (risque réputationnel et juridique sinon).
3. **Le Shield est aussi un levier commercial** : la couche 2 (aperçus dégradés) pousse à l'achat ; le niveau « renforcé » justifie le palier Studio.
4. **Opt-in pour la couche 3** (perturbation) : elle dégrade légèrement l'image, le créateur choisit.
5. **Maintenance continue** : chaque nouvelle génération de modèles peut casser une protection → veille + itération.

---

## 1. Vue d'ensemble : les 4 couches

| Couche | Objectif | Où | Bloquante ? | Coût |
|---|---|---|---|---|
| **1 — Provenance** | Prouver qui a créé quoi, quand | À l'upload | Non (mais recommandé) | Faible (ms/image) |
| **2 — Aperçus dégradés** | Limiter l'exposition publique, forcer l'achat | Affichage public | Oui pour le produit | Nul |
| **3 — Perturbation anti-IA** | Empêcher l'entraînement et l'imitation | À l'upload (GPU) | Non (opt-in) | Élevé (GPU s/image) |
| **4 — Juridique + application** | Retirer le vol, dissuader | Continu | Non | Moyen (veille) |

---

## 2. Couche 1 — Provenance

### 2.1 Objectif
Attribuer chaque image de manière **inattaquable** : on sait qui a déposé quoi, quand, avec quel filigrane.

### 2.2 Brique A — Filigrane invisible robuste

- **Bibliothèque** : `invisible-watermark` (npm, MIT) — filigrane dans le domaine fréquentiel (DWT-DCT), robuste au redimensionnement et à la compression JPEG.
- **Payload embarqué** : `userId | assetId | timestamp` chiffré (AES-GCM, clé par créateur) → on peut **extraire** le filigrane d'une copie et identifier l'œuvre ET le dépositaire.
- **Bonus détection** : algorithme de correspondance pour retrouver l'image source dans un corpus.
- **Limite assumée** : recadrage sévère, rotation et ré-encodage lourd peuvent détruire le filigrane → d'où la couche 1C (pHash) en filet de sécurité.

### 2.3 Brique B — C2PA / Content Credentials (provenance cryptographique)

- **Bibliothèque** : `c2pa-node` / `@contentauth/c2pa` (SDK officiel C2PA, WASM) — norme Adobe/Microsoft/Camera.
- **Manifest embarqué** : claim « créé par User X sur Baobart », horodatage, miniature, action « uploaded », signature.
- **Effet** : le fichier porte une **certification vérifiable** (n'importe qui peut vérifier la provenance via un vérificateur C2PA).
- **Limites assumées** : le manifest est **détruit par la plupart des réseaux sociaux** (recompressés) et n'empêche pas l'entraînement. Il sert surtout au **B2B / presse / démarches légales** et à la différenciation « plateforme qui certifie ».

### 2.4 Brique C — Empreinte perceptuelle (pHash) + horodatage

- **pHash** : empreinte perceptuelle (via `sharp` + hashing) stockée dans `MediaAsset.phash` → **recherche inversée** (couche 4) : on retrouve une copie volée même sans filigrane.
- **Horodatage** : `createdAt` + hash du fichier signé côté serveur ; **ancrage optionnel** dans une chaîne d'horodatage publique (OpenTimestamps, ~0,01 $) pour une preuve temporelle irréfutable (utile en litige).

### 2.5 Pipeline couche 1 (à l'upload, async)

```
image reçue (presign S3)
  → validations (type, taille, checksum, virus-check optionnel)
  → calcul pHash                     (ms)
  → génération filigrane invisible   (50-200 ms)
  → génération manifest C2PA         (100-300 ms, WASM)
  → ancrage OpenTimestamps (option)  (async)
  → stockage S3 + mise à jour MediaAsset (status: ready)
```

---

## 3. Couche 2 — Aperçus dégradés (le levier commercial)

### 3.1 Règles d'affichage public

| Type d'aperçu | Qui le voit | Spécifications |
|---|---|---|
| **Miniature feed** | Tout le monde | ~400 px, JPEG q65, filigrane visible logo Baobart |
| **Aperçu détail** | Tout le monde | ~800 px, JPEG q60, **filigrane diagonal visible** (handle créateur + « Baobart ») |
| **Plein format** | Acheteurs / abonnés Studio | Original (ou HD), **sans filigrane visible** |
| **Fichiers sources** | Acheteurs / licence étendue | ZIP/PSD/AI/TTF via URLs signées |

### 3.2 Implémentation

- Génération des variantes au pipeline d'upload (`sharp` : resize, WebP/AVIF, filigrane text overlay).
- CDN **sans cache public** sur les originaux ; URLs signées (pattern `signed_url_helper` du dépôt — expiration selon taille, §3.9-C).
- `robots.txt` + `noindex` sur les pages d'aperçu.
- Anti-hotlink : `Referer` check + signatures d'URL.

### 3.3 Bénéfice double
1. **Anti-copie** : le monde entier ne voit jamais la version exploitable.
2. **Conversion** : c'est le « paywall » naturel qui pousse à l'achat (et le palier Studio pour le HD).

---

## 4. Couche 3 — Perturbation anti-IA (opt-in, GPU)

### 4.1 Objectif
Empêcher que l'image serve à l'**entraînement** ou à l'**imitation de style** :
- **Glaze** (UChicago) : brouille le *style* pour les modèles d'imitation (un modèle qui « apprend le style » de l'œuvre produit des déchets).
- **Nightshade** : empoisonne *silencieusement* le jeu de données — le modèle qui s'entraîne dessus apprend des associations fausses (dégradation ciblée de ses capacités sur ce sujet).

### 4.2 Réalité technique (à assumer dans la doc produit)

| Vérité | Conséquence |
|---|---|
| Implémentations de référence en **Python/CUDA** (lourdes) | **Service séparé** (worker GPU), pas dans le process Next.js |
| **~2-10 s/image** sur GPU T4 | Files d'attente, quotas par créateur |
| **Dégradation visuelle** légère (bruit perceptible selon le niveau) | Niveau réglable (faible/moyen/élevé) + **aperçu avant application** |
| Efficacité **variable** selon les modèles, contournable (capture, filtrage, post-traitement) | Ne jamais promettre 100 % |
| Licence d'usage **à vérifier** (recherche) | Cadre juridique avant mise en prod |

### 4.3 Options d'intégration

| Option | Description | Coût | Recommandation |
|---|---|---|---|
| **A. Worker GPU auto** (recommandé) | Conteneur (Triton/KServe) exposant Glaze/Nightshade ; Inngest envoie le job à l'upload | GPU ~0,05-0,15 $/image | Pour le volume Baobart à l'échelle |
| **B. Perturbation légère intégrée** | Variante JS « style-noise » maison (nettement plus faible) | Nul | Dépannage v1, pas un produit |
| **C. Client-side (machine du créateur)** | L'app desktop Glaze applique avant upload | Nul côté serveur | Complément pour les puristes |

### 4.4 Niveaux de protection (opt-in par le créateur)

```
shieldLevel = NONE            → aucune perturbation (permet 100 % de la qualité)
            | WATERMARK       → couche 1 seule (défaut)
            | PERTURBATION    → couche 1 + Glaze-like (style)
            | PERTURBATION_PLUS → couche 1 + Glaze + Nightshade (max, réservé
                                  aux œuvres « à risque élevé » : style identifiable)
```

- UI : au moment de l'upload, un panneau « Shield » avec le niveau, un **aperçu avant/après**, et l'avertissement « peut légèrement modifier l'apparence ».
- Le **palier Studio** peut inclure le niveau PERTURBATION sans supplément.

---

## 5. Couche 4 — Juridique & application (le volet « armée »)

### 5.1 Assise légale
- **Licences explicites** par plan : personnelle (Explorer), commerciale (Studio), étendue (option) — cf. `LicenseType` du blueprint.
- **CGU claires** : pas de revente brute, pas d'entraînement IA sans licence commerciale étendue.
- **Mentions** : chaque page produit affiche « Protégé par Baobart Shield » + licence associée.

### 5.2 Procédure de retrait (DMCA-like)
```
signalement (formulaire : lien copie, preuve de paternité)
  → file de modération (ModerationLog)
  → vérification (filigrane extrait ? pHash match ?)
  → décision sous 48-72 h
  → retrait + notification + trace (AuditLog)
  → récidive → blocage (BlockedObject) / statut de risque dégradé (UserRiskState)
```

### 5.3 Veille & détection
- **Recherche inversée périodique** : batch mensuel, pHash des images Baobart contre des moteurs (API Google/Bing, ou index imgops) → alertes de copies.
- **Surveillance des scrapers** : logs CDN (requêtes répétées, user-agents bots), rate-limiting, blocage IP (pattern `blocked_object`).
- **Déclaration aux plateformes d'entraînement** : adhérer aux procédures de signalement IA (OpenAI, Google, etc.) pour les images à haut risque.
- **Certification** : « Contenu enregistré C2PA » visible sur la fiche produit.

### 5.4 Indicateurs de performance
- Taux de copies détectées / mois ; délai moyen de retrait ; taux de récidive.
- Taux de créateurs avec Shield actif ; part des images avec niveau PERTURBATION.

---

## 6. Intégration complète dans le flux d'upload

```
Upload (navigateur)
  1. POST /api/uploads/reserve  → UploadReservation (presign S3)
  2. Upload direct S3           → checksum vérifié
  3. Job Inngest « process-media »
     ├─ validations (type, taille, virus)
     ├─ calcul pHash ────────────────┐
     ├─ filigrane invisible ─────────┤   Couche 1
     ├─ manifest C2PA ──────────────┤
     ├─ ancrage OTS (option) ───────┘
     ├─ variantes + filigrane visible ──► Couche 2 (previews CDN)
     ├─ si shieldLevel ≥ PERTURBATION :
     │    envoi au worker GPU (Glaze/Nightshade) ──► Couche 3
     ├─ génération clé de licence (si produit vendable) ──► §3.1 du plan
     └─ mise à jour MediaAsset (status: ready) + compteurs
  4. Affichage : previews publics filigranés ; originaux derrière URLs signées
```

---

## 7. Coûts (estimation, à affiner en pilote)

| Élément | Coût unitaire approx. | Fréquence |
|---|---|---|
| pHash + filigrane invisible | ~0,0001 $ | chaque image |
| Manifest C2PA (WASM) | ~0,0003 $ | chaque image |
| Ancre OpenTimestamps | ~0,01-0,1 $ | chaque image (option) |
| Perturbation GPU (Glaze/Nightshade) | 0,05-0,15 $ | chaque image PERTURBATION |
| Recherche inversée (API) | ~0,05-0,3 $ / 1 000 recherches | batch mensuel |
| Stockage (originaux + variantes + CDN) | ~0,02 $/Go/mois | croît avec le contenu |

**Budget indicatif** : avec 100 k images/an (dont 10 % en PERTURBATION) → **~2 500-4 500 $/an** pour les couches 1-3. Négligeable face au ROI d'un positionnement « plateforme qui protège ».

---

## 8. Roadmap d'intégration

| Phase | Contenu Shield | Statut |
|---|---|---|
| **M1** | **Couche 2** (previews filigranés + URLs signées) — levier commercial + anti-copie | Priorité absolue |
| **M6** | **Couche 1** complète (pHash, filigrane invisible, C2PA, OTS option) + **couche 3** (worker GPU, niveaux, aperçu avant/après) | Badge « Shield » visible |
| **M7+** | **Couche 4** : procédure de retrait automatisée, veille inversée, déclarations IA, indicateurs | Boucle continue |

---

## 9. Communication & marketing (règles)

- ✅ « Baobart protège vos créations : filigrane de provenance, certification C2PA, et protection contre l'entraînement IA (Glaze/Nightshade). »
- ✅ « La meilleure protection du marché pour les créateurs africains. »
- ❌ « Vos images sont totalement protégées, personne ne peut les copier. » (faux → crise)
- ✅ Page « Shield » publique expliquant **honnêtement** les 4 couches (transparence = confiance).

---

## 10. Bibliothèque & outils — récapitulatif

| Outil | Rôle | Licence | Intégration Node | Niveau confiance |
|---|---|---|---|---|
| `invisible-watermark` | Filigrane invisible robuste | MIT | npm (native) | ✅ prêt |
| `c2pa-node` / `@contentauth/c2pa` | Manifest C2PA | Apache-2.0 (SDK) | WASM | ✅ prêt |
| `sharp` | Resize, WebP/AVIF, filigrane visible | Apache-2.0 | npm | ✅ prêt |
| pHash maison (sharp + hash) | Empreinte perceptuelle | — | node | ✅ prêt |
| Glaze / Nightshade (UChicago) | Perturbation anti-IA | **à vérifier** (recherche) | Python/CUDA (worker) | ⚠️ pilote |
| PhotoGuard (Meta) | Perturbation édition IA | **à vérifier** | Python/CUDA | ⚠️ pilote |
| OpenTimestamps | Preuve temporelle | MIT | CLI/API | ✅ option |
| imgops / API reverse-search | Veille copies | API tiers | HTTP | ✅ option |

> **Action à lancer** : vérification juridique de la licence d'usage commercial de Glaze/Nightshade/PhotoGuard avant de les mettre en production (pilote technique en parallèle).
