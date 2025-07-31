import type { FastifyRequest, FastifyReply } from 'fastify';
import * as carService from '../services/car.service.js';
import type { CreateCarRequest, UpdateCarRequest, CarParams, CarResponse, CarDetailsResponse, DeleteResponse, InternalIdsResponse, AllCarsResponse, GenerateInternalIdRequest, GenerateInternalIdResponse, CarPartsResponse } from '../schemas/car.schema';
import { CreateCarSchema, UpdateCarSchema, CarParamsSchema, GenerateInternalIdSchema } from '../schemas/car.schema.js';

export async function createCar(request: FastifyRequest, reply: FastifyReply): Promise<CarResponse> {
  try {
    // Valida os dados de entrada
    const validationResult = CreateCarSchema.safeParse(request.body);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return reply.status(400).send({
        success: false,
        error: {
          type: 'validation_error',
          message: firstError.message
        }
      });
    }

    const carData: CreateCarRequest = validationResult.data;

    // Chama o service para criar o carro
    const result = await carService.createCar(carData);

    // Verifica se houve erro no service
    if ('error' in result) {
      return reply.status(400).send({
        success: false,
        error: {
          type: result.error,
          message: result.message
        }
      });
    }

    // Resposta de sucesso
    return reply.status(201).send({
      success: true,
      data: {
        id: result.id,
        internal_id: result.internal_id
      }
    });

  } catch (error) {
    console.error('Erro no controller createCar:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

export async function updateCar(request: FastifyRequest<{ Params: CarParams }>, reply: FastifyReply): Promise<CarDetailsResponse> {
  try {
    // Valida os parâmetros da URL
    const paramsValidation = CarParamsSchema.safeParse(request.params);
    if (!paramsValidation.success) {
      const firstError = paramsValidation.error.errors[0];
      return reply.status(400).send({
        success: false,
        error: {
          type: 'validation_error',
          message: firstError.message
        }
      });
    }

    // Valida os dados de entrada
    const bodyValidation = UpdateCarSchema.safeParse(request.body);
    if (!bodyValidation.success) {
      const firstError = bodyValidation.error.errors[0];
      return reply.status(400).send({
        success: false,
        error: {
          type: 'validation_error',
          message: firstError.message
        }
      });
    }

    const { identifier } = paramsValidation.data;
    const updateData: UpdateCarRequest = bodyValidation.data;

    // Chama o service para atualizar o carro
    const result = await carService.updateCar(identifier, updateData);

    // Verifica se houve erro no service
    if ('error' in result) {
      const statusCode = result.error === 'car_not_found' ? 404 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: {
          type: result.error,
          message: result.message
        }
      });
    }

    // Resposta de sucesso
    return reply.status(200).send({
      success: true,
      data: {
        id: result.id,
        internal_id: result.internal_id,
        brand: result.brand,
        model: result.model,
        year: result.year,
        color: result.color,
        created_at: result.created_at.toISOString(),
        updated_at: result.updated_at.toISOString(),
      }
    });

  } catch (error) {
    console.error('Erro no controller updateCar:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

export async function deleteCar(request: FastifyRequest<{ Params: CarParams }>, reply: FastifyReply): Promise<DeleteResponse> {
  try {
    // Valida os parâmetros da URL
    const paramsValidation = CarParamsSchema.safeParse(request.params);
    if (!paramsValidation.success) {
      const firstError = paramsValidation.error.errors[0];
      return reply.status(400).send({
        success: false,
        error: {
          type: 'validation_error',
          message: firstError.message
        }
      });
    }

    const { identifier } = paramsValidation.data;

    // Chama o service para deletar o carro
    const result = await carService.deleteCar(identifier);

    // Verifica se houve erro no service
    if (result !== true) {
      const statusCode = result.error === 'car_not_found' ? 404 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: {
          type: result.error,
          message: result.message
        }
      });
    }

    // Resposta de sucesso
    return reply.status(200).send({
      success: true
    });

  } catch (error) {
    console.error('Erro no controller deleteCar:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

export async function getCarById(request: FastifyRequest<{ Params: CarParams }>, reply: FastifyReply): Promise<CarDetailsResponse> {
  try {
    // Valida os parâmetros da URL
    const paramsValidation = CarParamsSchema.safeParse(request.params);
    if (!paramsValidation.success) {
      const firstError = paramsValidation.error.errors[0];
      return reply.status(400).send({
        success: false,
        error: {
          type: 'validation_error',
          message: firstError.message
        }
      });
    }

    const { identifier } = paramsValidation.data;

    // Chama o service para buscar o carro
    const result = await carService.getCarById(identifier);

    // Verifica se houve erro no service
    if ('error' in result) {
      const statusCode = result.error === 'car_not_found' ? 404 : 500;
      return reply.status(statusCode).send({
        success: false,
        error: {
          type: result.error,
          message: result.message
        }
      });
    }

    // Resposta de sucesso
    return reply.status(200).send({
      success: true,
      data: {
        id: result.id,
        internal_id: result.internal_id,
        brand: result.brand,
        model: result.model,
        year: result.year,
        color: result.color,
        created_at: result.created_at.toISOString(),
        updated_at: result.updated_at.toISOString(),
      }
    });

  } catch (error) {
    console.error('Erro no controller getCarById:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

export async function getAllCarInternalIds(request: FastifyRequest, reply: FastifyReply): Promise<InternalIdsResponse> {
  try {
    // Chama o service para buscar todos os internal_ids
    const result = await carService.getAllCarInternalIds();

    // Verifica se houve erro no service
    if ('error' in result) {
      return reply.status(500).send({
        success: false,
        error: {
          type: result.error,
          message: result.message
        }
      });
    }

    // Resposta de sucesso
    return reply.status(200).send({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Erro no controller getAllCarInternalIds:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

export async function getAllCars(request: FastifyRequest, reply: FastifyReply): Promise<AllCarsResponse> {
  try {
    // Chama o service pra buscar todos os carros
    const result = await carService.getAllCars();

    // Verifica se houve erro no service
    if ('error' in result) {
      return reply.status(500).send({
        success: false,
        error: {
          type: result.error,
          message: result.message
        }
      });
    }

    // Formatar as datas pra string
    const formattedCars = result.map(car => ({
      id: car.id,
      internal_id: car.internal_id,
      brand: car.brand,
      model: car.model,
      year: car.year,
      color: car.color,
      created_at: car.created_at.toISOString(),
      updated_at: car.updated_at.toISOString(),
    }));

    return reply.status(200).send({
      success: true,
      data: formattedCars
    });

  } catch (error) {
    console.error('Erro no controller getAllCars:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

export async function generateInternalId(request: FastifyRequest, reply: FastifyReply): Promise<GenerateInternalIdResponse> {
  try {
    // Valida os dados de entrada
    const validationResult = GenerateInternalIdSchema.safeParse(request.body);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return reply.status(400).send({
        success: false,
        error: {
          type: 'validation_error',
          message: firstError.message
        }
      });
    }

    const carData: GenerateInternalIdRequest = validationResult.data;

    // Chama o service para gerar o internal_id
    const result = await carService.generateInternalIdFromData(carData);

    // Verifica se houve erro no service
    if (typeof result === 'object' && 'error' in result) {
      return reply.status(500).send({
        success: false,
        error: {
          type: result.error,
          message: result.message
        }
      });
    }

    // Resposta de sucesso
    return reply.status(200).send({
      success: true,
      data: {
        internal_id: result
      }
    });

  } catch (error) {
    console.error('Erro no controller generateInternalId:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

export async function getCarParts(request: FastifyRequest, reply: FastifyReply): Promise<CarPartsResponse> {
  try {
    // Valida os parâmetros da URL
    const validationResult = CarParamsSchema.safeParse(request.params);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return reply.status(400).send({
        success: false,
        error: {
          type: 'validation_error',
          message: firstError.message
        }
      });
    }

    const { identifier }: CarParams = validationResult.data;

    // Chama o service para buscar as peças do carro
    const result = await carService.getCarParts(identifier);

    // Verifica se houve erro no service
    if ('error' in result) {
      const statusCode = result.error === 'car_not_found' ? 404 : 500;
      
      return reply.status(statusCode).send({
        success: false,
        error: {
          type: result.error,
          message: result.message
        }
      });
    }

    // Formatar as datas para string e garantir compatibilidade
    const formattedParts = result.map(part => ({
      id: part.id,
      name: part.name,
      description: part.description,
      condition: part.condition,
      stock_address: part.stock_address,
      dimensions: part.dimensions,
      weight: part.weight,
      compatibility: part.compatibility,
      min_price: part.min_price,
      suggested_price: part.suggested_price,
      max_price: part.max_price,
      ad_title: part.ad_title,
      ad_description: part.ad_description,
      images: part.images,
      created_at: part.created_at.toISOString(),
      updated_at: part.updated_at.toISOString(),
      car_id: part.car_id,
    }));

    // Resposta de sucesso
    return reply.status(200).send({
      success: true,
      data: formattedParts
    });

  } catch (error) {
    console.error('Erro no controller getCarParts:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
} 