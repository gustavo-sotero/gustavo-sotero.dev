# Stage 1: Build Next.js app
FROM oven/bun:1 AS builder
WORKDIR /app

# NEXT_PUBLIC_* vars are baked into the Next.js bundle at build time.
# Pass them via --build-arg in CI/CD and declare them here so the
# build fails fast if they are absent rather than silently embedding blanks.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_S3_PUBLIC_DOMAIN
ARG REVALIDATE_SECRET
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_S3_PUBLIC_DOMAIN=$NEXT_PUBLIC_S3_PUBLIC_DOMAIN
ENV REVALIDATE_SECRET=$REVALIDATE_SECRET

COPY package.json bun.lock ./
COPY tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY scripts ./scripts/

RUN bun install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Keep the public directory materialized in the image even when the repo
# has no checked-in public assets yet.
RUN mkdir -p /app/apps/web/public

ENV NODE_ENV=production
RUN cd apps/web && bun run build

# Stage 2: Runtime (standalone)
FROM oven/bun:slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Create a non-root runtime user
RUN addgroup --system --gid 1001 appgroup \
  && adduser --system --uid 1001 --ingroup appgroup appuser

# Copy Next.js standalone output
COPY --from=builder --chown=appuser:appgroup /app/apps/web/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=appuser:appgroup /app/apps/web/public ./apps/web/public

# Next standalone output nests the executable server under apps/web.
WORKDIR /app/apps/web

USER appuser

EXPOSE 3001

CMD ["bun", "run", "server.js"]
