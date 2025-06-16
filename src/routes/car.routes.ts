import type { FastifyInstance } from 'fastify';
import * as carController from '../controllers/car.controller';

export async function carRoutes(app: FastifyInstance) {

  app.post('/car', {
    schema: {
      description: 'Criar um novo veículo no banco de dados',
      tags: ['Car Management'],
      body: {
        type: 'object',
        required: ['brand', 'model', 'year', 'color'],
        properties: {
          brand: {
            type: 'string',
            description: 'Marca do veículo',
            minLength: 1
          },
          model: {
            type: 'string',
            description: 'Modelo do veículo',
            minLength: 1
          },
          year: {
            type: 'integer',
            description: 'Ano do veículo',
            minimum: 1900,
            maximum: new Date().getFullYear() + 1
          },
          color: {
            type: 'string',
            description: 'Cor do veículo',
            minLength: 1
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { 
                  type: 'string',
                  description: 'ID único do veículo'
                },
                internal_id: { 
                  type: 'string',
                  description: 'ID interno gerado automaticamente'
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
  }, carController.createCar);

  app.get('/car/:identifier', {
    schema: {
      description: 'Buscar um veículo por ID ou internal_id',
      tags: ['Car Management'],
      params: {
        type: 'object',
        required: ['identifier'],
        properties: {
          identifier: {
            type: 'string',
            description: 'ID único ou internal_id do veículo'
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
                internal_id: { type: 'string' },
                brand: { type: 'string' },
                model: { type: 'string' },
                year: { type: 'integer' },
                color: { type: 'string' },
                created_at: { type: 'string' },
                updated_at: { type: 'string' }
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
        }
      }
    }
  }, carController.getCarById);

  app.patch('/car/:identifier', {
    schema: {
      description: 'Atualizar um veículo existente por ID ou internal_id',
      tags: ['Car Management'],
      params: {
        type: 'object',
        required: ['identifier'],
        properties: {
          identifier: {
            type: 'string',
            description: 'ID único ou internal_id do veículo'
          }
        }
      },
      body: {
        type: 'object',
        properties: {
          brand: {
            type: 'string',
            description: 'Nova marca do veículo',
            minLength: 1
          },
          model: {
            type: 'string',
            description: 'Novo modelo do veículo',
            minLength: 1
          },
          year: {
            type: 'integer',
            description: 'Novo ano do veículo',
            minimum: 1900,
            maximum: new Date().getFullYear() + 1
          },
          color: {
            type: 'string',
            description: 'Nova cor do veículo',
            minLength: 1
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
                internal_id: { type: 'string' },
                brand: { type: 'string' },
                model: { type: 'string' },
                year: { type: 'integer' },
                color: { type: 'string' },
                created_at: { type: 'string' },
                updated_at: { type: 'string' }
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
        }
      }
    }
  }, carController.updateCar);

  app.delete('/car/:identifier', {
    schema: {
      description: 'Deletar um veículo por ID ou internal_id',
      tags: ['Car Management'],
      params: {
        type: 'object',
        required: ['identifier'],
        properties: {
          identifier: {
            type: 'string',
            description: 'ID único ou internal_id do veículo'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
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
        }
      }
    }
  }, carController.deleteCar);

  app.get('/cars/internal-ids', {
    schema: {
      description: 'Buscar todos os internal_ids dos veículos',
      tags: ['Car Management'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: { type: 'string' },
              description: 'Lista de internal_ids dos veículos'
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
  }, carController.getAllCarInternalIds);

  app.get('/cars', {
    schema: {
      description: 'Buscar todos os veículos',
      tags: ['Car Management'],
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
                  internal_id: { type: 'string' },
                  brand: { type: 'string' },
                  model: { type: 'string' },
                  year: { type: 'integer' },
                  color: { type: 'string' },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' }
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
  }, carController.getAllCars);
} 