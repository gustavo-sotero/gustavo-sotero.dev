@echo off
REM Script para build da imagem Docker para Dokploy (Windows)
REM Execute: build-docker.bat

echo 🚀 Iniciando build da imagem Docker para Dokploy...

REM Nome da imagem
set IMAGE_NAME=gustavo-sotero-dev
set TAG=latest

echo 📦 Construindo imagem: %IMAGE_NAME%:%TAG%

REM Verifica se o arquivo .env existe
if not exist .env (
    echo ⚠️  Arquivo .env não encontrado!
    echo 📝 Copiando .env.example para .env...
    copy .env.example .env
    echo ⚠️  Configure o arquivo .env com suas variáveis antes de continuar!
    echo 📖 Consulte ENVIRONMENT.md para instruções detalhadas
    pause
)

REM Build da imagem com build args do arquivo .env
echo 🔧 Carregando variáveis de ambiente...
for /f "usebackq tokens=1,2 delims==" %%i in (.env) do (
    if "%%i"=="TELEGRAM_BOT_TOKEN" set TELEGRAM_BOT_TOKEN=%%j
    if "%%i"=="TELEGRAM_CHAT_ID" set TELEGRAM_CHAT_ID=%%j
)

docker build ^
  --build-arg TELEGRAM_BOT_TOKEN=%TELEGRAM_BOT_TOKEN% ^
  --build-arg TELEGRAM_CHAT_ID=%TELEGRAM_CHAT_ID% ^
  -t %IMAGE_NAME%:%TAG% .

if %ERRORLEVEL% EQU 0 (
    echo ✅ Build concluído com sucesso!
    echo 🔍 Informações da imagem:
    docker images | findstr %IMAGE_NAME%
    
    echo.
    echo 🚀 Para testar localmente, execute:
    echo docker run -p 3000:3000 ^
    echo   -e TELEGRAM_BOT_TOKEN=%TELEGRAM_BOT_TOKEN% ^
    echo   -e TELEGRAM_CHAT_ID=%TELEGRAM_CHAT_ID% ^
    echo   %IMAGE_NAME%:%TAG%
    echo.
    echo 📋 Para fazer deploy no Dokploy:
    echo 1. Faça push da imagem para um registry (Docker Hub, GitHub Container Registry, etc.^)
    echo 2. Configure o projeto no Dokploy usando esta imagem
    echo 3. Configure as variáveis de ambiente necessárias (veja ENVIRONMENT.md^)
    echo.
    echo 🔧 Ou use docker-compose para desenvolvimento:
    echo docker-compose up --build
) else (
    echo ❌ Erro durante o build da imagem
    exit /b 1
)
