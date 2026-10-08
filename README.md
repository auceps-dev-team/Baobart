# Baobart — socle technique

> Le studio partagé de l'Afrique créative.
> **Documentation produit complète : [`Doc/`](Doc/)** — commencer par [`Doc/PLAN_REFONTE_BAOBART_GUMROAD.md`](Doc/PLAN_REFONTE_BAOBART_GUMROAD.md).

Ce fichier ne couvre que le **démarrage du code**. Le « pourquoi » (concept,
modèle économique, roadmap M0→M8) vit dans `Doc/`.

---

## Démarrer

```bash
pnpm install
cp .env.example .env      # puis remplir AUTH_SECRET et les clés de passerelles
docker compose up -d      # postgres + redis + minio
pnpm db:migrate           # applique le schéma
pnpm db:seed              # plans, licences, badges
pnpm db:test:setup        # base de test isolée (pour pnpm test)
pnpm dev                  # http://localhost:3100
```

Les tests d'intégration tournent sur **`baobart_test`**, jamais sur la base de
développement : le grand livre est immuable, une écriture comptable de test y
resterait pour toujours.

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | cycle Next.js |
| `pnpm typecheck` | TypeScript strict, sans émission |
| `pnpm lint` | ESLint (config Next) |
| `pnpm test` | Vitest — décideurs purs **et** câblage réel |
| `pnpm test:unite` | Décideurs purs seuls : ni base, ni réseau |
| `pnpm db:test:setup` | (Re)crée la base de test et y applique les migrations |
| `pnpm db:migrate` / `db:deploy` / `db:studio` / `db:seed` | Prisma |
| `pnpm stack:up` / `stack:down` | Postgres + Redis + MinIO |

## Structure

```
app/          pages App Router (+ globals.css : les tokens du Sticker System)
components/   composants d'interface
lib/
  cn.ts       concaténation de classes
  db.ts       client Prisma singleton + log des requêtes lentes
  i18n/       formatage monétaire fr-FR (FCFA entiers)
prisma/       schema.prisma + seed.ts
Doc/          spécifications produit
Baobart Design/  maquettes .dc.html de référence (non buildées)
```

## Quatre règles à ne pas casser

1. **L'argent est un entier.** Tout montant est stocké dans l'unité mineure ISO 4217.
   Le XOF n'ayant pas de décimale, « FCFA entiers » et « unité mineure » sont la
   même chose. Aucun flottant ne circule. → `lib/i18n/money.ts`
2. **Pagination par curseur, jamais d'OFFSET** sur les tables du feed, et
   compteurs dénormalisés mis à jour par jobs asynchrones. → `PLAN §8.2`
3. **Le Sticker System est un système, pas une palette** : tout est contouré,
   les ombres sont dures à 45°, deux accents maximum par écran, le jaune n'est
   jamais du texte et le texte orange est toujours `#B34A1F`.
   → `Doc/ANALYSE_DESIGN_SYSTEM_BAOBART.md`
4. **Le grand livre est immuable et les soldes se figent.** `BalanceTransaction`
   n'accepte ni `UPDATE` ni `DELETE` — une erreur se corrige par une écriture
   inverse. Un `Balance` qui a quitté l'état `UNPAID` a ses montants gelés.
   Ces deux règles sont tenues par des triggers Postgres, pas par du code
   applicatif. → `prisma/tests/garde-fous-argent.sql`

## Déploiement

Le même code tourne sur Vercel et sur un VPS (12-factor). L'image Docker utilise
la sortie `standalone` de Next.js, activée par `BUILD_STANDALONE=1` — elle reste
désactivée en local parce que Windows refuse les symlinks hors mode développeur.
Détails : [`Doc/SPEC_DEPLOIEMENT_SELFHOSTING_BAOBART.md`](Doc/SPEC_DEPLOIEMENT_SELFHOSTING_BAOBART.md).

## Mentions

Le dépôt [`antiwork/gumroad`](https://github.com/antiwork/gumroad) (**MIT**) sert
de **spécification** de la logique commerce : sa logique est traduite en
TypeScript, son code n'est pas copié et sa marque n'est jamais réutilisée.
