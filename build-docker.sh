#!/bin/bash

# Script para build da imagem Docker para Dokploy
# Execute: chmod +x build-docker.sh && ./build-docker.sh

echo "🚀 Iniciando build da imagem Docker para Dokploy..."

# Nome da imagem
IMAGE_NAME="gustavo-sotero-dev"
TAG="latest"

echo "📦 Construindo imagem: $IMAGE_NAME:$TAG"

# Build da imagem
docker build -t $IMAGE_NAME:$TAG .

if [ $? -eq 0 ]; then
    echo "✅ Build concluído com sucesso!"
    echo "🔍 Informações da imagem:"
    docker images | grep $IMAGE_NAME
    
    echo ""
    echo "🚀 Para testar localmente, execute:"
    echo "docker run -p 3000:3000 $IMAGE_NAME:$TAG"
    echo ""
    echo "📋 Para fazer deploy no Dokploy:"
    echo "1. Faça push da imagem para um registry (Docker Hub, GitHub Container Registry, etc.)"
    echo "2. Configure o projeto no Dokploy usando esta imagem"
    echo "3. Configure as variáveis de ambiente necessárias"
else
    echo "❌ Erro durante o build da imagem"
    exit 1
fi
