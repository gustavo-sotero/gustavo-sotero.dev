#!/bin/bash

# Script para build da imagem Docker para Dokploy
# Execute: chmod +x build-docker.sh && ./build-docker.sh

echo "🚀 Iniciando build da imagem Docker para Dokploy..."

# Nome da imagem
IMAGE_NAME="gustavo-sotero-dev"
TAG="latest"

echo "📦 Construindo imagem: $IMAGE_NAME:$TAG"

# Verifica se o arquivo .env existe
if [ ! -f .env ]; then
    echo "⚠️  Arquivo .env não encontrado!"
    echo "📝 Copiando .env.example para .env..."
    cp .env.example .env
    echo "⚠️  Configure o arquivo .env com suas variáveis antes de continuar!"
    echo "📖 Consulte ENVIRONMENT.md para instruções detalhadas"
    read -p "Pressione Enter para continuar..."
fi

# Carrega variáveis de ambiente do arquivo .env
echo "🔧 Carregando variáveis de ambiente..."
export $(cat .env | grep -v '^#' | xargs)

# Build da imagem com build args
docker build \
  --build-arg TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
  --build-arg TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID" \
  -t $IMAGE_NAME:$TAG .

if [ $? -eq 0 ]; then
    echo "✅ Build concluído com sucesso!"
    echo "🔍 Informações da imagem:"
    docker images | grep $IMAGE_NAME
    
    echo ""
    echo "🚀 Para testar localmente, execute:"
    echo "docker run -p 3000:3000 \\"
    echo "  -e TELEGRAM_BOT_TOKEN=\"$TELEGRAM_BOT_TOKEN\" \\"
    echo "  -e TELEGRAM_CHAT_ID=\"$TELEGRAM_CHAT_ID\" \\"
    echo "  $IMAGE_NAME:$TAG"
    echo ""
    echo "📋 Para fazer deploy no Dokploy:"
    echo "1. Faça push da imagem para um registry (Docker Hub, GitHub Container Registry, etc.)"
    echo "2. Configure o projeto no Dokploy usando esta imagem"
    echo "3. Configure as variáveis de ambiente necessárias (veja ENVIRONMENT.md)"
    echo ""
    echo "🔧 Ou use docker-compose para desenvolvimento:"
    echo "docker-compose up --build"
else
    echo "❌ Erro durante o build da imagem"
    exit 1
fi
