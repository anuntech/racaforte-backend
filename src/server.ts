import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { healthRoutes } from './routes/health';
import { imageRoutes } from './routes/image.routes';
import { carRoutes } from './routes/car.routes';
import { partRoutes } from './routes/part.routes';

config();

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
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
