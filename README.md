# Gustavo Sotero - Portfolio Pessoal

Este é um projeto [Next.js](https://nextjs.org) criado com [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 🚀 Começando

### Pré-requisitos

- Node.js 18+
- npm/yarn/pnpm/bun
- Docker (opcional)

### Configuração

1. **Clone o repositório:**

   ```bash
   git clone <url-do-repositorio>
   cd gustavo-sotero.dev
   ```

2. **Configure as variáveis de ambiente:**

   ```bash
   cp .env.example .env
   ```

   Edite o arquivo `.env` com suas credenciais. Consulte [ENVIRONMENT.md](./ENVIRONMENT.md) para instruções detalhadas.

3. **Instale as dependências:**
   ```bash
   npm install
   # ou
   yarn install
   # ou
   pnpm install
   # ou
   bun install
   ```

### Desenvolvimento

Execute o servidor de desenvolvimento:

```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
# ou
bun dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para ver o resultado.

Você pode começar a editar a página modificando `app/page.tsx`. A página se atualiza automaticamente conforme você edita o arquivo.

## 🐳 Docker

### Usando Docker Compose (Recomendado)

```bash
# Configure o arquivo .env primeiro
cp .env.example .env

# Execute com docker-compose
docker-compose up --build
```

### Build Manual

**Windows:**

```cmd
build-docker.bat
```

**Linux/macOS:**

```bash
chmod +x build-docker.sh
./build-docker.sh
```

### Executar Container

```bash
docker run -p 3000:3000 \
  -e TELEGRAM_BOT_TOKEN="seu_token" \
  -e TELEGRAM_CHAT_ID="seu_chat_id" \
  gustavo-sotero-dev:latest
```

## 📋 Funcionalidades

- ✨ Portfolio pessoal responsivo
- 📱 Suporte completo para mobile
- 🌙 Modo escuro/claro
- 🌐 Suporte a múltiplos idiomas (PT/EN)
- 📝 Blog integrado com Markdown
- 📨 Formulário de contato via Telegram
- 🚀 Otimizado para produção
- 🐳 Pronto para Docker/Dokploy

## 🛠️ Tecnologias

- **Framework:** Next.js 15 (App Router)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Ícones:** Lucide React
- **Deployment:** Docker + Dokploy

## 📦 Deploy

### Dokploy

1. Configure as variáveis de ambiente no painel do Dokploy
2. Faça o deploy usando o Dockerfile
3. Consulte [DEPLOY-DOKPLOY.md](./DEPLOY-DOKPLOY.md) para instruções detalhadas

### Vercel

A maneira mais fácil de fazer deploy da sua aplicação Next.js é usar a [Plataforma Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) dos criadores do Next.js.

## 📖 Documentação

- [Configuração de Variáveis de Ambiente](./ENVIRONMENT.md)
- [Deploy no Dokploy](./DEPLOY-DOKPLOY.md)
- [Next.js Documentation](https://nextjs.org/docs)

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

## 📄 Licença

Este projeto está sob a licença MIT.
