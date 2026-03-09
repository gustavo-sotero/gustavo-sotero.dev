# Stage 1: Install dependencies
FROM oven/bun:1 AS deps
WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock ./
COPY tsconfig.base.json ./

# Copy workspace manifests
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (workspace-aware)
RUN bun install --frozen-lockfile

# Stage 2: Runtime
FROM oven/bun:1-slim AS runtime
WORKDIR /app

# Copy installed node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy source files (TS run directly — no bundle)
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

EXPOSE 3000

CMD ["bun", "run", "apps/api/src/index.ts"]
