import type { FastifyInstance } from 'fastify';
import * as imageController from '../controllers/image.controller';

export async function imageRoutes(app: FastifyInstance) {

  // Register multipart support for this route
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 52428800, // 50MB
      files: 10, // Máximo 10 arquivos
    },
    attachFieldsToBody: false, // Importante para saveRequestFiles
  });

  app.post('/images/remove-background', {
    schema: {
      description: 'Remove o fundo de até 10 imagens usando remove.bg',
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
                processed_images: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Imagens processadas em base64 (com fundo removido)'
                },
                processing_info: {
                  type: 'object',
                  properties: {
                    total_images: { type: 'number' },
                    successful_removals: { type: 'number' },
                    failed_removals: { type: 'number' },
                    processing_time_ms: { type: 'number' }
                  }
                }
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
  }, imageController.removeBackground);
} 