# Audit technique & produit — Baobart

> **Casquette 1/3 — développeur.** Objectif : une connaissance large *et* approfondie du
> dépôt, avant toute décision marketing.
>
> **Date de l'audit :** 5 octobre 2026 · **Commit audité :** `913caa7` (v1.77.1) ·
> branche `arena/01a10c4a-baobart`
>
> **Auteur :** session d'analyse (lecture du dépôt, des specs, du code).

---

## 0. Méthode — ce qui est mesuré, ce qui est lu

Convention reprise de `CLAUDE.md` (« distinguer ce qui est mesuré de ce qui est lu ») :

| Marque | Sens |
|---|---|
| **🔍 Mesuré** | comptage ou constat fait dans le dépôt le 05/10/2026 |
| **📖 Lu** | affirmation trouvée dans un document du dépôt ou dans le code, non rejouée |
| **🌐 Source externe** | chiffre de marché, avec lien, daté |

**Ce qui n'a pas pu être vérifié, et pourquoi :** `node_modules/` est absent (0 entrée) —
ni `pnpm typecheck`, ni `pnpm test`, ni `pnpm build` n'ont été exécutés. Aucune base
PostgreSQL n'est montée. Tout ce qui suit concerne donc le **code tel qu'il est écrit**,
pas son comportement à l'exécution aujourd'hui. Les chiffres de tests cités sont ceux
que le dépôt lui-même déclare dans `Doc/MATRICE_IMPLEMENTATION.md` (📖), pas des
exécutions de cette session.

---

## 1. Ce qu'est Baobart, en une page

**Le positionnement** (📖 `Doc/README.md`, `Doc/CHARTE_EDITORIALE_BAOBART.md`) :

> **« Le studio partagé de l'Afrique créative. »**
> **« Du premier croquis au premier encaissement. »**

Un hybride de trois modèles que le marché connaît déjà :

| Emprunté à | Ce que Baobart en prend |
|---|---|
| **Dribbble** | portfolios, « shots », likes, followers, défis |
| **Pinterest** | feed visuel infini, tableaux, épinglage |
| **Gumroad** | vente de ressources, licences, abonnements — **payés en FCFA** |

**La boucle produit (core loop)** : un créatif publie un *shot* → la communauté le
découvre dans le *feed* → likes / épingles → *followers* → le shot peut être lié à un
produit vendable, un service ou une commission → gains en **FCFA** et en réputation.
Chaque publication est donc un acte de découverte **et** un acte commercial potentuel.

**Le modèle économique** (📖 `Doc/README.md`, `Doc/PLAN_REFONTE_BAOBART_GUMROAD.md` §2) :

| Flux | Mécanique |
|---|---|
| Abonnements acheteurs | Découverte (gratuit, 3 téléchargements/mois) · **Explorer 2 500 F/mois** · **Studio 7 500 F/mois** |
| Commission créateurs | **10 %** sur une vente directe (🔍 `lib/domain/fees.ts`) |
| Pool créateurs | 60 % des abonnements redistribués (modèle Envato Elements) |
| Autres | sponsoring, job board payant, boosts de visibilité, événements, produits physiques (phase 2) |
| Frais de paiement | ~1,5 % supportés par le vendeur |

**Le chiffre que le site affiche aujourd'hui** : 🔍 mesuré le 25/09/2026 dans le dépôt —
une vente directe de 10 000 F crédite **8 850 F**, soit **88,5 %** (10 % de commission
+ 1,5 % de frais d'opérateur restent à la charge du vendeur). La maquette annonçait
« 80 % » et deux écrans annonçaient « 90 % » ; la phrase vit maintenant dans une seule
fonction, `partDuCreateur()` (📖 `lib/domain/fees.ts` §314-338).

**Les deux différenciateurs produits** :
- **Baobart Shield** — protection des œuvres en 4 couches (filigrane invisible, provenance
  C2PA, perturbation anti-entraînement IA, aperçus dégradés). 📖 `Doc/SPEC_BAOBART_SHIELD.md`
- **Gamification** — badges jamais achetables (Créateur vérifié, Top créateur, VIP…).
  📖 `Doc/SPEC_GAMIFICATION_BAOBART.md`

---

## 2. Architecture — l'état du socle (🔍 mesuré)

| Couche | Ce qui est en place | Relevé |
|---|---|---|
| Framework | **Next.js 15 (App Router)**, React 19, TypeScript strict | `package.json`, `tsconfig.json` |
| Surface applicative | **99 fichiers** `page.tsx`/route sous `app/` (vitrine + dashboard + API) | `find app -name page.tsx` |
| Volume de code | **~122 000 lignes** TypeScript/TSX dans `lib/` + `app/` + `components/` | `wc -l` |
| Base de données | **PostgreSQL 16 + Prisma 6** — **94 modèles**, **46 enums**, **65 migrations** | `prisma/schema.prisma`, `prisma/migrations/` |
| UI | **Tailwind CSS v4** + « Sticker System » (tokens CSS dans `app/globals.css`) | 📖 `Doc/ANALYSE_DESIGN_SYSTEM_BAOBART.md` |
| Tests | **144 fichiers de test** (Vitest) : décideurs purs + intégration sur base réelle `baobart_test` | `find . -name "*.test.ts"` |
| Tests navigateur | **6 fichiers** Playwright (dont 4 `.spec.ts`), 19 parcours, exécutés **sur un build** | `e2e/`, `playwright.config.ts` |
| Médias | Stockage S3-compatible (MinIO en local, R2 en prod), upload direct par URL signée, `sharp` pour les dérivés | `lib/upload/`, `lib/medias/` |
| PWA | `app/manifest.ts` + `public/sw.js` + icônes 192/512/masquable | 📖 commentaires du manifeste |
| Déploiement | **Vercel** (crons dans `vercel.json`) **ou** Docker `standalone` sur VPS — même code | `Dockerfile`, `docker-compose.yml`, `vercel.json` |
| Tiers | Aucune dépendance de paiement : les pilotes sont écrits à la main contre les API | `lib/payments/encaissement/pilotes/` |

**Point d'attention d'architecture, lisible dans le code lui-même** : le projet est
écrit en **français, commentaires compris**, avec une discipline documentaire inhabituelle
— chaque module non trivial porte un en-tête qui explique *pourquoi* il existe et ce qu'il
ne fait pas. C'est un atelier de développement mature, pas un prototype.

---

## 3. État fonctionnel par domaine

Légende : ✅ fait et testé · ⚠️ partiel · ❌ absent · ⛔ volontairement hors périmètre.
Source principale : 📖 `Doc/MATRICE_IMPLEMENTATION.md` (dite « vivante », mise à jour à
chaque commit), recoupée avec `Doc/PLAN_REFONTE_BAOBART_GUMROAD.md` §0-bis.

### 3.1 Argent & commerce — le cœur, et le plus solide

| Bloc | État | Ce qu'il faut retenir |
|---|---|---|
| Frais & grand livre (2 régimes) | ✅ | Écritures **immuables** tenues par des **triggers Postgres**, pas par du code applicatif (`prisma/tests/garde-fois-argent.sql`) |
| Remboursements (partiels, multiples causes) | ✅ | L'appel opérateur part **avant** l'écriture comptable |
| Litiges / chargebacks | ✅ | Débite le vendeur, suspend ses versements, écriture dédiée |
| Versements (calendrier, éligibilité, 8 états) | ✅ | Pilotables depuis un écran admin |
| Versements — **envoi effectif** | ⚠️ | Le cron **prépare** (`CREATING`) ; l'appel opérateur qui ferait passer à `PROCESSING` n'est pas branché |
| Passage en caisse | ✅ | Deux chemins : simulation ou opérateur réel |
| **Paiement mobile money** | ⚠️ | **Substrat complet + 3 pilotes écrits** (Paystack, Flutterwave, bac à sable). Il manque **un compte marchand** |
| Codes promo | ✅ | 30 tests d'intégration ; plafond dans le `WHERE`, pas dans un `if` |
| Pourboires | ✅ | Dans `OrderItem.tipAmount`, à côté du prix |
| Upsell post-achat | ✅ | Après l'achat, jamais pendant (parcours mobile money en deux temps) |
| Relance de paiement | ✅ | 2 h après l'abandon, une seule fois, taux mesuré |
| Échelonnement, cartes cadeaux, précommandes | ❌ | Non commencés |
| Parité de pouvoir d'achat | ⚠️ | Mécanisme écrit, **personne à servir aujourd'hui** (4 pays ouest-africains seulement) |

**Ce que ça veut dire pour un marketeur** : la mécanique commerciale est *plus avancée*
que la plupart des MVP de marketplace. Ce qui manque n'est pas du code — c'est un
**compte marchand chez un opérateur**.

### 3.2 Découverte, social, communauté

| Bloc | État | Note |
|---|---|---|
| Feed masonry + pagination curseur | ✅ | Conçu pour des centaines de milliers d'utilisateurs |
| Fiche produit (+ modale interceptée, URL partageable) | ✅ | |
| Profil public créateur | ✅ | Répare un lien mort : on pouvait suivre sans pouvoir visiter |
| Likes, follows, commentaires à deux niveaux, collections | ✅ | 20 + 27 tests |
| Communautés / espaces d'équipe | ✅ | 138 tests ; collection partagée + fil plat, repris de la maquette |
| Modération | ⚠️ | Signalement manuel ; pas d'automatisation |
| Forum threadé | ⚠️ | Code et modèles là, **aucun écran** |

### 3.3 Créateurs & acheteurs (dashboard)

✅ Dépôt de ressource (brouillon → publication → retrait), envoi de fichiers
(**24 formats, jusqu'à 200 Mo**), aperçus (vignette publique / source privée),
livraison après achat (URL signée + journal de consommation), écran **Gains**
(solde, prochaine date, historique, compte de versement), tableau de bord acheteur
(achats, téléchargements, suivis, abonnements), statistiques, promotions, publicités.

⚠️ **Trois écrans montrent des données qu'aucun parcours ne produit encore** (Commandes,
Ventes, Commissions) — en attente du paiement réel. **Profil, Boutique et Commissions
donnent à lire, jamais à modifier.**

### 3.4 Confiance, sécurité, conformité

✅ Authentification (email + OTP téléphone + social déclaré), rôles progressifs
(acheteur → atelier → boutique), **2FA TOTP** (27 tests, vecteurs RFC 6238) et
**WebAuthn/passkeys** (17 tests + authentificateur virtuel Chrome), blocklist IP/objet,
anti-bot (leurre + plancher de temps + score tiers), limitation de débit (45 tests),
RGPD/effacement conforme à la **loi ivoirienne n° 2013-450**, machine à états de risque
vendeur (câblage manuel).

✅ **Droit d'auteur / retrait juridique** : le dépôt identifie le bon régime — le
**chapitre 6 de la loi ivoirienne n° 2013-451** (art. 46-54), et non la loi sur les
transactions électroniques. Les six exigences de l'article 47 sont portées verbatim dans
le code. 📖 `lib/juridique/article47.ts`

### 3.5 Contenu (CMS), micro-services, notifications

| Bloc | État | Note |
|---|---|---|
| Blog (rédaction, relecture, public, SEO, JSON-LD) | ✅ | **Markdown only, zéro HTML rendu** — le projet ne rend d'HTML nulle part |
| Job board (dépôt, modération, candidature, CV) | ✅ | 72 tests ; badge « Offre vérifiée » |
| Services listés | ✅ | 53 tests |
| Événements & concours | ✅ | 129 tests ; inscriptions à verrou de capacité atomique |
| Notifications in-app (13 événements) | ✅ | 12 sur 13 déclenchés ; 6 avis impératiels |
| E-mails transactionnels | ✅ 4/5 | Le 5ᵉ (lien de téléchargement) est **volontairement muet** : une URL signée dans un courriel est un laissez-passer au porteur |
| Ordonnanceur | ✅ | 6 passages cron ; trois niveaux de test, dont un e2e qui prouve que Next sert bien l'URL |

### 3.6 Back-office

⚠️ Un **espace d'exploitation technique** existe (`app/dashboard/systeme/` : configuration,
e-mails, membres, versements, blocklist, paiements). ❌ Le **CMS multi-rôles** spécifié
(`SPEC_ADMIN_CMS_BAOBART.md` — SUPER_ADMIN / CONTENT_MANAGER / MARKETING / MODERATOR /
SUPPORT / ACCOUNTANT / COMPLIANCE) **n'a pas d'écran**. Les 7 rôles et le journal
d'audit existent en base ; la promotion passe par la base, pas par l'interface.

---

## 4. Ce qui bloque une ouverture au public

Classé par ordre de blocage réel (📖 §0-bis du plan, recoupé avec la matrice) :

1. **Le compte marchand.** Le code est là, les comptes ne le sont pas. Aucun des trois
   pilotes n'a été exercé contre le vrai service. **C'est un délai externe, pas une
   tâche de dev** — et c'est le seul vrai bloqueur du lancement commercial.
2. **L'envoi effectif des versements.** Le pendant sortant du point 1 : mêmes comptes
   marchands, même délai.
3. **Aucun écran admin métier.** Sans CMS MARKETING/MODERATOR, l'équipe marketing ne
   peut pas publier elle-même articles, événements et jobs — tout passe par un dev.
4. **Aucune attribution de découverte.** Le régime « découverte » (30 %) est calculé,
   mais `encaisserLigne` ne reçoit que `"DIRECT"` en dur. La phrase « 70 % quand
   l'acheteur te trouve par l'exploration » a été **retirée** de l'écran des gains —
   elle reviendra avec l'attribution. → **Ne pas la communiquer.**
5. **Écrans en lecture seule** (Profil, Boutique, Commissions).
6. **Aucune surface SEO technique.** 🔍 Mesuré : pas de `app/sitemap.ts`, pas de
   `app/robots.ts`, pas de `public/robots.txt`, pas d'image Open Graph dans les
   métadonnées de `app/layout.tsx`. Un lancement en février sans sitemap ni OG part
   avec un handicap de découvrabilité.

---

## 5. Dette technique assumée (telle que le dépôt la déclare)

- **Aucun fond de tâche asynchrone** : les aperçus sont produits en ligne, dans la
  requête. « Passable jusqu'à ce qu'un créateur envoie vingt fichiers. »
- **Formats non image sans aperçu automatique** (PSD, AI, TTF, MP4, ZIP) : le créateur
  dépose sa vignette. Choix assumé.
- **Deux styles de tableau de bord cohabitent** (`EcranDashboard` / `DashboardFrame`).
- **Boutons d'action dans l'ancre de carte du feed** : HTML invalide (`<button>` dans
  `<a>`), annoncé comme tel.
- **Deux effets de suspension déclarés mais non exécutés** (réactivation des produits,
  blocage IP partiel).
- **`UploadReservation` s'accumule** comme journal.
- **Redis branché pour la limitation seulement** — ni cache, ni file, ni sessions.

---

## 6. Les actifs marketing déjà disponibles dans le dépôt

C'est le résultat le plus utile de cet audit pour la suite :

| Actif | État | Usage marketing immédiat |
|---|---|---|
| **Charte éditoriale complète** | 📖 `Doc/CHARTE_EDITORIALE_BAOBART.md` — ton, formules prêtes à l'emploi, anti-exemples, checklist qualité | Écrire chaque post, e-mail et page sans réinventer la voix |
| **Design system « Sticker »** | tokens, règles, contrastes WCAG calculés | Des créas reconnaissables en 1 seconde, sans directeur artistique à brief er |
| **Maquettes de référence** | 🔍 8 fichiers `.dc.html` + 22 visuels dans `Baobart Design/` | Source des compositions social/print |
| **Catalogue de démonstration** | 90 produits, 239 visuels servis depuis MinIO | Alimenter un feed réel pendant la bêta |
| **Compteurs réels** | `compterCommunaute()` lit la base (ressources, créateurs, note) | Des chiffres signatures **vrais**, jamais inventés |
| **Témoignages modèles** | 3 personas documentés dans la charte (Awa/Dakar, Serge/Kivu, Aïcha/Abidjan) | Base de la preuve sociale — **à remplacer par de vrais clients** |
| **Formules de micro-moments** | « 🎉 Encaissé ! +4 000 F » etc. | Notifications et posts de célébration |

⚠️ **Deux réserves à connaître avant de communiquer** :
- Les chiffres du héros de la maquette (« 12 400 créateurs · 170+ ressources · 4,9/5 »)
  sont des **exemples de maquette**. Les compteurs réels viennent de la base.
- Trois visuels du catalogue de démo portent encore un filigrane `gentube.app` en aperçu
  de pack. À nettoyer avant toute mise en avant publique.

---

## 7. Ce que l'audit implique (synthèse)

**🛠️ Ce que ça implique**

- Le produit est **beaucoup plus avancé que sa notoriété** : le lancement de février ne
  part pas d'une page blanche, il part d'une plateforme quasi complète dont le seul
  verrou est administratif (compte marchand).
- La communication peut s'appuyer sur des **preuves produit réelles** (parcours d'achat,
  licences, espaces d'équipe, protection anti-IA) et pas seulement sur une promesse.
- Le marketing doit **compter avec un délai qu'il ne contrôle pas** : la validation du
  compte marchand. Tout plan de communication doit donc avoir une marge, et une version
  « lancement en douceur » si le compte tarde.
- Le marketing a besoin de **deux écrans qui n'existent pas encore** : la publication
  autonome de contenu (CMS) et la lecture de ses propres résultats (statistiques).
  📖 `statistiquesRelance` existe et **aucun écran ne l'appelle**.

**🚀 Ce qui a été fait dans cette étape**
1. Lecture du dépôt : `README.md`, `CLAUDE.md`, les 20 documents de `Doc/`, les 8 maquettes,
   le schéma Prisma, les points d'entrée marketing (`app/page.tsx`, `components/home/`,
   `lib/config/`, `app/tarifs`, `app/createurs`).
2. Relevés mesurés : 99 routes, ~122 000 lignes, 94 modèles Prisma, 46 enums,
   65 migrations, 144 fichiers de test, 6 fichiers e2e, 0 `node_modules`.
3. Recoupement spec ↔ code ↔ matrice d'implémentation pour établir la liste des blocages.
4. Identification des manques de surface SEO (sitemap, robots, image OG).

**❓ Question clé restée ouverte**

La date de publication est-elle bien **le jeudi 4 février 2027** ? Le calendrier de
contenu est bâti sur cette hypothèse ; si la vraie date est le 11, le 18 ou le 25, la
phase 4 se décale sans changer sa structure.
