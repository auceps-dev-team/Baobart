# Baobart — Dossier marketing

> Trois documents, trois casquettes, produits le **5 octobre 2026** en vue de la
> **publication du jeudi 4 février 2027**.

| # | Document | Casquette | Ce qu'on y trouve |
|---|---|---|---|
| 1 | [`01-AUDIT-TECHNIQUE-PRODUIT.md`](01-AUDIT-TECHNIQUE-PRODUIT.md) | 🧑‍💻 **Développeur** | L'état réel du dépôt : architecture, ce qui est construit et éprouvé, ce qui bloque une ouverture publique, la dette assumée, les actifs marketing déjà disponibles |
| 2 | [`02-BILAN-MARKETING.md`](02-BILAN-MARKETING.md) | 🎩 **Chef marketing d'agence** | Marché ouest-africain chiffré, concurrence, positionnement, **SWOT**, **4 personas**, les 5 avantages concurrentiels, objectifs/KPI, stratégie et budget de lancement |
| 3 | [`03-CALENDRIER-CONTENU-4-MOIS.md`](03-CALENDRIER-CONTENU-4-MOIS.md) | 📱 **Expert marketing digital** | Le calendrier de contenu : 4 phases, 18 semaines, **alternance image / vidéo**, règles du teasing, brief créatif, plan par plateforme, tableau de bord KPI |
| — | [`calendrier-contenu.csv`](calendrier-contenu.csv) | 📊 **Outil** | Le calendrier en 18 lignes × 16 colonnes, à importer dans un tableur ou un outil de planification |
| — | [`CREAS/`](CREAS/) | 🎨 **Production** | Les posts, un par un, prêts à produire. Le premier est complet, maquette incluse : [`2026-10-05-post-01.md`](CREAS/2026-10-05-post-01.md) + [`2026-10-05-post-01-affiche.png`](CREAS/2026-10-05-post-01-affiche.png) |
| 📐 | [`../DESIGN_SYSTEM_BAOBART.md`](../DESIGN_SYSTEM_BAOBART.md) | **Design system canonique** | Logo, couleurs, typographie, contours, ombres, composants, règles d'usage. **En cas de contradiction avec tout autre document, c'est celui-ci qui gagne** |
| 🛠️ | [`CREAS/composer-logo.py`](CREAS/composer-logo.py) | **Outil** | Pose le logo officiel (rendu depuis `Baobart Design/img/baobab-ink.svg`) sur n'importe quelle affiche, et normalise en 1080 × 1350. **À passer avant chaque publication.** |

---

## Les 5 règles de la campagne (décidées le 05/10/2026)

| # | Règle |
|---|---|
| **R1** | **On ne publie pas Baobart avant le 4 février 2027.** Aucun accès public, aucun lien vers la plateforme, aucune annonce d'ouverture. |
| **R2** | **Les publications alternent image et vidéo.** Image (affiche, flyer) → vidéo (démo d'une fonctionnalité) → image. Jamais deux fois de suite le même format. |
| **R3** | **Les vidéos sont des démos de fonctionnalités** : écran filmé, 15-45 s, sous-titrées. |
| **R4** | **En novembre 2026, ouverture aux clients fermés** (agences de com, écoles de design, créateurs sélectionnés). Leurs retours deviennent du contenu de campagne. |
| **R5** | **La date de publication est le jeudi 4 février 2027.** |

---

## Comment lire ce dossier

**Si tu as 5 minutes** → la synthèse exécutive du document 2 (§1) et la vue d'ensemble
des 18 semaines du document 3 (§6).

**Si tu dois décider** → les 10 décisions du document 2 (§10) et les 5 actions de la
semaine 1 du document 3 (§11).

**Si tu dois produire des créas** → le brief créatif du document 3 (§7) et le premier post
déjà écrit dans [`CREAS/`](CREAS/).

## Les conventions d'écriture

| Marque | Sens |
|---|---|
| 🔍 **Mesuré** | comptage ou constat fait dans le dépôt le 05/10/2026 |
| 📖 **Lu** | affirmation trouvée dans un document du dépôt ou dans le code, non rejouée |
| 🌐 **Externe** | chiffre de marché, avec source datée |
| 💡 **Hypothèse** | cible ou estimation, à valider par un test ou une décision |

Ces conventions viennent de `CLAUDE.md` : *distinguer ce qui est mesuré de ce qui est lu*.

## Les deux avertissements à connaître avant de publier quoi que ce soit

1. **Aucun test n'a été exécuté** lors de l'audit (`node_modules/` absent) : l'état du
   code est décrit tel qu'écrit, pas tel qu'exécuté le 05/10/2026.
2. **Les personas sont construits, pas interviewés.** Les chiffres de marché sont publics
   et datés — à revérifier avant toute communication externe.
3. **Le design system officiel a été reçu le 5 octobre 2026** sous forme de planches
   images et transcrit dans `Doc/DESIGN_SYSTEM_BAOBART.md`. Les créas produites avant
   cette date (dont l'affiche du post n°1, version 1) ont été régénérées pour y être
   conformes.
