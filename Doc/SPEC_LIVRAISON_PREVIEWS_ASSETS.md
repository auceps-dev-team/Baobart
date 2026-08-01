# Baobart — Livraison des assets & Previews (section « Comment le client récupère ses assets ? »)

**Téléchargement en formats originaux, bibliothèque acheteur, moteur de previews multi-format**
**Document I — v1.0 — août 2026**

> Complète le blueprint (`BLUEPRINT_NEXTJS_BAOBART.md`) et le plan directeur (§3.9-C livraison sécurisée). Ce document répond à : **comment l'acheteur récupère ses fichiers après paiement**, et **comment l'app affiche les previews** (image, vidéo, audio, 3D, PDF, ZIP…).

---

## 1. Le parcours après achat (synthèse)

```
Paiement réussi
  → order SUCCESSFUL + balance mise à jour (statut « en attente »)
  → job « fulfill-order » :
      • fichiers ajoutés à la bibliothèque de l'acheteur (LibraryItem)
      • certificat de licence généré (SPEC_LICENCES, §3)
      • clé d'activation générée si produit concerné (SPEC_LICENCES, §4)
      • email de confirmation + lien « Voir mes téléchargements »
  → l'acheteur retrouve tout dans MA BIBLIOTHÈQUE
```

---

## 2. Téléchargement dans les formats originaux

### 2.1 Règle de base
**Le client télécharge exactement les fichiers que le créateur a déposés, dans leur format original** : PNG, JPG, TIFF, PDF, AI, EPS, SVG, PSD, ZIP, MP4, MP3, WAV, TTF, OTF, GLB… **Aucune conversion, aucune compression forcée.** C'est un engagement produit (« vous avez ce pour quoi vous avez payé »).

### 2.2 Le « paquet de fichiers » d'un produit

Chaque produit peut contenir **plusieurs fichiers** (ex. pack = 20 PNG + 1 PDF + 1 PSD) :

```prisma
model ProductFile {
  id        String @id @default(cuid())
  productId String
  mediaId   String
  filename  String                       // nom original conservé
  format    String                        // png | jpg | tiff | ai | pdf | zip | mp4 | mp3 | ...
  sizeBytes Int
  order     Int    @default(0)
  isPrimary Boolean @default(false)       // fichier principal (aperçu de référence)
  product   Product @relation(fields: [productId], references: [id])
}
```

### 2.3 Modalités de téléchargement (Bibliothèque acheteur)

| Action | Comportement |
|---|---|
| **Télécharger un fichier** | URL signée S3/CDN (expiration adaptée à la taille — pattern Gumroad `signed_url_helper`) ; header `Content-Disposition: attachment; filename="original.png"` |
| **Tout télécharger** | **ZIP streamé à la volée** (jamais de fichier ZIP pré-généré) : job serveur qui zip les S3 keys en streaming (limite de taille côté mémoire : stream, pas buffer) |
| **Re-télécharger** | **Illimité** tant que le compte existe et que la licence est valide (bibliothèque persistante) |
| **Expiration du lien** | Les URLs signées expirent (15 min → 24 h selon taille) mais la bibliothèque reste accessible — l'acheteur régénère un lien à la demande |

### 2.4 Quotas par plan (déjà défini §2.3 du plan)

| Plan | Quota téléchargements | Note |
|---|---|---|
| Découverte | 3/mois (ressources GRATUIT) | Compteur `DownloadQuota` |
| Explorer | 15/mois | — |
| Studio | Illimité | — |

**Mécanique** : chaque téléchargement décrémente le quota (sauf fichiers déjà achetés à l'unité — ceux-là sont illimités). Un achat à l'unité **n'est jamais compté dans le quota**.

### 2.5 Suivi (analytics + confiance)

- Chaque téléchargement = `ConsumptionEvent` (download) → compteur dénormalisé `downloadsCount` (maquette « 2 340 dl ») + analytics créateur (§3.7-H).
- Journalisation : qui a téléchargé quoi, quand, depuis quelle IP (utile en cas de litige/fuite).

---

## 3. La bibliothèque acheteur (UI)

```
app/library/  (MA BIBLIOTHÈQUE)

Layout :
┌─────────────────────────────────────────────┐
│  Ma bibliothèque          [Rechercher...]    │
│  Tous | Ressources | Services | Abonnements │
├─────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ couverture│ │ cover   │ │ cover   │  grille │
│ │ Pack Wax │ │ Font B. │ │ Illu    │  (filtre │
│ │ 20 PNG   │ │ OTF     │ │ 5 MP4   │  par     │
│ │ [ouvrir] │ │ [ouvrir] │ │ [ouvrir]│  format) │
│ └─────────┘ └─────────┘ └─────────┘        │
└─────────────────────────────────────────────┘
```

**Page produit acheté** (`/library/[orderItemId]`) :
- Galerie de previews du contenu (cf. §4).
- Liste des fichiers : nom, format, taille, bouton [Télécharger] ×n + [Tout télécharger (ZIP)].
- Bloc **Licence** : certificat PDF + clé d'activation (si applicable) + rappel des droits (SPEC_LICENCES).
- Bouton « Acheter la licence étendue » (upgrade) si disponible.
- Support : « Un fichier est cassé ? » → bouton de signalement (lien vers le vendeur / support Baobart).

---

## 4. Moteur de previews multi-format

**Règle d'or des previews** : côté public (non-acheteurs) → aperçus limités (filigrane, basse résolution, extraits) ; côté acheteur → **preview complet du contenu** (mais pas les fichiers sources, qui restent derrière le téléchargement).

### 4.1 Image (PNG, JPG, TIFF, SVG, AI→preview, PSD→preview)

| Audience | Preview |
|---|---|
| Public | Miniature feed (~400 px) + aperçu détail (~800 px) filigrané (couche 2 du Shield) |
| Acheteur | **Plein format** + zoom (lightbox, zoom lens) + éventuel comparateur avant/après |

- **TIFF** : converti en preview JPG/WebP au pipeline (`sharp`) ; le fichier original reste téléchargeable en TIFF.
- **AI/EPS** : preview = rendu raster (PDF→PNG via `mupdf`/`ghostscript` ou couverture du créateur) ; original .ai/.eps téléchargeable.
- **PSD** : preview = couverture ou rendu (v2 : rendu via `psd.js`) ; original .psd téléchargeable.

### 4.2 Vidéo (MP4, MOV, WebM…)

| Audience | Preview |
|---|---|
| Public | **Extrait court** (5-10 s, boucle, sourdine par défaut, filigrane) + poster image |
| Acheteur | Lecture complète (streaming) |

**Architecture streaming** (v1 → v2) :
- **v1 (MVP)** : lecture progressive (MP4/WebM) via **range requests** S3/CDN — simple, suffisant pour des extraits courts.
- **v2 (contenu long)** : **transcodage HLS** (segments .m3u8/.ts, via ffmpeg job) + lecteur HLS (hls.js) + CDN — pour les formations, cours, motion design long.
- **Aperçu** : job `ffmpeg` génère poster (frame à 0,5 s) + clip de 5-10 s (`-ss 5 -t 8 -vf scale`) pour le public.
- **Durée/tailles** : détection à l'upload (ffprobe) ; taille max upload ~5 Go (v1) → 20 Go (pattern Gumroad) si nécessaire.

### 4.3 Audio (MP3, WAV, FLAC, AAC, OGG)

| Audience | Preview |
|---|---|
| Public | **Extrait 30 s** (waveform simple) + lecture seule de l'extrait |
| Acheteur | Lecture complète + téléchargement (format original) |

- **Aperçu** : job `ffmpeg` génère clip 30 s (extrait du milieu) + `waveform` (échantillons pré-calculés, JSON léger pour le rendu).
- Lecteur HTML5 audio custom (play/pause, seek, volume, vitesse) — pas de dépendance lourde.

### 4.4 Assets 3D (GLB, GLTF, OBJ, FBX→converti)

| Audience | Preview |
|---|---|
| Public | **Visualiseur 3D en rotation auto** (sans téléchargement) |
| Acheteur | Visualiseur 3D interactif complet (orbite, zoom, environnement) + téléchargement |

**Implémentation** : **`@google/model-viewer`** (web component officiel, glTF/GLB natif).
- **Upload** : les créateurs déposent **GLB/GLTF** (standard web). OBJ/FBX : **conversion en GLB** au pipeline (job externe — Blender/assimp/gltf-transform, v2) ou message « format non preview-able, couverture requise » en v1.
- **Compression** : `gltf-transform` (Draco/KTX2) à l'upload pour des fichiers légers.
- **Fichier original** : l'acheteur télécharge le .GLB/.FBX d'origine (non compressé), comme déposé.

### 4.5 PDF (brochures, ebooks, portfolios)

| Audience | Preview |
|---|---|
| Public | **Premières N pages** (3-5) rendues en images (pdf.js) + filigrane |
| Acheteur | **Visionneuse PDF intégrée** (pdf.js) — pagination, zoom, plein écran + téléchargement |

- Rendu des pages en images (server-side, `pdfjs-dist` ou `mupdf`) pour le public (pas de fuite du PDF complet).
- Visionneuse embarquée pour l'acheteur (pdf.js client-side) — pas de téléchargement forcé, on peut lire avant.

### 4.6 ZIP / archives / autres (AI, PSD…)

| Type | Preview |
|---|---|
| ZIP | **Liste du contenu** (noms + tailles, arborescence) sans télécharger — via index au pipeline (liste des entrées), pas d'extraction complète |
| Font (TTF/OTF/WOFF) | **Spécimen** : saisie de texte « AaBbCc… » rendue dans la fonte (canvas `FontFace`) + caractères/jeux |
| PSD / AI / RAW | Couverture + aperçu rendu (si possible) sinon message « Preview indisponible — voir la couverture » |
| Autres (projet, plugin) | Couverture + liste de fichiers |

---

## 5. Architecture technique

```
lib/delivery/
  signed-url.ts         # URLs signées S3/CDN, expiration par taille (pattern Gumroad)
  zip-stream.ts         # ZIP streamé (pas de buffer mémoire) — archiver.js / custom
  library.ts            # LibraryItem CRUD + quotas + re-téléchargement
  consumption.ts        # ConsumptionEvent (download/stream/read) + compteurs
lib/preview/
  pipeline.ts           # orchestration des jobs de génération de previews
  image.ts              # sharp : variants, WebP/AVIF, filigrane
  video.ts              # ffmpeg : poster, clip, (v2: HLS)
  audio.ts              # ffmpeg : extrait 30 s + waveform
  pdf.ts                # pdfjs/mupdf : rendu pages (public) + visionneuse
  three-d.ts            # gltf-transform : compression GLB ; model-viewer
  font.ts               # spécimen canvas
  zip-listing.ts        # index du contenu des ZIP

jobs/ (Inngest)
  fulfill-order         # → bibliothèque + certificat + clé + email
  generate-previews     # async, par fichier (image/vidéo/audio/pdf/3d)
  expire-stale-links    # purge des URLs signées

CDN : Cloudflare / CloudFront
  - originaux : cache privé (auth par signature)
  - previews publics : cache public long (CDN)
  - streaming v2 : HLS segments cache public
```

**Pipeline de génération de previews (async, à l'upload du créateur ET à l'achat)** :

```
à l'upload (créateur) :
  image → variants (thumb/preview/full) + filigrane visible (public)
  video → poster + clip 5-10 s (public) ; (v2) HLS complet
  audio → extrait 30 s + waveform
  pdf   → pages 1-N en images (public)
  3d    → GLB compressé (Draco) + poster
  zip   → listing du contenu
à l'achat (fulfill) :
  → tout est déjà prêt ; on active l'accès complet (previews pleins + téléchargements)
```

---

## 6. Contraintes & limites (à assumer)

| Contrainte | Conséquence |
|---|---|
| **Formats non preview-ables** (AI, PSD bruts, RAW) | Preview = couverture + liste de fichiers ; jamais de rendu 1:1 (lourdeur, licence) |
| **ZIP géant** (> 5 Go) | Pas de preview ; téléchargement en fichiers individuels + ZIP streamé avec progression |
| **Vidéos longues** | v1 : progressive (lourde) ; v2 : HLS obligatoire (budget transcodage) |
| **3D non-GLB** | Conversion v2 ; sinon « couverture requise » |
| **DRM / protection anti-copie des fichiers** | Volontairement **aucun DRM** : les fichiers téléchargés sont libres d'usage (c'est la licence qui fait foi — SPEC_LICENCES) ; la protection est à la source (Shield, couche 2 : previews filigranés) |
| **Stockage** | Multi-réplicas S3 + coûts (originaux + previews) — à budgéter dans le modèle économique (A) |

---

## 7. Indicateurs à suivre

- Taux de téléchargement par produit (downloads/achat) ; **temps moyen avant premier téléchargement** (optimisation du flux).
- Taux de ré-abandon après achat (email de relance si pas de téléchargement sous 24 h — pattern panier abandonné).
- Part des téléchargements en ZIP vs fichier ; taille moyenne des packs.
- Délai de génération des previews (p95) ; taux d'échec des transcodages.
- Requêtes de récupération (« fichier cassé ») — cible < 0,5 %.

---

## 8. Roadmap

| Phase | Contenu | Statut |
|---|---|---|
| **M1** | Bibliothèque acheteur (grille + page produit acheté) + téléchargements URLs signées + ZIP streamé + quotas (Explorer/Studio) + **previews image + PDF** + emails de confirmation | MVP |
| **M2** | **Previews vidéo (poster + clip)** + audio (extrait 30 s + waveform) + ZIP listing + certificat PDF (SPEC_LICENCES) | Paiements |
| **M3** | **3D (model-viewer)** + spécimen fonts + HLS v2 pour vidéos longues + conversion OBJ/FBX (si demande) | Vendeurs |
| **M7+** | DRM optionnel (streaming chiffré) si marché l'exige • téléchargement par lots multiples • API mobile (lecture depuis l'app) | Itératif |
