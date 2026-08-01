# Baobart — Déploiement, Self-Hosting & Docker (Point M)

**Stratégie duale : hébergement managé (Vercel, Hostinger…) OU self-hosting Docker**
**Document M — v1.0 — août 2026**

> Complète le blueprint (`BLUEPRINT_NEXTJS_BAOBART.md`, stack + docker-compose dev) et le plan directeur. Objectif : **par défaut, Baobart se déploie partout** (Vercel, Hostinger, VPS quelconque) — et, pour **contrôler les coûts d'hébergement**, la même base se déploie en **self-hosting Docker** complet.

---

## 1. Stratégie : « build once, deploy anywhere »

**Principe** : l'application est **indépendante du fournisseur** (12-factor app). Le même code se déploie :
- **Managé** : Vercel (facile, scaling auto, zéro ops) — le chemin par défaut en phase de démarrage.
- **Self-hosting** : VPS (Hostinger, OVH, Hetzner, contabo…) via **Docker Compose** — contrôle total des coûts, données chez soi.

**Ce qui rend ça possible** (décisions déjà actées dans le blueprint) :

| Brique | Cloud (managé) | Self-hosting (Docker) | Portabilité |
|---|---|---|---|
| **App Next.js** | Vercel (functions + ISR) | Node `standalone` dans un conteneur | ✅ `output: "standalone"` |
| **Base de données** | Vercel Postgres / Neon / Supabase | **Postgres 16** (conteneur ou natif) | ✅ même SQL (Prisma) |
| **Cache / files** | Upstash Redis | **Redis** (conteneur) | ✅ même client |
| **Jobs async** | Inngest Cloud | **BullMQ** (sur Redis local) | ✅ abstraction `lib/jobs` |
| **Médias** | Cloudflare R2 / AWS S3 | **MinIO** (S3-compatible local) | ✅ SDK S3 identique |
| **Emails** | Resend | **SMTP** (ou Resend) | ✅ abstraction `lib/email` |
| **CDN / HTTPS** | Cloudflare (devant Vercel) | **Caddy/Traefik** (reverse proxy + Let's Encrypt) | ✅ configurable |
| **Domaine** | N'importe lequel | N'importe lequel | ✅ env vars |

> Le point décisif : **aucune dépendance propriétaire Vercel**. Next.js en `standalone` + API routes + Server Actions = Node.js standard, conteneurisable.

---

## 2. Architecture de déploiement (vue d'ensemble)

```
                    ┌──────────────────────────────────────────┐
   Internet ──►  HTTPS/CDN (Cloudflare OU Caddy/Traefik)       │
                    └──────────────────┬───────────────────────┘
                                       ▼
                    ┌──────────────────────────────────────────┐
                    │   app : Baobart Next.js (Node standalone)│
                    │   - pages SSR/ISR  - API routes          │
                    │   - Server Actions - previews            │
                    └───────┬──────────────────────┬───────────┘
                            │                      │
                            ▼                      ▼
                    ┌───────────────┐      ┌───────────────┐
                    │  worker (jobs) │      │  postgres 16  │
                    │  BullMQ/Inngest│      │  (persistance)│
                    └───────┬───────┘      └───────────────┘
                            │                      ▲
                            ▼                      │
                    ┌───────────────┐      ┌───────────────┐
                    │  redis        │      │  minio / R2   │
                    │  (cache/queue)│      │  (médias S3)  │
                    └───────────────┘      └───────────────┘
```

**2 processus** : `app` (web) et `worker` (jobs). Même image Docker, commande différente.

---

## 3. Configuration 12-factor (env vars) — LE fichier de portabilité

`.env.example` (référence — les secrets en prod via le secret manager du fournisseur) :

```bash
# --- App ---
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://baobart.africa     # domaine public
NEXT_PUBLIC_APP_NAME=Baobart

# --- Base de données ---
DATABASE_URL=postgresql://baobart:secret@postgres:5432/baobart
# Pooling (self-host : pgbouncer optionnel ; cloud : pooler Neon/Supabase)

# --- Redis (cache + queue) ---
REDIS_URL=redis://redis:6379
# Vercel : REDIS_URL=rediss://... (Upstash) — même format

# --- Médias (S3-compatible — identique partout) ---
S3_ENDPOINT=http://minio:9000            # ou https://s3.eu...amazonaws.com / R2
S3_REGION=auto
S3_BUCKET=baobart-media
S3_ACCESS_KEY=*** ; S3_SECRET_KEY=***
S3_PUBLIC_URL=https://media.baobart.africa   # CDN devant le bucket

# --- Jobs (choix auto selon env) ---
JOBS_DRIVER=bulmq                       # "inngest" (cloud) | "bulmq" (self-host)
INNGEST_SIGNING_KEY=...                 # si inngest
INNGEST_EVENT_KEY=...

# --- Emails ---
EMAIL_DRIVER=smtp                       # "resend" | "smtp"
SMTP_HOST=... ; SMTP_PORT=587 ; SMTP_USER=... ; SMTP_PASS=...
RESEND_API_KEY=...                      # si resend

# --- Auth providers (Partie 1 du point L) ---
GOOGLE_CLIENT_ID=... ; GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=... ; GITHUB_CLIENT_SECRET=...
APPLE_CLIENT_ID=... ; APPLE_CLIENT_SECRET=...
SMS_PROVIDER=africastalking ; SMS_API_KEY=...

# --- Paiements ---
FLUTTERWAVE_PUBLIC_KEY=... ; FLUTTERWAVE_SECRET_KEY=...
PAYSTACK_SECRET_KEY=... ; CINETPAY_ID=... ; CINETPAY_KEY=...
STRIPE_SECRET_KEY=...

# --- Shield (point C) ---
SHIELD_GPU_ENDPOINT=                    # worker Glaze/Nightshade (optionnel)
WATERMARK_KEY=***                       # clé AES filigrane
C2PA_CERT=...                           # certificat C2PA

# --- Sécurité / divers ---
AUTH_SECRET=*** ; ENCRYPTION_KEY=***    # chiffrement tokens (L)
SENTRY_DSN=... ; LOG_LEVEL=info
```

**Règle** : toute config passe par env vars. Aucune valeur codée en dur. C'est ce qui rend Vercel ↔ Docker interchangeables en 5 minutes.

---

## 4. Dockerfile (Next.js standalone)

```dockerfile
# ---------- build ----------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build          # génère .next/standalone (grâce à output:"standalone")

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# copier uniquement le standalone + statiques + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

- `output: "standalone"` dans `next.config.ts` → build minimal autonome (~40-80 Mo, zéro node_modules inutiles).
- **Même image pour `app` et `worker`** : le worker lance `node jobs/worker.js` (BullMQ) à la place de `server.js`.

---

## 5. docker-compose.yml — self-hosting complet

```yaml
version: "3.9"

services:
  # ----- 1) Reverse proxy + HTTPS automatique (Let's Encrypt) -----
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    depends_on: [app]

  # ----- 2) App web (Next.js standalone) -----
  app:
    build: .
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgresql://baobart:${DB_PASSWORD}@postgres:5432/baobart
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
    depends_on: [postgres, redis]
    expose: ["3000"]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  # ----- 3) Worker (jobs : payouts, compteurs, previews, résumés IA…) -----
  worker:
    build: .
    restart: unless-stopped
    env_file: .env
    command: ["node", "jobs/worker.js"]
    depends_on: [postgres, redis]

  # ----- 4) Base de données -----
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: baobart
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: baobart
    volumes:
      - pg_data:/var/lib/postgresql/data
    expose: ["5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U baobart"]
      interval: 30s

  # ----- 5) Redis (cache + file de jobs) -----
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "512mb"]
    volumes: [redis_data:/data]
    expose: ["6379"]

  # ----- 6) MinIO (stockage médias S3-compatible, si pas de S3 externe) -----
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY}
    volumes: [minio_data:/data]
    ports: ["9000:9000", "9001:9001"]   # API + console

volumes:
  pg_data:     # PERSISTANCE critique — sauvegarder
  redis_data:
  minio_data:
  caddy_data:
```

**Caddyfile** (HTTPS auto) :
```
baobart.africa, www.baobart.africa {
    reverse_proxy app:3000
}
media.baobart.africa {
    reverse_proxy minio:9000
}
```

**Démarrage** :
```bash
cp .env.example .env && vi .env          # secrets
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

---

## 6. Déploiement managé — Vercel

**Pourquoi Vercel par défaut** : zéro ops, ISR/SSR optimisés, previews par PR, scaling auto. Parfait pour démarrer vite.

**Configuration `vercel.json`** :
```json
{
  "framework": "nextjs",
  "crons": [
    { "path": "/api/cron/daily-analytics", "schedule": "0 3 * * *" },
    { "path": "/api/cron/payouts", "schedule": "0 5 * * 3" }
  ]
}
```

**Points d'attention Vercel** :
- **Pooling DB** : Vercel serverless = connexions éphémères → utiliser le **pooler** (Neon/Supabase) ou PgBouncer. `DATABASE_URL` + `DIRECT_URL` (Prisma).
- **Médias** : jamais de fichiers locaux (serverless sans disque) → **tout via S3/R2** (déjà le cas).
- **Jobs** : Vercel n'héberge pas de worker persistant → **Inngest Cloud** (il appelle vos fonctions) ou BullMQ sur Upstash + un worker externe. Notre abstraction `JOBS_DRIVER` gère.
- **Migrations** : les faire en CI (job) avant déploiement, pas à la volée.
- **Env vars** : tout dans le tableau de bord Vercel (mêmes clés que `.env`).

**Estimation coûts Vercel** : plan **Pro ~20 $/mois** + usage (bande passante, fonctions). À volume modéré, ~30-80 $/mois tout compris (hors DB/Redis/médias).

---

## 7. Déploiement self-hosting — Hostinger / VPS

**Pourquoi self-hosting** : contrôler les coûts — un **VPS KVM 2 vCPU/4 Go** chez Hostinger/OVH/Hetzner ≈ **5-15 $/mois** (vs 30-80 $ managé). Idéal dès que le trafic est stable et qu'on veut la maîtrise.

**Étapes (Hostinger VPS Ubuntu 22/24)** :
```bash
# 1) Installer Docker + compose plugin
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin

# 2) Cloner le repo + configurer
git clone https://github.com/votre-org/baobart.git && cd baobart
cp .env.example .env && vi .env

# 3) Lancer la stack
docker compose up -d --build
docker compose exec app npx prisma migrate deploy

# 4) Vérifier
curl -I https://baobart.africa   # HTTPS auto via Caddy (Let's Encrypt)
```

**Spécifications VPS recommandées** (selon volume) :

| Volume | VPS | RAM | Disque | Coût/mois (approx.) |
|---|---|---|---|---|
| Démarrage (< 1 k MAU) | 2 vCPU | 2 Go | 40 Go SSD | ~5-6 $ |
| Croissance (< 20 k MAU) | 2 vCPU | 4 Go | 80 Go SSD | ~8-12 $ |
| Établi (< 100 k MAU) | 4 vCPU | 8 Go | 160 Go SSD | ~20-30 $ |
| (scaling horizontal : ajouter des workers/apps derrière le même proxy) | | | | |

**Mises à jour (zéro downtime)** :
```bash
git pull
docker compose build app worker
docker compose up -d --no-deps app worker   # re-création sans toucher la DB
```

**Opérations courantes** :
- Logs : `docker compose logs -f app`
- DB : `docker compose exec postgres psql -U baobart`
- Migrations : dans CI (avant déploiement) ou manuelles
- Redémarrage auto des conteneurs (`restart: unless-stopped`) + `systemctl` (un système de `init`/watchtower pour les mises à jour auto — optionnel)

---

## 8. Jobs asynchrones — choix (la seule vraie divergence cloud/self-host)

| | **Inngest Cloud** | **BullMQ (self-host)** |
|---|---|---|
| Convient à | Vercel (serverless) | VPS/Docker (worker persistant) |
| Redis | Géré par Inngest | Le vôtre (déjà dans la stack) |
| Coût | Free tier puis usage | Gratuit (Redis déjà là) |
| Robustesse | Très bon | Très bon (mature) |

**Notre abstraction `lib/jobs.ts`** : toutes les tâches (payouts, compteurs, previews, résumés IA, emails) sont déclarées une seule fois, le driver (`inngest` ou `bulmq`) est choisi par `JOBS_DRIVER`.

```ts
// lib/jobs.ts
import { defineJob } from "@/lib/jobs"

export const generatePreviews = defineJob("generate-previews", async (mediaId) => { ... })
```

→ Le **même code tourne** sur Vercel+Inngest ou Docker+BullMQ. Pas de réécriture.

---

## 9. Médias & CDN

| Config | Managé | Self-host |
|---|---|---|
| Stockage | Cloudflare R2 / AWS S3 | **MinIO** (S3-compatible) ou S3 externe |
| CDN | Cloudflare (devant) | Caddy/Cloudflare (devant le domaine média) |
| Upload direct | Presign S3 (pattern §3.7-G) | **identique** (MinIO supporte les presigned URLs) |

**Astuce coût** : Cloudflare R2 = **zéro frais de sortie** (egress gratuit) — le meilleur rapport coût/perf pour les médias, en managé comme en self-host (R2 se branche comme un simple S3).

---

## 10. Emails

| Config | Managé | Self-host |
|---|---|---|
| Driver | **Resend** (ou SES) | **SMTP** (ou Resend) |
| Délivrabilité | Excellente (réputation cloud) | Dépend du VPS (réputation IP) — **recommander un SMTP transactionnel** même en self-host (coût modique) |
| Pattern | `lib/email.ts` (un point d'entrée) | idem |

**Recommandation** : même en self-hosting, utiliser un service SMTP transactionnel (Resend/SES/Postmark ~5-20 $/mois) plutôt que d'envoyer depuis l'IP du VPS — la délivrabilité des reçus/notifications est trop critique (et notre §3.7-D gère bounces/suppressions).

---

## 11. Sécurité du self-hosting (non négociable)

| Mesure | Détail |
|---|---|
| **Firewall** | `ufw` : n'ouvrir que 80/443/22 + ports internes jamais exposés (Caddy expose, app/MinIO restent en `expose` interne) |
| **Secrets** | `.env` jamais commité ; rotations ; permissions `600` |
| **HTTPS** | Caddy Let's Encrypt automatique (renouvellement auto) |
| **Sauvegardes** | DB (`pg_dump`) + médias (MinIO) : **quotidien, off-site** (3-2-1 : 3 copies, 2 supports, 1 hors-site) — S3 externe ou VPS de secours |
| **Mises à jour** | `docker compose pull` régulier, patches sécurité OS (`unattended-upgrades`), watchtower (optionnel, prudent) |
| **Monitoring** | Uptime Kuma / Sentry (app) + alertes disque/RAM (netdata, cockpit) |
| **Accès** | SSH par clé (pas de mot de passe), pas de root direct |
| **Limites** | Rate-limiting (Caddy), bloqueur de spam sur les endpoints publics (reCAPTCHA §3.7-D) |
| **2FA** | Déjà dans l'app (TOTP + passkeys) — ne jamais désactiver côté admin |

---

## 12. Sauvegardes & reprise (DR)

```bash
# Sauvegarde quotidienne (cron) — DB + médias
docker compose exec -T postgres pg_dump -U baobart baobart | gzip > /backup/db_$(date +%F).sql.gz
rclone sync minio:baobart-media s3-backup:baobart-media   # médias → off-site

# Restauration
docker compose exec -T postgres gunzip < db_2026-08-01.sql.gz | psql -U baobart
```

- **RPO** : ≤ 24 h (sauvegarde quotidienne) — passer à continu (WAL archiving) si besoin.
- **RTO** : < 1 h (restauration automatique possible en script).
- **Test de restauration** : 1×/trimestre (obligatoire, sinon la sauvegarde n'existe pas).

---

## 13. Comparatif de coûts (estimation mensuelle)

| Poste | Vercel (managé) | VPS Hostinger (self-host) |
|---|---|---|
| Hébergement app | Pro 20 $ + usage (~30-60 $) | VPS 2-4 vCPU : **5-12 $** |
| Base de données | Neon/Supabase (~10-25 $) | Inclus (Postgres du VPS) |
| Redis | Upstash (~5-10 $) | Inclus (Redis du VPS) |
| Jobs | Inngest (free → usage) | Inclus (BullMQ) |
| Médias (R2) | 0-5 $ (egress gratuit) | 0-5 $ (R2) ou MinIO local |
| Emails transactionnels | ~5-20 $ | ~5-20 $ (SMTP transactionnel) |
| **Total mensuel** | **~50-100 $** | **~10-35 $** |

> **Verdict** : pour la **phase de démarrage**, Vercel (rapidité, zéro ops) est le bon choix. Dès que le trafic est stable, **migrer vers un VPS ≈ 3-5× moins cher** — et la migration est **un simple changement d'env vars** (même code, même compose). Le plan type : *Vercel → VPS à ~3-6 mois, quand la charge se stabilise.*

---

## 14. Chemin de scaling (self-host)

| Seuil | Action |
|---|---|
| 1 VPS (mono) | La stack complète sur un VPS (compose) |
| Plus de charge | **Séparer** : Postgres + MinIO sur volumes dédiés ; ajouter `app` réplicas (Caddy load-balance) |
| 100 k+ MAU | Managed DB (Neon/Supabase) ou réplicas Postgres ; Redis managé ; médias sur R2 ; workers dédiés |
| Grand volume | Migration vers K8s (optionnel — le compose est un excellent point de départ K8s via kompose) |

**Le chemin managé** suit la même logique (Vercel scale automatiquement, on ne fait que monter les limites).

---

## 15. Checklist de conformité « deploy anywhere »

- [ ] `output: "standalone"` dans next.config
- [ ] Aucune variable codée en dur (tout via `.env`)
- [ ] Médias 100 % S3-compatible (jamais de fichiers locaux) — MinIO/R2/S3 interchangeables
- [ ] `lib/jobs.ts` (driver inngest/bullmq) — aucune tâche couplée au cloud
- [ ] `lib/email.ts` (driver resend/smtp)
- [ ] Migrations Prisma en CI (jamais à la volée en prod)
- [ ] Healthcheck `/api/health` (DB + Redis + S3 vérifiés)
- [ ] Sauvegardes automatisées + test de restauration trimestriel
- [ ] Firewall + secrets + HTTPS par défaut
- [ ] Monitoring (Sentry + uptime) dès le premier déploiement

---

## 16. Impact sur le plan

| Élément | Phase | Contenu |
|---|---|---|
| `docker-compose.yml` **production** (app + worker + postgres + redis + minio + caddy) | **M0** (avec le dev compose) | Le fichier du §5 est prêt |
| Dockerfile standalone | M0 | §4 |
| `.env.example` complet (toutes les briques) | M0 | §3 |
| Déploiement **Vercel** (vercel.json, pooling, Inngest) | M1 (au premier déploiement) | §6 |
| Job worker + abstraction `lib/jobs.ts` | M1 | §8 |
| CI/CD (GitHub Actions : test → build → migrate → deploy) | M1 | — |
| **Migration VPS self-host** (guide + scripts) | **M3** (quand le trafic se stabilise) | §7 |
| Sauvegardes + DR + monitoring | M1 → continu | §11-12 |

> **La décision clé** : construire **dès M0** en « deploy anywhere » (standalone + env vars + abstraction jobs/email) coûte presque rien et évite toute dépendance. Le `docker-compose.yml` de production est livré avec ce document — il n'y a plus qu'à le brancher.
