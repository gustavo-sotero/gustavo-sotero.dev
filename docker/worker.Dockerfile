# Stage 1: Install dependencies (with native build tools for sharp)
FROM oven/bun:1 AS deps
WORKDIR /app

# Install libvips and build tools needed by sharp
USER root
RUN apt-get update && apt-get install -y \
  libvips-dev \
  build-essential \
  python3 \
  && rm -rf /var/lib/apt/lists/*

# Copy root workspace files
COPY package.json bun.lock ./
COPY tsconfig.base.json ./

# Copy workspace manifests
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies
RUN bun install --frozen-lockfile

# Stage 2: Runtime
FROM oven/bun:1 AS runtime
WORKDIR /app

# Install libvips runtime dependency for sharp
USER root
RUN apt-get update && apt-get install -y libvips && rm -rf /var/lib/apt/lists/*

# Copy installed node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
# Worker also needs access to api db schema
COPY apps/api/src/db ./apps/api/src/db
COPY apps/api/package.json ./apps/api/
COPY apps/worker ./apps/worker

CMD ["bun", "run", "apps/worker/src/index.ts"]
