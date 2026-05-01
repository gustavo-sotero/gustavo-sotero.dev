# Stage 1: Install dependencies (with native build tools for sharp)
FROM oven/bun:slim AS deps
WORKDIR /app

# Install libvips and build tools needed by sharp
USER root
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
  libvips-dev \
  build-essential \
  python3 \
  && rm -rf /var/lib/apt/lists/*

# Copy root workspace files
COPY package.json bun.lock ./
COPY tsconfig.base.json ./

# Copy workspace manifests
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies
RUN bun install --frozen-lockfile

# Stage 2: Runtime
FROM oven/bun:slim AS runtime
WORKDIR /app

# Install libvips runtime dependency for sharp and create non-root runtime user
USER root
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends libvips && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 appgroup \
  && adduser --system --uid 1001 --ingroup appgroup appuser

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
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source files
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

# Ensure the log directory is writable by the runtime user
RUN mkdir -p /app/apps/worker/logs && chown -R appuser:appgroup /app/apps/worker/logs

USER appuser

CMD ["bun", "run", "apps/worker/src/index.ts"]
