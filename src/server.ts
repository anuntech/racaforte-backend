/**
 * RACA FORTE BACKEND - Servidor Principal
 * 
 * Sistema para gerenciamento de peças automotivas e anúncios.
 * Utiliza Fastify como framework web com suporte completo a TypeScript.
 * 
 * Funcionalidades principais:
 * - Gerenciamento de veículos (CRUD)
 * - Gerenciamento de peças automotivas (CRUD)
 * - Upload e processamento de imagens
 * - Integração com IA (Gemini/Grok) para análise de peças
 * - Sistema de anúncios automatizados
 * 
 * @author Equipe Raca Forte
 * @version 1.0.0
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { healthRoutes } from './routes/health.js';
import { imageRoutes } from './routes/image.routes.js';
import { carRoutes } from './routes/car.routes.js';
import { partRoutes } from './routes/part.routes.js';

// Carrega variáveis de ambiente do arquivo .env
config();

/**
 * Configuração do servidor Fastify
 * 
 * Configurações otimizadas para:
 * - Compatibilidade com dispositivos iOS
 * - Upload de imagens grandes (até 100MB)
 * - Uso com ngrok em desenvolvimento
 * - Timeouts apropriados para operações de IA
 */
const app = Fastify({
  logger: true,
  // Configurações de timeout para operações longas (IA, upload de imagens)
  requestTimeout: 300000, // 5 minutos para requisições complexas
  bodyLimit: 104857600, // 100MB para upload de múltiplas imagens
  keepAliveTimeout: 65000, // 65 segundos - compatibilidade iOS
  maxRequestsPerSocket: 0, // Sem limite de requests por socket
  
  // Configurações de conexão
  connectionTimeout: 60000, // 60 segundos para estabelecer conexão
  pluginTimeout: 60000, // 60 segundos para carregar plugins
  trustProxy: true, // Essencial para ngrok/proxy reverso
  ignoreTrailingSlash: true, // Flexibilidade nas URLs
});

/**
 * Configuração CORS
 * 
 * Configurado para aceitar requisições de qualquer origem durante desenvolvimento.
 * Inclui headers específicos para ngrok e compatibilidade com iOS.
 * 
 * IMPORTANTE: Em produção, configure 'origin' com domínios específicos!
 */
app.register(cors, {
  origin: true, // TODO: Configurar domínios específicos em produção
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'ngrok-skip-browser-warning', // Necessário para desenvolvimento com ngrok
    'X-Requested-With',
    'Accept',
    'Origin',
    'User-Agent'
  ],
  credentials: true, // Permite cookies/auth headers
  
  // Configurações específicas para iOS
  optionsSuccessStatus: 200, // iOS prefere 200 ao invés de 204 para OPTIONS
  preflightContinue: false,
  maxAge: 86400 // Cache preflight por 24h - melhora performance
});

/**
 * Registro de rotas
 * 
 * Ordem de registro importante - health deve vir primeiro para monitoramento.
 * Cada módulo tem suas próprias rotas organizadas por funcionalidade.
 */
app.register(healthRoutes);  // Monitoramento e status do servidor
app.register(imageRoutes);   // Upload e processamento de imagens
app.register(carRoutes);     // CRUD de veículos
app.register(partRoutes);    // CRUD de peças automotivas

/**
 * Inicialização do servidor
 * 
 * Utiliza variáveis de ambiente para configuração flexível.
 * Em desenvolvimento: HOST=localhost, PORT=3333
 * Em produção (Railway): HOST=0.0.0.0, PORT definido automaticamente
 */
const start = async () => {
  try {
    const host = process.env.HOST || '0.0.0.0';
    const port = Number(process.env.PORT) || 3333;

    await app.listen({ host, port });
    console.log(`🚀 Servidor rodando em http://${host}:${port}`);
    console.log(`📚 Documentação da API: http://${host}:${port}/documentation`);
    
  } catch (err) {
    app.log.error('Erro ao iniciar o servidor:', err);
    process.exit(1);
  }
};

// Inicia o servidor
start();
