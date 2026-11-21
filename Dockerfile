# syntax=docker/dockerfile:1.7
# AnimalDex Next.js 13.4 standalone image (linux/amd64).
# Build off-VM (GitHub Actions). Runtime secrets are injected on the host — never baked in.
#
# Node/npm must match local lockfile generation:
#   Node 22.13.0 + npm 10.9.2 (lockfileVersion 3)
# Buildx supplies linux/amd64 via `platforms:` — do not hardcode FROM --platform.

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
RUN rm -rf node_modules/sharp node_modules/@img \
  && npm install --no-save --include=optional --os=linux --cpu=x64 sharp \
  && node -e "const sharp=require('sharp'); console.log(sharp.versions)"
# -----------------------------------------------------------------------------
# Builder
# -----------------------------------------------------------------------------
# builder-base holds only the toolchain and node_modules (no build args, no sources), so
# CI exports it to its layer cache on its own (target: builder-base) and an app-code change
# never rebuilds or re-copies node_modules.
FROM node:${NODE_VERSION}-bookworm-slim AS builder-base
ARG NPM_VERSION
WORKDIR /app

RUN npm install -g "npm@${NPM_VERSION}"

COPY --from=deps /app/node_modules ./node_modules

FROM builder-base AS builder

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
# "on" offers the voice call with the animal to signed-in readers (call-gate.ts).
ARG NEXT_PUBLIC_ANIMAL_CALLS=
ARG GOOGLE_ANALYTICS_ID=
# App Store Connect campaign provider token (pt=); store links omit it when empty.
ARG NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN=

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
    NEXT_PUBLIC_ANIMAL_CALLS=$NEXT_PUBLIC_ANIMAL_CALLS \
    GOOGLE_ANALYTICS_ID=$GOOGLE_ANALYTICS_ID \
    NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN=$NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN

COPY package.json package-lock.json .npmrc next.config.js tsconfig.json \
     postcss.config.js tailwind.config.js globals.d.ts ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts

# .next/cache is a BuildKit cache mount (never in a layer) that CI carries between runs
# (buildkit-cache-dance). Only the type-check (.tsbuildinfo) and ESLint caches are kept: they
# cut "Linting and checking validity of types" from ~80 s to ~12 s and cannot change what the
# build emits. webpack, fetch-cache and images are dropped before and after every build, so
# compiled output and build-time data always come from a cold build (and the carried cache
# stays small: moving the 240 MB webpack cache cost more time than it saved).
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache,sharing=locked \
  rm -rf .next/cache/webpack .next/cache/fetch-cache .next/cache/images \
  && NEXT_STATIC_WORKERS="$(nproc)" npm run build \
  && rm -rf .next/cache/webpack .next/cache/fetch-cache .next/cache/images \
  && rm -f .next/standalone/.env .next/standalone/.env.* \
  && find .next/standalone -name '.env*' -type f -delete

# -----------------------------------------------------------------------------
# Runner (minimal standalone)
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime-base
WORKDIR /app

# HOSTNAME=0.0.0.0: Next 13.5's standalone server is a single process that listens
# on HOSTNAME, so it must bind every interface for Docker's port mapping to reach
# it. (HOSTNAME=localhost was the Next 13.4 workaround for its worker proxy; on
# 13.5 it binds 127.0.0.1 inside the container and every request is reset.)
# Verified with the CI smoke paths, including the 308 Location headers.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NODE_OPTIONS=--dns-result-order=ipv4first

# ffmpeg: /admin/story-videos re-encodes low-frame-rate story videos to 30 fps
# before sharing (TikTok and Reels reject anything under ~24 fps).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/* \
  && ffmpeg -hide_banner -version | head -1 \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# runtime-base (above) is cached on its own in CI (target: runtime-base).
FROM runtime-base AS runner

# Standalone server + traced deps
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Next standalone tracing can omit Sharp native runtime packages.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

# Fail the image build if Sharp cannot load in the final runtime stage.
RUN node -e "const sharp=require('sharp'); console.log('runtime sharp', sharp.versions.sharp, 'vips', sharp.versions.vips)"
# Static assets and public files required beside standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Belt-and-suspenders: never ship dotenv files into the final image
RUN rm -f .env .env.local .env.production .env.development \
  && find /app -name '.env*' -type f -delete \
  && find /app \! \( -user nextjs -group nodejs \) -exec chown -h nextjs:nodejs {} +
# (Same result as chown -R nextjs:nodejs /app, but it only touches the few paths COPY --chown
# left root-owned; chown -R copied every file up through overlayfs and took ~30 s.)

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
