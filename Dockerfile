# AnimalDex Next.js 13.4 standalone image (linux/amd64).
# Build off-VM (GitHub Actions). Runtime secrets are injected on the host — never baked in.
#
# Node/npm must match local lockfile generation:
#   Node 22.13.0 + npm 10.9.2 (lockfileVersion 3)
# Buildx supplies linux/amd64 via `platforms:` — do not hardcode FROM --platform.

# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.13.0
ARG NPM_VERSION=10.9.2

# -----------------------------------------------------------------------------
# Dependencies
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
ARG NPM_VERSION
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g "npm@${NPM_VERSION}" \
  && node -v && npm -v

COPY package.json package-lock.json .npmrc ./
# postinstall strips nested @types from solar-icon-set
RUN npm ci

# -----------------------------------------------------------------------------
# Builder
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS builder
ARG NPM_VERSION
WORKDIR /app

RUN npm install -g "npm@${NPM_VERSION}"

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    ADEX_SEO_SSG_NO_REMOTE=1 \
    NODE_OPTIONS=--max-old-space-size=6144

# Public / non-secret values inlined into the client bundle at build time.
# Pass via --build-arg / GitHub Actions variables+secrets. Never server secrets.
ARG CANONICAL_URL=https://animaldex.app
ARG NEXT_PUBLIC_SITE_URL=https://animaldex.app
ARG SITE_URL=https://animaldex.app
ARG NEXT_PUBLIC_APP_URL=https://animaldex.app
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
ARG NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=
ARG NEXT_PUBLIC_INSTAGRAM_WEB_IMPORT_LIVE=
ARG GOOGLE_ANALYTICS_ID=

ENV CANONICAL_URL=$CANONICAL_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    SITE_URL=$SITE_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID \
    NEXT_PUBLIC_INSTAGRAM_WEB_IMPORT_LIVE=$NEXT_PUBLIC_INSTAGRAM_WEB_IMPORT_LIVE \
    GOOGLE_ANALYTICS_ID=$GOOGLE_ANALYTICS_ID

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json .npmrc next.config.js tsconfig.json \
     postcss.config.js tailwind.config.js globals.d.ts ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts

RUN npm run build \
  && rm -f .next/standalone/.env .next/standalone/.env.* \
  && find .next/standalone -name '.env*' -type f -delete

# -----------------------------------------------------------------------------
# Runner (minimal standalone)
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=localhost

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone server + traced deps
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets and public files required beside standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Belt-and-suspenders: never ship dotenv files into the final image
RUN rm -f .env .env.local .env.production .env.development \
  && find /app -name '.env*' -type f -delete \
  && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
