import type { FastifyInstance } from 'fastify';
import * as partController from '../controllers/part.controller';

export async function partRoutes(app: FastifyInstance) {
  // Registra suporte a multipart para esta rota
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 52428800, // 50MB
      files: 5, // Máximo 5 arquivos
    },
    attachFieldsToBody: false, // Desabilita o processamento automático dos campos
  });

  app.post('/part', {
    schema: {
      description: 'Criar uma nova peça com imagens',
      tags: ['Part Management'],
      consumes: ['multipart/form-data'],
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                images: {
                  type: 'array',
                  items: { type: 'string' }
                },
                qrCode: {
                  type: 'object',
                  properties: {
                    qrCodeData: { 
                      type: 'string',
                      description: 'Base64 data URL da imagem do QR code'
                    },
                    url: { 
                      type: 'string',
                      description: 'URL que o QR code aponta'
                    }
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
        },
        404: {
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
        },
        500: {
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
  }, partController.createPart);

  app.get('/parts', {
    schema: {
      description: 'Buscar todas as peças',
      tags: ['Part Management'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  condition: { type: 'string', enum: ['BOA', 'MEDIA', 'RUIM'] },
                  stock_address: { type: 'string' },
                  dimensions: {},
                  weight: { type: 'number' },
                  compatibility: {},
                  min_price: { type: 'number' },
                  suggested_price: { type: 'number' },
                  max_price: { type: 'number' },
                  ad_title: { type: 'string' },
                  ad_description: { type: 'string' },
                  images: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                  car_id: { type: 'string' },
                  car: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      internal_id: { type: 'string' },
                      brand: { type: 'string' },
                      model: { type: 'string' },
                      year: { type: 'integer' },
                      color: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        500: {
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
  }, partController.getAllParts);

  app.get('/part/:id', {
    schema: {
      description: 'Buscar uma peça por ID',
      tags: ['Part Management'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'ID único da peça'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                condition: { type: 'string', enum: ['BOA', 'MEDIA', 'RUIM'] },
                stock_address: { type: 'string' },
                dimensions: {},
                weight: { type: 'number' },
                compatibility: {},
                min_price: { type: 'number' },
                suggested_price: { type: 'number' },
                max_price: { type: 'number' },
                ad_title: { type: 'string' },
                ad_description: { type: 'string' },
                images: {
                  type: 'array',
                  items: { type: 'string' }
                },
                created_at: { type: 'string' },
                updated_at: { type: 'string' },
                car_id: { type: 'string' },
                car: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    internal_id: { type: 'string' },
                    brand: { type: 'string' },
                    model: { type: 'string' },
                    year: { type: 'integer' },
                    color: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        404: {
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
        },
        500: {
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
  }, partController.getPartById);
} 