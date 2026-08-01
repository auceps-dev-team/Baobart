# Baobart — Connexions tierces & Intégrations outils créatifs (Point L)

**OAuth login (Google, GitHub, Apple…) + connexion à Figma, Canva, Framer pour partager les créations**
**Document L — v1.0 — août 2026**

> Complète le blueprint (`BLUEPRINT_NEXTJS_BAOBART.md`, auth + intégrations) et le plan directeur (§3.7-A API publique, §3.7-B intégrations). Deux réponses techniques : **(1)** connecter des comptes sociaux/apple/github, **(2)** connecter des outils de création (Figma, Canva, Framer) et importer les créations dans Baobart via le pipeline Shield.

---

## PARTIE 1 — Connexions tierces (login social)

### 1.1 Réponse courte
**Oui, parfaitement.** NextAuth (Auth.js) — déjà notre stack — supporte **nativement** Google, GitHub, Apple, Discord, X/Twitter, Facebook, LinkedIn, Microsoft, Twitch… via OAuth 2.0 / OpenID Connect. Aucun développement custom : on ajoute le provider dans la config et on crée les credentials dans le portail développeur de chaque fournisseur.

### 1.2 Providers recommandés pour Baobart

| Provider | Pourquoi | Création credentials | Priorité |
|---|---|---|---|
| **Google** | Le plus universel (Gmail, Android), email vérifié | Google Cloud Console → OAuth Client | 🔴 |
| **Apple (Sign in with Apple)** | **Obligatoire** si une app iOS Baobart est publiée sur l'App Store (guideline Apple) ; email privé relayé | Apple Developer portal | 🔴 |
| **GitHub** | Communauté dev/designers, profil public | GitHub → Settings → Developer settings → OAuth Apps | 🟠 |
| **Discord** | Très présent chez les créatifs ; espaces communauté | Discord Developer Portal | 🟠 |
| **X / Facebook** | Créateurs actifs ; partage de shots | Portails X/Facebook developers | 🟡 |
| **LinkedIn** | Connexion au Job board (profil pro, recruteurs) | LinkedIn Developer | 🟡 |
| **Téléphone (OTP)** | ⚠️ **LE plus important en Afrique de l'Ouest** : beaucoup d'utilisateurs n'ont pas de compte Google « propre ». Le téléphone + mobile money est l'identité réelle. | SMS OTP (Twilio/Africastalking/Termii) | 🔴🔴 |

**Règle d'or** : en Afrique, le **login par téléphone + OTP est le mode principal** ; les boutons sociaux sont des compléments. Ne jamais faire dépendre l'inscription d'un compte Google.

### 1.3 Architecture NextAuth

```ts
// lib/auth/options.ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import Apple from "next-auth/providers/apple"
import Discord from "next-auth/providers/discord"
import Credentials from "next-auth/providers/credentials"  // email+OTP téléphone

export const authOptions = {
  providers: [
    Google({ clientId: env.GOOGLE_ID, clientSecret: env.GOOGLE_SECRET }),
    GitHub({ ... }), Apple({ ... }), Discord({ ... }),
    Credentials({ id: "phone-otp", ... })   // numéro + code OTP (mobile money wallet)
  ],
  callbacks: {
    // liaison de comptes : même email vérifié → même compte (account linking)
    signIn({ user, account, profile }) { ... },
    jwt({ token, user, account, profile }) { ... },
    session({ session, token }) { ... }
  },
  session: { strategy: "jwt" }   // ou database
}
```

**Points clés de sécurité :**
- **Account linking** : si un nouvel utilisateur se connecte via Google avec un email déjà utilisé par un compte OTP/email → on **fusionne** les comptes (vérifier que l'email est bien vérifié par le provider). C'est ce qui évite les doublons.
- **Niveaux de confiance** : `emailVerified` par le provider = **trusted** (peut servir pour la récupération de compte) ; sinon = non vérifié.
- **PKCE + state** : gérés par NextAuth ; tokens jamais exposés au client.
- **2FA** : le compte Baobart conserve sa propre 2FA (TOTP + passkeys §3.6) **en plus** du login social — un accès social ne contourne jamais la 2FA pour les actions sensibles (payouts, changement d'email).
- **Apple specifics** : gérer l'email privé relayé (`@privaterelay.appleid.com`), le nom fourni en 2 parties ; le bouton doit respecter les guidelines Apple.
- **RGPD** : consentement explicite, politique de confidentialité liée, boutons « Se connecter avec X » conformes.

### 1.4 Modèle de données (complément blueprint §4.1)

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  provider          String                    // google | github | apple | discord | phone | email
  providerAccountId String
  providerUserId    String?                   // id chez le provider (si dispo)
  emailVerified     Boolean @default(false)   // confiance du provider
  accessTokenEnc    String?                   // chiffré (jamais en clair)
  refreshTokenEnc   String?
  expiresAt         DateTime?
  createdAt         DateTime @default(now())
  user              User    @relation(fields: [userId], references: [id])
  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

---

## PARTIE 2 — Connecter les outils créatifs (Figma, Canva, Framer) et partager les créations

### 2.1 Réponse courte
**Oui** — les trois approches combinables : **(a)** connecter l'outil via OAuth et importer via son API, **(b)** publier depuis un **plugin/app dans l'outil** (« Publier sur Baobart »), **(c)** importer par lien public. L'import passe par le **pipeline Shield existant** (pHash, filigrane, variants, C2PA) puis crée un **shot** (publication) ou un **produit** (vente).

### 2.2 Maturité réelle des API (vérifié)

| Outil | API publique | OAuth | Exporter des créations | Webhooks | Verdict Baobart |
|---|---|---|---|---|---|
| **Figma** | ✅ REST complète (38 endpoints) | ✅ OAuth2 (scopes `files:read`, `files:write`, `webhooks:read`…) | ✅ **Rendu PNG/JPG/SVG/PDF de n'importe quel frame/node** via `GET /v1/images/:key?ids=…` | ✅ (FILE_UPDATE, COMMENT…) | 🔴 **Priorité 1** — le plus mature |
| **Canva** | ✅ **Connect API** (OAuth2) | ✅ | ✅ **Export async** : `POST /rest/v1/exports` (design_id + format PNG/JPG/PDF/MP4/PPTX/GIF) → poll `GET /rest/v1/exports/{jobId}` | ⚠️ partiel | 🔴 **Priorité 2** — très bon, export asynchrone |
| **Framer** | ⚠️ Limitée (CMS API, publishing) | ⚠️ | ⚠️ Pas d'export de frames via API publique robuste | ❌ | 🟠 Via **plugin/extensions** ou import par lien/export manuel |

**Limites à connaître (vérifiées) :**
- **Canva** : export **asynchrone** (job à poller) ; limites rate (75 exports/5 min par user, 750/5 min par intégration) ; **plan gratuit** ne peut pas upscaler au-delà de 1,125× ; un export peut échouer si le design contient des **éléments premium** non achetés.
- **Figma** : rate limits (≈30 req/s en paid) ; le scope `file_read` est déprécié (utiliser les nouveaux scopes) ; les fonts embarquées s'exportent en contours/rendu selon les options.

### 2.3 Les 3 mécanismes (à implémenter en complément)

#### (a) Connecter l'outil + import via API (le plus simple)
1. L'utilisateur clique « Connecter Figma/Canva » dans le dashboard → **OAuth** (même mécanique que le login, mais avec les scopes de l'outil).
2. **Sélecteur** : liste des fichiers/designs (Figma `GET /v1/me` + fichiers accessibles ; Canva `GET /rest/v1/designs`).
3. **Choix des éléments** : Figma → sélectionner des frames/pages ; Canva → le design entier.
4. **Export** : Figma `GET /v1/images/:key?ids=…&format=png&scale=2` ; Canva `POST /rest/v1/exports` puis **poll du job** (job Inngest).
5. **Pipeline Shield** (§Point C) → création **WorkItem (brouillon de shot)** ou **Product (brouillon de fiche)**.
6. L'utilisateur finalise (titre, description — aidé par l'IA §9) et **publie**.

#### (b) Plugin / App dans l'outil (« Publier sur Baobart ») — l'expérience phare
- **Plugin Figma** (TypeScript, API Plugin Figma) : le designer **sélectionne un frame, clique « Publier sur Baobart »**, le plugin appelle l'API Baobart (avec un token OAuth Baobart généré dans le dashboard) → export + import → **shot créé sans quitter Figma**.
- **Canva App** (Canva Developers, app type Connect API) : panneau « Publier sur Baobart » avec le design courant.
- **Framer** : plugin/extensions du navigateur (import par sélection d'assets publiés) — la voie réaliste vu l'API limitée.
- C'est exactement le parcours « **partager ses créations sur Baobart** » : le workflow vit dans l'outil du créateur.

#### (c) Import par lien public
- L'utilisateur colle un lien (`figma.com/file/…`, `canva.com/design/…`, URL Framer publiée).
- Baobart résout : Figma/Canva → API (si l'utilisateur est connecté) ou **preview embarquée** (pas d'import direct sans connexion) ; Framer → capture du site publié (aperçu).
- Simple à implémenter, bon complément pour les découvertes.

### 2.4 Architecture & modèle de données

```
lib/integrations/
  registry.ts            # config par provider (scopes, endpoints, formats supportés)
  figma.ts               # OAuth + list files + export frames (PNG/SVG/PDF)
  canva.ts               # OAuth + list designs + export async (job poll)
  framer.ts              # import par lien / capture
  import-pipeline.ts     # orchestration : export → téléchargement → Shield → WorkItem/Product
jobs/
  canva-export-poll      # Inngest : poller le job d'export Canva
  process-import         # lancer le pipeline Shield après téléchargement
app/dashboard/integrations/
  page.tsx               # « Vos connexions » : connecter/connecté, révoquer
  import-picker.tsx      # sélecteur de fichiers/frames/designs
```

```prisma
model IntegrationConnection {
  id            String   @id @default(cuid())
  userId        String
  provider      String                    // FIGMA | CANVA | FRAMER | ADOBE
  accessTokenEnc  String?                  // chiffré AES (clé par user)
  refreshTokenEnc String?
  providerUserId String
  providerUserName String?
  scopes        String?                   // liste des scopes accordés
  status        String   @default("active") // active | revoked | expired
  lastSyncAt    DateTime?
  connectedAt   DateTime @default(now())
  @@unique([userId, provider])
}

model ImportedAsset {
  id              String  @id @default(cuid())
  connectionId    String
  providerAssetId String                   // id du fichier/design chez le provider
  title           String
  assetType       String                   // IMAGE | VECTOR | VIDEO | PDF | MULTI
  formats         String?                  // "png,svg,pdf" disponibles
  sourceUrl       String?
  mediaId         String?                  // → MediaAsset (après pipeline Shield)
  status          String  @default("imported") // imported | processing | draft | published
  workItemId      String?                  // shot créé
  productId       String?                  // produit créé
  createdAt       DateTime @default(now())
}
```

### 2.5 Pipeline d'import (réutilise le Shield)

```
export (API outil) → téléchargement temporaire
  → validations (format, taille, virus)
  → pipeline Shield (§C) :
      pHash · filigrane invisible · variantes + filigrane visible · C2PA · (opt-in Glaze)
  → création WorkItem (shot) OU Product (draft)
  → prévisualisation côté utilisateur (aperçus filigranés)
  → l'utilisateur finalise (titre, description via IA, prix FCFA, licence) → publie
```

- **Figma** : vecteurs → SVG (parfait pour les assets) ; frames → PNG 2×/3× selon besoin ; frames longs → PDF.
- **Canva** : PNG (dimensions design, attention plafond plan gratuit) ou PDF (multipages) ; MP4 pour les designs animés.
- **Noms de fichiers préservés**, metadata source conservée (`ImportedAsset.sourceUrl`) pour la traçabilité.
- **Droits** : l'utilisateur confirme qu'il possède les droits (case à cocher au moment du partage) — important pour éviter le dépôt de contenu copié.

### 2.6 Webhooks & vie des créations

- **Figma webhook** `FILE_UPDATE` : si un shot Baobart provient d'un fichier Figma, proposer « Mettre à jour depuis la v2 » (re-export → nouvelle version du shot, historique).
- **Révoquer** une connexion = supprimer les tokens + désactiver les webhooks (le créateur garde ses shots déjà publiés).

### 2.7 Cas d'usage concrets

| Créateur | Parcours |
|---|---|
| Designer UI | Fini une maquette dans Figma → plugin « Publier sur Baobart » → le frame devient un shot dans le feed (ou un produit vendable) |
| Créateur Canva | « Connecter Canva » → sélectionne son affiche → export PNG → la met en vente 5 000 F |
| Étudiant | Colle un lien Figma public → preview + import → partage dans son espace d'équipe |
| Motion designer | Export MP4 depuis Canva/Figma → vidéo du feed (previews vidéo §I) |

### 2.8 Sécurité & RGPD

- Tokens **chiffrés au repos** (clé par utilisateur), jamais loggués, **révocation** à la demande + auto en cas d'inactivité.
- Scopes **minimaux** demandés (`files:read`, jamais `files:write` sauf plugin).
- Consentement explicite : « Autoriser Baobart à accéder à vos designs Figma » avec la liste exacte des permissions.
- Pas de ré-import automatique sans confirmation (sauf webhook avec consentement).

---

## PARTIE 3 — Impact sur le plan

| Élément | Phase | Contenu |
|---|---|---|
| **Login social** (Google, GitHub, Apple, Discord, X) | **M0** | NextAuth providers + account linking + niveaux de confiance + 2FA indépendante |
| **Login téléphone + OTP** | M0-M1 | Passerelle SMS (Africastalking/Termii/Twilio), associée au mobile money |
| **Connexion Figma + import** | **M7** | Connecteur OAuth + sélecteur + export frames + pipeline Shield → shots |
| **Plugin Figma « Publier sur Baobart »** | M7 | Extension TypeScript dans Figma |
| **Connexion Canva + export async** | M7 | Connect API + job poll Inngest + limites rate |
| **Framer (par lien/plugin)** | M7+ | Import par URL publiée, capture |
| **Webhooks Figma (mise à jour shots)** | M8 | Re-import versionné |

**Le login social est quasi gratuit (M0, NextAuth le fait)** ; les intégrations outils sont **une vraie phase M7** mais avec un ROI énorme : c'est LE différenciateur « partage tes créations sans quitter ton outil » qui peut attirer les créateurs.

---

## PARTIE 4 — Rappel des credentials à créer (prérequis)

| Provider | Où créer les credentials |
|---|---|
| Google | Google Cloud Console → APIs & Services → OAuth consent screen + OAuth client |
| GitHub | GitHub → Settings → Developer settings → OAuth Apps |
| Apple | Apple Developer → Certificates, IDs & Profiles → Sign in with Apple |
| Discord | Discord Developer Portal → Applications → OAuth2 |
| X / Facebook / LinkedIn | Portails développeurs respectifs |
| Figma | Figma → Settings → Create OAuth app (file access) |
| Canva | Canva Developers → créer une app Connect API |
| SMS OTP | Africastalking / Termii / Twilio (compte + clés API) |
