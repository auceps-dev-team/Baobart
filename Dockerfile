# ============================================================================
# BAOBART — image de production (Next.js standalone)
# Source : Doc/SPEC_DEPLOIEMENT_SELFHOSTING_BAOBART.md
# « build once, deploy anywhere » : la même image tourne sur n'importe quel VPS.
# ============================================================================

FROM node:22-alpine AS base
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
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
