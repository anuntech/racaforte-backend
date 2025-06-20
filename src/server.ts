import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { healthRoutes } from './routes/health';
import { imageRoutes } from './routes/image.routes';
import { carRoutes } from './routes/car.routes';

config();

const app = Fastify({
  logger: true,
});

app.register(cors, { origin: '*' });

app.register(healthRoutes); // 🔥 Register the route here
app.register(imageRoutes); // 🔥 Register image upload routes
app.register(carRoutes); // 🔥 Register car routes

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT) || 3333;

app.listen({ port, host }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server listening at ${address}`);
  console.log(`📱 Para acessar do celular use: http://[SEU_IP]:${port}`);
});
