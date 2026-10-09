# ============================================================================
# BAOBART — image de production (Next.js standalone)
# Source : Doc/SPEC_DEPLOIEMENT_SELFHOSTING_BAOBART.md
# « build once, deploy anywhere » : la même image tourne sur n'importe quel VPS.
# ============================================================================

FROM node:25-alpine AS base
RUN corepack enable
WORKDIR /app

# --- Dépendances ------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# --- Build ------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Lus AU BUILD par next.config.ts : les hôtes d'images et l'origine du stockage
# dans la CSP sont figés dans le manifeste des routes, pas relus au démarrage.
# Ils arrivaient jusqu'ici par le `.env` de l'hôte, embarqué sans le vouloir
# par `COPY . .` ; `.dockerignore` l'exclut désormais. Ce ne sont pas des
# secrets — des adresses publiques — d'où des arguments de build :
#   docker build --build-arg S3_PUBLIC_URL=https://cdn.exemple.com .
ARG S3_PUBLIC_URL
ARG S3_ENDPOINT
RUN pnpm prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
# Active la sortie standalone (cf. next.config.ts) — Linux gère les symlinks.
ENV BUILD_STANDALONE=1
RUN pnpm build

# --- Runtime ----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
# La police du filigrane des aperçus (lib/upload/filigrane.ts). Lue à
# l'exécution, elle n'est pas tracée par la sortie standalone ; et Alpine n'a
# aucune police système : sans cette ligne, le filigrane sortirait en carrés.
COPY --from=builder /app/assets ./assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# La sonde interroge /api/health, qui va chercher la base et répond 503 quand
# elle manque — là où la page d'accueil répondrait 200 avec une coquille vide.
# `node` plutôt que `wget` ou `curl` : c'est le seul binaire dont on soit sûr
# qu'il est dans l'image, quelle que soit la base Alpine du jour.
# Le délai de démarrage couvre la première connexion Prisma.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
