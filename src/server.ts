import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { healthRoutes } from './routes/health.js';
import { imageRoutes } from './routes/image.routes.js';
import { carRoutes } from './routes/car.routes.js';
import { partRoutes } from './routes/part.routes.js';

config();

const app = Fastify({
  logger: true,
  // Configurações específicas para melhorar compatibilidade com iOS
  requestTimeout: 300000, // 5 minutos para requisições complexas
  bodyLimit: 104857600, // 100MB total
  keepAliveTimeout: 65000, // 65 segundos
  maxRequestsPerSocket: 0, // Sem limite
  // Configurações adicionais para iOS
  connectionTimeout: 60000, // 60 segundos para estabelecer conexão
  pluginTimeout: 60000, // 60 segundos para plugins
  trustProxy: true, // Importante para ngrok/proxy reverso
  ignoreTrailingSlash: true,
});

app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'ngrok-skip-browser-warning',
    'X-Requested-With',
    'Accept',
    'Origin',
    'User-Agent'
  ],
  credentials: true,
  // Configurações adicionais para iOS
  optionsSuccessStatus: 200, // iOS às vezes precisa de 200 ao invés de 204
  preflightContinue: false,
  maxAge: 86400 // Cache preflight por 24h
});

app.register(healthRoutes);
app.register(imageRoutes);
app.register(carRoutes);
app.register(partRoutes);

const start = async () => {
  try {
    const host = process.env.HOST || '0.0.0.0';
    const port = Number(process.env.PORT) || 3333;

    await app.listen({ host, port });
    console.log(`🚀 Servidor rodando em http://${host}:${port}`);
    
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
