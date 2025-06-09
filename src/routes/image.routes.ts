import type { FastifyInstance } from 'fastify';
import { ImageController } from '../controllers/image.controller';

export async function imageRoutes(app: FastifyInstance) {
  const imageController = new ImageController();

  // Register multipart support for this route
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 52428800, // 50MB
    }
  });

  app.post('/upload-images', {
    schema: {
      description: 'Upload up to 5 images to identify automotive parts using AI',
      tags: ['Image Processing'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, imageController.uploadImages.bind(imageController));
} 