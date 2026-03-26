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

# Stage 2: Runtime
FROM oven/bun:slim AS runtime
WORKDIR /app

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
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source files (TS run directly — no bundle)
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

EXPOSE 3000

CMD ["bun", "run", "apps/api/src/index.ts"]
