import type { FastifyInstance } from 'fastify';
import * as partController from '../controllers/part.controller';

export async function partRoutes(app: FastifyInstance) {
  // Registra suporte a multipart para esta rota com configurações otimizadas para iOS/Expo/React Native
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 52428800, // 50MB por arquivo
      files: 5, // Máximo 5 arquivos
      fieldNameSize: 500, // Tamanho máximo do nome do campo
      fieldSize: 1048576, // 1MB para campos de texto
      headerPairs: 2000, // Máximo de pares de headers
    },
    attachFieldsToBody: false, // Desabilita o processamento automático dos campos
    throwFileSizeLimit: false, // Não lança erro imediatamente, permite tratamento customizado
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

  app.get('/parts/search', {
    schema: {
      description: 'Buscar peças pelo nome',
      tags: ['Part Management'],
      querystring: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Nome da peça para buscar (busca parcial)',
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
  }, partController.searchPartsByName);

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

  app.put('/part/:id', {
    schema: {
      description: 'Atualizar uma peça existente',
      tags: ['Part Management'],
      consumes: ['multipart/form-data'],
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
  }, partController.updatePart);

  app.delete('/part/:id', {
    schema: {
      description: 'Deletar uma peça',
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
            message: { type: 'string' }
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
  }, partController.deletePart);

  app.post('/part/process', {
    schema: {
      description: 'Processar e gerar dados completos da peça usando IA',
      tags: ['Part Management'],
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
                ad_title: {
                  type: 'string',
                  description: 'Título otimizado para anúncio'
                },
                ad_description: {
                  type: 'string',
                  description: 'Descrição detalhada para anúncio'
                },
                dimensions: {
                  type: 'object',
                  properties: {
                    width: { type: 'string' },
                    height: { type: 'string' },
                    depth: { type: 'string' },
                    unit: { type: 'string' }
                  },
                  description: 'Dimensões estimadas da peça'
                },
                weight: {
                  type: 'number',
                  description: 'Peso estimado em kg'
                },
                compatibility: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      brand: { type: 'string' },
                      model: { type: 'string' },
                      year: { type: 'string' }
                    }
                  },
                  description: 'Lista de veículos compatíveis'
                },
                prices: {
                  type: 'object',
                  properties: {
                    min_price: { type: 'number' },
                    suggested_price: { type: 'number' },
                    max_price: { type: 'number' }
                  },
                  description: 'Preços sugeridos para venda'
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
  }, partController.processPart);
} 