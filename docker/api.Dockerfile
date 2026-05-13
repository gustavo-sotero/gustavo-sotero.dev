# Stage 1: Install dependencies
FROM oven/bun:slim AS deps
WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock ./
COPY tsconfig.base.json ./

# Copy workspace manifests
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (workspace-aware)
RUN bun install --frozen-lockfile

# Stage 2: Build runtime JS
FROM deps AS build
WORKDIR /app

COPY scripts ./scripts
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN bun run --filter @portfolio/api build

# Stage 3: Runtime
FROM oven/bun:slim AS runtime
WORKDIR /app

# Install curl (required by the Docker health check) and create a non-root runtime user
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 appgroup \
  && useradd --system --uid 1001 --gid appgroup --no-create-home appuser

# Preserve the Bun workspace manifest/lockfile context used to materialize
# dependencies inside node_modules/.bun during the install stage.
COPY package.json bun.lock ./

# Copy workspace manifests required for workspace package resolution.
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/

# Copy installed node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy runtime files
COPY drizzle ./drizzle
COPY apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Ensure the log directory is writable by the runtime user
RUN mkdir -p /app/apps/api/logs && chown -R appuser:appgroup /app/apps/api/logs

USER appuser

ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["bun", "apps/api/dist/index.js"]
