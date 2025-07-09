# Deploy no Dokploy - Gustavo Sotero Dev

Este documento contém as instruções para fazer deploy da aplicação no Dokploy usando Docker.

## 📋 Pré-requisitos

- Docker instalado
- Conta no Dokploy
- Registry Docker (Docker Hub, GitHub Container Registry, etc.)

## 🚀 Processo de Deploy

### 1. Build da Imagem Docker

Execute o script de build adequado para seu sistema operacional:

**Windows:**

```cmd
build-docker.bat
```

**Linux/macOS:**

```bash
chmod +x build-docker.sh
./build-docker.sh
```

### 2. Push para Registry

#### Docker Hub

```bash
# Tag a imagem
docker tag gustavo-sotero-dev:latest seunome/gustavo-sotero-dev:latest

# Faça login no Docker Hub
docker login

# Push da imagem
docker push seunome/gustavo-sotero-dev:latest
```

#### GitHub Container Registry

```bash
# Tag a imagem
docker tag gustavo-sotero-dev:latest ghcr.io/seuusuario/gustavo-sotero-dev:latest

# Faça login no GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u seuusuario --password-stdin

# Push da imagem
docker push ghcr.io/seuusuario/gustavo-sotero-dev:latest
```

### 3. Configuração no Dokploy

1. **Criar Novo Projeto:**

   - Acesse o painel do Dokploy
   - Clique em "New Project"
   - Selecione "Docker"

2. **Configurar Imagem:**

   - Image: `seunome/gustavo-sotero-dev:latest` ou `ghcr.io/seuusuario/gustavo-sotero-dev:latest`
   - Port: `3000`

3. **Variáveis de Ambiente:**

   ```
   NODE_ENV=production
   NEXT_TELEMETRY_DISABLED=1
   PORT=3000
   HOSTNAME=0.0.0.0
   ```

4. **Health Check:**

   - Path: `/api/health`
   - Port: `3000`
   - Interval: `30s`
   - Timeout: `10s`
   - Retries: `3`

5. **Domínio:**
   - Configure seu domínio personalizado ou use o subdomínio fornecido pelo Dokploy

## 🔧 Configurações Avançadas

### Otimizações de Performance

O Dockerfile já inclui as seguintes otimizações:

- **Multi-stage build** para reduzir o tamanho da imagem
- **Alpine Linux** como base para imagens menores
- **Standalone output** do Next.js para melhor performance
- **Usuário não-root** para segurança
- **Cache otimizado** das dependências

### Monitoramento

- Endpoint de health check: `/api/health`
- Logs disponíveis através do Dokploy dashboard
- Métricas de CPU e memória automáticas

### Backup e Versionamento

- Use tags versionadas para releases: `v1.0.0`, `v1.1.0`, etc.
- Mantenha sempre a tag `latest` atualizada
- Configure CI/CD para builds automáticos

## 🐛 Troubleshooting

### Problemas Comuns

1. **Erro de build:**

   - Verifique se todas as dependências estão no `package.json`
   - Confirme que o `next.config.ts` tem `output: 'standalone'`

2. **Aplicação não inicia:**

   - Verifique os logs no Dokploy dashboard
   - Confirme que a porta 3000 está exposta
   - Verifique as variáveis de ambiente

3. **Health check falha:**
   - Confirme que `/api/health` está acessível
   - Verifique se a aplicação está rodando na porta correta

### Logs Úteis

```bash
# Ver logs do container local
docker logs container_id

# Ver logs em tempo real
docker logs -f container_id
```

## 📚 Recursos Adicionais

- [Documentação do Dokploy](https://docs.dokploy.com)
- [Documentação do Next.js para Docker](https://nextjs.org/docs/deployment#docker-image)
- [Melhores práticas do Docker](https://docs.docker.com/develop/dev-best-practices/)

---

🎉 **Parabéns!** Sua aplicação Next.js está agora pronta para deploy no Dokploy com todas as melhores práticas implementadas.
