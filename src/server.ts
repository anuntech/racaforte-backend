import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { healthRoutes } from './routes/health';
import { imageRoutes } from './routes/image.routes';
import { carRoutes } from './routes/car.routes';
import { partRoutes } from './routes/part.routes';
import { authRoutes } from './routes/auth.routes';
import { initializeMercadoLivre } from './services/mercadolivre.service';

config();

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 'ngrok-skip-browser-warning'
  ],
  credentials: true,
});

app.register(healthRoutes);
app.register(imageRoutes);
app.register(carRoutes);
app.register(partRoutes);
app.register(authRoutes);

const start = async () => {
  try {
    const host = process.env.HOST || '0.0.0.0';
    const port = Number(process.env.PORT) || 3333;

    await app.listen({ host, port });
    console.log(`🚀 Servidor rodando em http://${host}:${port}`);
    
    // Inicializa automaticamente a autenticação MercadoLivre
    console.log('');
    await initializeMercadoLivre();
    console.log('');
    
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
