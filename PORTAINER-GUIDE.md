# 🐳 Guia de Deploy no Portainer - Raca Forte Backend

Este guia explica como fazer o deploy da aplicação Raca Forte Backend usando **Portainer**.

## 📋 Pré-requisitos

1. **Portainer** instalado e configurado
2. **Docker** e **Docker Compose** disponíveis no host
3. Acesso ao repositório Git (ou upload dos arquivos)

## 🚀 Deploy via Portainer

### Método 1: Git Repository (Recomendado)

1. **Acesse Portainer** → **Stacks** → **Add Stack**

2. **Configure o Stack:**
   - **Name**: `raca-forte-backend`
   - **Build method**: `Repository`
   - **Repository URL**: `https://github.com/seu-usuario/racaforte-backend`
   - **Reference**: `main` ou `master`
   - **Compose path**: `docker-compose.prod.yml`

3. **Configure as Variáveis de Ambiente:**
   ```env
   # Database
   MYSQL_ROOT_PASSWORD=sua_senha_root_super_segura
   MYSQL_DATABASE=racaforte_db
   MYSQL_USER=racaforte_user
   MYSQL_PASSWORD=sua_senha_db_segura
   
   # Server
   NODE_ENV=production
   
   # AI Services (OBRIGATÓRIAS)
   OPENAI_API_KEY=sua_chave_openai
   GEMINI_API_KEY=sua_chave_gemini
   
   # Storage Hetzner (OBRIGATÓRIAS)
   HETZNER_S3_ENDPOINT=https://nbg1.your-hetzner-endpoint.com
   HETZNER_S3_BUCKET=racaforte-uploads
   HETZNER_ACCESS_KEY=sua_chave_acesso
   HETZNER_SECRET_KEY=sua_chave_secreta
   
   # APIs Opcionais
   REMOVEBG_API_KEY=sua_chave_removebg
   UNWRANGLE_API_KEY=sua_chave_unwrangle
   
   # Registry (se usando imagem customizada)
   DOCKER_REGISTRY=ghcr.io/seu-usuario
   ```

4. **Deploy**: Clique em **Deploy the stack**

### Método 2: Upload Manual

1. **Zip os arquivos** do projeto (incluindo `docker-compose.prod.yml`)

2. **Portainer** → **Stacks** → **Add Stack**

3. **Configure:**
   - **Name**: `raca-forte-backend`
   - **Build method**: `Upload`
   - **Upload**: arquivo ZIP do projeto
   - **Compose path**: `docker-compose.prod.yml`

4. **Configure as variáveis de ambiente** (mesmas do Método 1)

5. **Deploy**: Clique em **Deploy the stack**

### Método 3: Editor Web

1. **Portainer** → **Stacks** → **Add Stack**

2. **Configure:**
   - **Name**: `raca-forte-backend`
   - **Build method**: `Web editor`

3. **Cole o conteúdo** do `docker-compose.prod.yml` no editor

4. **Configure as variáveis de ambiente**

5. **Deploy**

## 🔧 Configuração Avançada

### Registry Personalizado

Se você tem seu próprio registry Docker:

1. **Configure no Portainer:**
   - **Settings** → **Registries** → **Add Registry**
   - Configure seu registry (Docker Hub, GitHub, GitLab, etc.)

2. **Atualize o docker-compose.prod.yml:**
   ```yaml
   backend:
     image: seu-registry.com/racaforte-backend:latest
   ```

### SSL/HTTPS (Nginx)

Para habilitar HTTPS, crie a pasta `nginx/` no seu projeto:

```bash
mkdir -p nginx
```

**nginx/nginx.conf:**
```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3333;
    }

    server {
        listen 80;
        server_name seu-dominio.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl;
        server_name seu-dominio.com;

        ssl_certificate /etc/ssl/certs/cert.pem;
        ssl_certificate_key /etc/ssl/certs/key.pem;

        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## 📊 Monitoramento

### Logs no Portainer

1. **Stacks** → **raca-forte-backend** → **Services**
2. Clique no serviço desejado (backend, mysql, redis)
3. **Logs** tab para ver logs em tempo real

### Health Checks

Os serviços incluem health checks automáticos:

- **MySQL**: `mysqladmin ping`
- **Backend**: `curl http://localhost:3333/health`
- **Redis**: `redis-cli ping`

### Endpoints de Monitoramento

- **Health Check**: `http://seu-servidor:3333/health`
- **Documentação API**: `http://seu-servidor:3333/documentation`

## 🔄 Atualizações

### Atualizar via Portainer

1. **Stacks** → **raca-forte-backend**
2. **Editor** tab
3. Modifique as configurações se necessário
4. **Update the stack**

### Atualizar Imagem Docker

Se usando registry:

1. Faça push da nova imagem para o registry
2. No Portainer: **Services** → **backend** → **Update service**
3. **Pull latest image** ✅
4. **Update**

## 🛠️ Troubleshooting

### Problemas Comuns

1. **Backend não inicia:**
   - Verificar variáveis de ambiente (OPENAI_API_KEY, etc.)
   - Verificar logs: `docker logs raca_forte_backend_prod`

2. **Erro de conexão com banco:**
   - Verificar se MySQL está healthy
   - Verificar DATABASE_URL
   - Aguardar mais tempo para MySQL inicializar

3. **Problemas de rede:**
   - Verificar se todos os serviços estão na mesma network
   - Verificar portas expostas

### Comandos Úteis

```bash
# Ver logs de todos os serviços
docker-compose -f docker-compose.prod.yml logs -f

# Reiniciar apenas o backend
docker-compose -f docker-compose.prod.yml restart backend

# Verificar status dos containers
docker-compose -f docker-compose.prod.yml ps

# Executar comando no container
docker exec -it raca_forte_backend_prod sh
```

## 🔐 Segurança

### Recomendações de Produção

1. **Senhas Fortes**: Use senhas complexas para MySQL
2. **Rede Privada**: Configure redes Docker isoladas
3. **Firewall**: Exponha apenas portas necessárias (80, 443)
4. **SSL**: Use HTTPS em produção
5. **Backups**: Configure backup automático dos volumes
6. **Monitoramento**: Configure alertas para falhas

### Variáveis Sensíveis

⚠️ **NUNCA** commite no Git:
- `OPENAI_API_KEY`
- `MYSQL_ROOT_PASSWORD`
- `HETZNER_SECRET_KEY`
- Outras chaves de API

Use sempre o sistema de **Environment Variables** do Portainer.

---

## 📞 Suporte

Em caso de problemas:

1. Verificar logs no Portainer
2. Consultar documentação do Fastify/Prisma
3. Abrir issue no repositório GitHub

**🎉 Sua aplicação Raca Forte Backend está pronta para produção!**
