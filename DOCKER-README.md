# 🐳 Docker Setup - Raca Forte Backend

Este documento explica como rodar a aplicação **Raca Forte Backend** usando Docker e Docker Compose.

## 📦 Arquivos Docker

- `Dockerfile` - Imagem da aplicação Node.js
- `docker-compose.yml` - Configuração para desenvolvimento
- `docker-compose.prod.yml` - Configuração para produção/Portainer
- `.dockerignore` - Arquivos ignorados no build
- `deploy.sh` - Script automatizado de deploy

## 🚀 Quick Start

### 1. Configurar Ambiente

```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar variáveis (OBRIGATÓRIO)
nano .env
```

**Variáveis mínimas necessárias:**
```env
DATABASE_URL="mysql://racaforte_user:racaforte_password@mysql:3306/racaforte_db"
OPENAI_API_KEY=sua_chave_openai
HETZNER_ACCESS_KEY=sua_chave_hetzner
HETZNER_SECRET_KEY=sua_chave_secreta_hetzner
HETZNER_S3_ENDPOINT=https://nbg1.your-endpoint.com
HETZNER_S3_BUCKET=seu-bucket
```

### 2. Deploy Rápido

```bash
# Desenvolvimento (com build local)
npm run docker:dev

# Produção (Portainer-ready)
npm run docker:prod

# Ou usar o script automatizado
./deploy.sh          # desenvolvimento
./deploy.sh prod     # produção
```

## 🛠️ Comandos Disponíveis

### NPM Scripts

```bash
# Build da imagem Docker
npm run docker:build

# Iniciar stack de desenvolvimento
npm run docker:dev

# Iniciar stack de produção
npm run docker:prod

# Parar containers
npm run docker:down
npm run docker:down:prod

# Ver logs
npm run docker:logs
npm run docker:logs:prod

# Deploy automatizado
npm run deploy        # desenvolvimento
npm run deploy:prod   # produção
```

### Docker Compose Manual

```bash
# Desenvolvimento
docker-compose up -d
docker-compose down
docker-compose logs -f

# Produção
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml logs -f
```

## 🏗️ Arquitetura Docker

### Serviços

1. **mysql** - Banco de dados MySQL 8.0
   - Porta: `3306`
   - Volume: `racaforte_mysql_data`
   - Health check automático

2. **backend** - API Node.js/Fastify
   - Porta: `3333`
   - Build multi-stage (otimizado)
   - Health check: `/health`
   - Auto-restart on failure

3. **redis** - Cache Redis (opcional)
   - Porta: `6379`
   - Volume: `racaforte_redis_data`
   - Configurado para produção

4. **nginx** - Proxy reverso (apenas prod)
   - Portas: `80`, `443`
   - SSL ready

### Volumes

```yaml
volumes:
  racaforte_mysql_data:    # Dados do MySQL
  racaforte_redis_data:    # Dados do Redis
  racaforte_uploads:       # Uploads da aplicação
  racaforte_nginx_logs:    # Logs do Nginx
```

### Networks

```yaml
networks:
  raca_forte_network:      # Rede isolada
    driver: bridge
```

## 🔧 Configuração Detalhada

### Dockerfile Multi-stage

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
# Instala deps, gera Prisma, builda TS

# Stage 2: Production
FROM node:18-alpine AS production  
# Apenas prod deps, código compilado, otimizado
```

**Otimizações:**
- ✅ Multi-stage build (imagem final menor)
- ✅ Alpine Linux (seguro e leve)
- ✅ Non-root user (segurança)
- ✅ dumb-init (proper signal handling)
- ✅ Health checks
- ✅ .dockerignore otimizado

### Environment Variables

**Desenvolvimento:**
```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3333
DATABASE_URL=mysql://racaforte_user:racaforte_password@mysql:3306/racaforte_db
```

**Produção:**
```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3333
DATABASE_URL=mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE}
```

## 🌟 Diferenças Dev vs Prod

| Aspecto | Desenvolvimento | Produção |
|---------|----------------|----------|
| **Build** | Local (Dockerfile) | Registry/Hub |
| **Restart** | `unless-stopped` | `always` + policies |
| **Resources** | Unlimited | Limited (CPU/Memory) |
| **Logs** | Debug level | Structured |
| **SSL** | HTTP only | HTTPS (Nginx) |
| **Volumes** | Local bind | Named volumes |

## 📊 Monitoramento

### Health Checks

```bash
# Backend
curl http://localhost:3333/health

# MySQL
docker exec raca_forte_db mysqladmin ping

# Redis  
docker exec raca_forte_redis redis-cli ping
```

### Logs

```bash
# Todos os serviços
docker-compose logs -f

# Serviço específico
docker-compose logs -f backend

# Últimas 100 linhas
docker-compose logs --tail 100 backend
```

### Métricas Docker

```bash
# Stats dos containers
docker stats

# Uso de espaço
docker system df

# Cleanup
docker system prune -f
```

## 🔐 Segurança

### Produção

1. **Senhas fortes** para MySQL
2. **Non-root user** nos containers
3. **Rede isolada** (bridge customizada)
4. **Resource limits** configurados
5. **SSL/TLS** com Nginx
6. **Secrets** via environment vars

### Firewall

```bash
# Apenas portas necessárias
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw allow 22    # SSH
```

## 🛠️ Troubleshooting

### Problemas Comuns

**1. Backend não conecta no MySQL:**
```bash
# Verificar se MySQL está healthy
docker-compose ps

# Ver logs do MySQL
docker-compose logs mysql

# Testar conexão manual
docker exec -it raca_forte_db mysql -u racaforte_user -p
```

**2. Build falha:**
```bash
# Limpar cache Docker
docker builder prune -f

# Rebuild sem cache
docker-compose build --no-cache
```

**3. Porta em uso:**
```bash
# Verificar quem usa a porta
sudo lsof -i :3333

# Parar containers conflitantes  
docker-compose down
```

**4. Volumes corrompidos:**
```bash
# ⚠️ CUIDADO: Remove dados!
docker-compose down -v
docker volume rm racaforte_mysql_data
```

### Debug Mode

```bash
# Executar shell no container
docker exec -it raca_forte_backend sh

# Ver variáveis de ambiente
docker exec raca_forte_backend env

# Ver arquivos
docker exec raca_forte_backend ls -la /app
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and Push
        run: |
          docker build -t ${{ secrets.REGISTRY }}/racaforte-backend:latest .
          docker push ${{ secrets.REGISTRY }}/racaforte-backend:latest
      
      - name: Deploy via SSH
        run: |
          ssh user@server "cd /app && docker-compose -f docker-compose.prod.yml pull && docker-compose -f docker-compose.prod.yml up -d"
```

## 📚 Recursos

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Portainer Documentation](https://docs.portainer.io/)
- [Node.js Docker Guide](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

---

**🎉 Sua aplicação está pronta para Docker e Portainer!**

Para deploy no Portainer, consulte: `PORTAINER-GUIDE.md`
