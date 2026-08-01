# Baobart — Spécification Licences (Point E)

**Types de licences, conditions, certificat, clés d'activation**
**Document E — v1.0 — août 2026**

> Complète le plan directeur (§2.3, §3.1). Ce document détaille : les **types de licences Baobart**, leurs **conditions précises**, le **certificat de licence** délivré à l'achat, et le **système de clés d'activation** (pattern porté des `License`/`licenses_controller` de Gumroad).

---

## 1. Principes

1. **Gumroad n'a pas de catalogue de licences** — les vendeurs écrivent leurs conditions librement. Baobart, lui, **standardise** 3 types + 1 option : c'est plus lisible pour l'acheteur, plus défendable juridiquement, et ça structure l'offre par plan (§2.3).
2. **La licence est liée au plan acheteur** : Explorer → licence **Personnelle** ; Studio → **Personnelle + Commerciale** ; licence **Étendue** = option payante par produit.
3. **Chaque achat génère un certificat de licence** téléchargeable (PDF) avec les conditions applicables, le n° de commande et l'acheteur.
4. **Les clés d'activation** ne concernent que certains produits (logiciels, fonts, plugins, assets à activer) — pattern Gumroad : sérial + API verify/enable/disable/rotate.

---

## 2. Les types de licences

### 2.1 Licence PERSONNELLE (incluse dans Explorer)

| Champ | Valeur |
|---|---|
| **Usage** | Projets **personnels, non commerciaux** : portfolio perso, études, projets étudiants, usage privé |
| **Commercial** | ❌ Interdit (sauf test/demo interne non diffusée) |
| **Impression** | ≤ 500 exemplaires, usage non commercial |
| **Redistribution** | ❌ Interdite (fichiers sources, même modifiés) |
| **Entraînement IA** | ❌ Interdit |
| **Revente brute** | ❌ Interdite |
| **Client final** | Aucun (le licencié est l'utilisateur final) |
| **Crédit** | Recommandé (mention « asset via Baobart ») |

### 2.2 Licence COMMERCIALE (incluse dans Studio)

| Champ | Valeur |
|---|---|
| **Usage** | Projets **commerciaux** : identité de marque, site web, print, réseaux sociaux, vidéo, packaging |
| **Client final** | ✅ 1 client final par achat (ou l'agence pour ses propres clients, dans la limite de 1 projet) |
| **Impression** | ≤ 10 000 exemplaires par usage |
| **Redistribution** | ❌ Interdite (les fichiers sources restent confidentiels) |
| **Entraînement IA** | ❌ Interdit (sauf licence étendue) |
| **Revente brute** | ❌ Interdite |
| **Crédit** | Optionnel |

### 2.3 Licence ÉTENDUE (option payante par produit — ex. ×2 à ×5 du prix)

| Champ | Valeur |
|---|---|
| **Usage** | Tout usage commercial **sans plafond** : merchandising (t-shirts, goodies), édition (livres, magazines, affiches grand format), **broadcast** (TV, cinéma, streaming), packaging de masse |
| **Client final** | ✅ Multiples (à préciser par produit si le vendeur le limite) |
| **Impression** | Illimitée |
| **Entraînement IA** | ✅ Inclus (usage des assets pour entraîner ses propres modèles, sous réserve CGU) |
| **Redistribution** | ❌ Toujours interdite (les fichiers sources restent confidentiels) |
| **Revente brute** | ❌ Interdite |

### 2.4 Matrice plan → licence

| Plan | Licence incluse | Licence étendue |
|---|---|---|
| Découverte (gratuit) | Aperçus + 3 téléchargements « GRATUIT » (licence perso de démo) | — |
| Explorer | **Personnelle** | Option payante |
| Studio | **Personnelle + Commerciale** | Option payante |
| Achat à l'unité | Licence choisie par le vendeur (perso / com / étendue) | Selon produit |

---

## 3. Le certificat de licence (généré à chaque achat)

**Déclencheur** : à la réussite du paiement (job Inngest `generate-license-certificate`).

**Contenu du PDF** (template HTML → PDF via `react-pdf` / `puppeteer`) :
1. En-tête : logo Baobart + « Certificat de licence » + numéro de certificat (`LC-2026-XXXXXXXX`).
2. Acheteur (nom, email), Vendeur (profil), Produit, date d'achat, n° de commande.
3. **Type de licence** + tableau des conditions applicables (repris du §2).
4. Hash de vérification (on peut vérifier le certificat sur `/verifier-licence`).
5. QR code (lien de vérification).

**Où le retrouver** : dans la **bibliothèque acheteur** (à côté du produit) — téléchargeable à tout moment. Pour les produits à clé d'activation, le certificat affiche aussi la clé.

---

## 4. Clés d'activation (pattern Gumroad, porté en TS)

### 4.1 Produits concernés
Fonts, logiciels, plugins, templates à installer, assets à activer. Le vendeur active l'option « nécessite une clé » sur le produit.

### 4.2 Modèle (déjà au blueprint §4.4)

```prisma
model LicenseKey {
  id          String   @id @default(cuid())
  productId   String
  orderItemId String   @unique
  serial      String   @unique          // XXXXXXXX-XXXX-XXXX-XXXXXXXX (32 hex, formaté en 4×8)
  status      String   @default("active")  // active | disabled
  usesCount   Int      @default(0)
  maxUses     Int      @default(1)      // ex. fonts : activations par machine
  disabledAt  DateTime?
  rotatedAt   DateTime?
  createdAt   DateTime @default(now())
}
```

### 4.3 API de vérification (routes Next.js)

```
POST /api/licenses/verify      { serial, product_slug } → { valid, uses, max }
PUT  /api/licenses/enable      { serial }                → { success }
PUT  /api/licenses/disable     { serial }                → { success }
POST /api/licenses/decrement   { serial }                → { uses -= 1 }
POST /api/licenses/rotate      { serial }                → { new_serial }  // clé compromise
```

- **Sécurité** : les actions `enable/disable/rotate` exigent une **clé API vendeur** (OAuth/API token) — pattern exact des contrôleurs Gumroad (`doorkeeper_authorize! :edit_products`).
- **Rate limiting** : le verify accepte ~100 req/10 min par IP (anti-bruteforce).
- **Usages** : compteur pour les produits qui s'activent par machine (fonts, plugins).

### 4.4 Cycle de vie

```
achat → génération du sérial (uuid hex sans tirets, formaté 4×8)
     → remis à l'acheteur (page produit + bibliothèque + certificat)
     → l'acheteur active dans l'app/le plugin (verify)
     → usages décrémentés / clé désactivée à la demande du vendeur
     → rotation en cas de vol/compromission
     → remboursement → clé désactivée automatiquement (réconciliation)
```

---

## 5. Affichage & transparence

| Surface | Élément |
|---|---|
| **Fiche produit** | Bloc « Licence » : type(s) proposé(s), prix des options (étendue), conditions résumées + lien « Voir la licence complète » |
| **Checkout** | Case à cocher « J'accepte la licence [type] » (obligatoire) + résumé des droits/limites |
| **Bibliothèque acheteur** | Certificat PDF + clé (si applicable) + rappel des droits |
| **Page `/licences`** | Les 3 types détaillés + FAQ (« puis-je l'utiliser pour une affiche ? … ») |

---

## 6. Données (complément blueprint §4.4)

```prisma
model LicenseCertificate {
  id            String   @id @default(cuid())
  orderId       String   @unique
  certificateNo String   @unique          // LC-2026-XXXXXX
  licenseTypeId String
  pdfUrl        String?
  verificationHash String @unique
  issuedAt      DateTime @default(now())
}

model ProductLicense { productId String; licenseTypeId String; pricePremium Int?; @@id([productId, licenseTypeId]) }
```

---

## 7. Roadmap

| Phase | Contenu | Statut |
|---|---|---|
| **M1** | Types de licence en données + affichage fiche produit + case à cocher checkout | Minimal |
| **M2-M3** | Certificat PDF automatique + bibliothèque acheteur (téléchargement) + licences liées aux plans (Explorer/Studio) | Principal |
| **M6** | Clés d'activation + API verify/enable/disable/rotate + page `/licences` + réconciliation remboursements | Complet |
