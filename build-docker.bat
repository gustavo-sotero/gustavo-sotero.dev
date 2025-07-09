@echo off
REM Script para build da imagem Docker para Dokploy (Windows)
REM Execute: build-docker.bat

echo 🚀 Iniciando build da imagem Docker para Dokploy...

REM Nome da imagem
set IMAGE_NAME=gustavo-sotero-dev
set TAG=latest

echo 📦 Construindo imagem: %IMAGE_NAME%:%TAG%

REM Build da imagem
docker build -t %IMAGE_NAME%:%TAG% .

if %ERRORLEVEL% EQU 0 (
    echo ✅ Build concluído com sucesso!
    echo 🔍 Informações da imagem:
    docker images | findstr %IMAGE_NAME%
    
    echo.
    echo 🚀 Para testar localmente, execute:
    echo docker run -p 3000:3000 %IMAGE_NAME%:%TAG%
    echo.
    echo 📋 Para fazer deploy no Dokploy:
    echo 1. Faça push da imagem para um registry (Docker Hub, GitHub Container Registry, etc.^)
    echo 2. Configure o projeto no Dokploy usando esta imagem
    echo 3. Configure as variáveis de ambiente necessárias
) else (
    echo ❌ Erro durante o build da imagem
    exit /b 1
)
