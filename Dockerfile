# Dockerfile para aplicação Next.js com otimizações para Dokploy
# Usa imagem Alpine Linux para reduzir o tamanho da imagem

# Stage 1: Dependências
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copia os arquivos de dependências
COPY package.json package-lock.json* ./
# Instala todas as dependências (incluindo devDependencies para o build)
RUN npm ci

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Desabilita telemetria do Next.js
ENV NEXT_TELEMETRY_DISABLED 1

# Executa o build da aplicação
RUN npm run build

# Stage 3: Runner (imagem final)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Cria usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia package.json para instalar apenas dependências de produção
COPY package.json package-lock.json* ./

# Instala apenas dependências de produção
RUN npm ci --omit=dev && npm cache clean --force

# Copia os arquivos necessários do builder
COPY --from=builder /app/public ./public

# Configura as permissões corretas para o diretório .next
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copia os arquivos de build com as permissões corretas
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Muda para o usuário não-root
USER nextjs

# Expõe a porta 3000
EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Comando para iniciar a aplicação
CMD ["node", "server.js"]
