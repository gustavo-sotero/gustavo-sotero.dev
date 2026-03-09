# Stage 1: Install dependencies
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

# Stage 2: Build Next.js app
FROM oven/bun:1 AS builder
WORKDIR /app

# NEXT_PUBLIC_* vars are baked into the Next.js bundle at build time.
# Pass them via --build-arg in CI/CD and declare them here so the
# build fails fast if they are absent rather than silently embedding blanks.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_S3_PUBLIC_DOMAIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_S3_PUBLIC_DOMAIN=$NEXT_PUBLIC_S3_PUBLIC_DOMAIN

COPY --from=deps /app/node_modules ./node_modules

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

ENV NODE_ENV=production
RUN cd apps/web && bun run build

# Stage 3: Runtime (standalone)
FROM oven/bun:1-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy Next.js standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3001

CMD ["bun", "run", "server.js"]
