#!/bin/bash

# =======================================================
# RACA FORTE BACKEND - SCRIPT DE DEPLOY PARA PORTAINER
# =======================================================

set -e

echo "🚀 Iniciando deploy do Raca Forte Backend..."

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "📋 Copie o arquivo env.example para .env e configure as variáveis:"
    echo "   cp env.example .env"
    exit 1
fi

# Carregar variáveis de ambiente
source .env

echo "✅ Variáveis de ambiente carregadas"

# Build da imagem
echo "🔨 Fazendo build da aplicação..."
docker build -t racaforte-backend:latest .

# Tag para registry (opcional)
if [ ! -z "$DOCKER_REGISTRY" ]; then
    echo "🏷️ Taggeando imagem para registry..."
    docker tag racaforte-backend:latest $DOCKER_REGISTRY/racaforte-backend:latest
    
    echo "📤 Fazendo push para registry..."
    docker push $DOCKER_REGISTRY/racaforte-backend:latest
fi

echo "✅ Build concluído!"

# Verificar se deve usar produção ou desenvolvimento
if [ "$1" = "prod" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    echo "🌟 Usando configuração de PRODUÇÃO"
else
    COMPOSE_FILE="docker-compose.yml"
    echo "🛠️ Usando configuração de DESENVOLVIMENTO"
fi

# Fazer deploy
echo "🚀 Fazendo deploy com $COMPOSE_FILE..."
docker-compose -f $COMPOSE_FILE down
docker-compose -f $COMPOSE_FILE up -d

echo "⏳ Aguardando serviços iniciarem..."
sleep 30

# Verificar saúde dos serviços
echo "🔍 Verificando saúde dos serviços..."

# Verificar MySQL
if docker-compose -f $COMPOSE_FILE exec mysql mysqladmin ping -h localhost > /dev/null 2>&1; then
    echo "✅ MySQL: OK"
else
    echo "❌ MySQL: FALHA"
fi

# Verificar Backend
if curl -f http://localhost:3333/health > /dev/null 2>&1; then
    echo "✅ Backend: OK"
else
    echo "❌ Backend: FALHA"
fi

# Verificar Redis (se habilitado)
if docker-compose -f $COMPOSE_FILE exec redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: OK"
else
    echo "⚠️ Redis: Não disponível ou com problema"
fi

echo ""
echo "🎉 Deploy concluído!"
echo "📊 Status dos containers:"
docker-compose -f $COMPOSE_FILE ps

echo ""
echo "🌐 Aplicação disponível em:"
echo "   Backend: http://localhost:3333"
echo "   Health Check: http://localhost:3333/health"
echo "   Documentação: http://localhost:3333/documentation"
echo ""
echo "📋 Para ver logs:"
echo "   docker-compose -f $COMPOSE_FILE logs -f"
echo ""
echo "🛑 Para parar:"
echo "   docker-compose -f $COMPOSE_FILE down"
