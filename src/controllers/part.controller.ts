import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import * as partService from '../services/part.service';
import { CreatePartSchema } from '../schemas/part.schema';
import type { PartResponse } from '../schemas/part.schema';

interface FormFields {
  name?: string;
  description?: string;
  condition?: string;
  stock_address?: string;
  dimensions?: string;
  weight?: string;
  compatibility?: string;
  min_price?: string;
  suggested_price?: string;
  max_price?: string;
  ad_title?: string;
  ad_description?: string;
  car_id?: string;
}

export async function createPart(
  request: FastifyRequest, 
  reply: FastifyReply
): Promise<PartResponse> {
  try {
    console.log('Iniciando processamento da requisição...');
    
    // Processa os campos do form e arquivos em uma única leitura
    const fields: FormFields = {};
    const files: MultipartFile[] = [];
    const parts = request.parts();
    
    for await (const part of parts) {
      if ('value' in part) {
        console.log('Campo encontrado:', part.fieldname);
        fields[part.fieldname as keyof FormFields] = part.value as string;
      } else if ('file' in part) {
        console.log('Arquivo encontrado:', {
          fieldname: part.fieldname,
          filename: part.filename,
          mimetype: part.mimetype,
          encoding: part.encoding
        });
        files.push(part);
      }
    }

    console.log('Campos processados:', fields);

    // Prepara os dados para validação
    const partData = {
      name: fields.name,
      description: fields.description,
      condition: fields.condition,
      stock_address: fields.stock_address,
      dimensions: fields.dimensions ? JSON.parse(fields.dimensions) : undefined,
      weight: fields.weight ? Number.parseFloat(fields.weight) : undefined,
      compatibility: fields.compatibility ? JSON.parse(fields.compatibility) : undefined,
      min_price: fields.min_price ? Number.parseFloat(fields.min_price) : undefined,
      suggested_price: fields.suggested_price ? Number.parseFloat(fields.suggested_price) : undefined,
      max_price: fields.max_price ? Number.parseFloat(fields.max_price) : undefined,
      ad_title: fields.ad_title,
      ad_description: fields.ad_description,
      car_id: fields.car_id,
    };

    console.log('Dados processados:', partData);

    // Valida os dados da peça
    const validationResult = CreatePartSchema.safeParse(partData);
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

    console.log('Total de arquivos encontrados:', files.length);

    if (files.length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          type: 'no_file',
          message: 'Nenhuma imagem foi enviada.'
        }
      });
    }

    if (files.length > 5) {
      return reply.status(400).send({
        success: false,
        error: {
          type: 'too_many_files',
          message: 'Máximo de 5 imagens permitidas.'
        }
      });
    }

    // Processa os arquivos
    const processedImages = [];
    for (const file of files) {
      // Verifica o tipo de arquivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      console.log('Verificando tipo do arquivo:', file.filename, file.mimetype);
      
      if (!allowedTypes.includes(file.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: {
            type: 'invalid_format',
            message: 'Formato de arquivo inválido. Apenas JPEG, PNG e WEBP são aceitos.'
          }
        });
      }

      // Lê o arquivo do disco
      console.log('Lendo buffer do arquivo:', file.filename);
      const buffer = await file.toBuffer();
      console.log('Tamanho do buffer:', buffer.length);
      
      // Validação de tamanho (50MB)
      if (buffer.length > 52428800) {
        return reply.status(400).send({
          success: false,
          error: {
            type: 'file_too_large',
            message: 'Arquivo muito grande. Tamanho máximo: 50MB.'
          }
        });
      }

      processedImages.push({
        buffer,
        filename: file.filename
      });
    }

    console.log('Total de imagens processadas:', processedImages.length);

    // Chama o service para criar a peça
    const result = await partService.createPart(validationResult.data, processedImages);

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
    return reply.status(201).send({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        images: result.images,
        qrCode: result.qrCode
      }
    });

  } catch (error) {
    console.error('Erro no controller createPart:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

export async function getPartById(
  request: FastifyRequest<{ Params: { id: string } }>, 
  reply: FastifyReply
): Promise<PartResponse> {
  try {
    const { id } = request.params;

    console.log(`🔍 Buscando peça com ID: ${id}`);

    // Chama o service para buscar a peça
    const result = await partService.getPartById(id);

    // Verifica se houve erro no service
    if ('error' in result) {
      const statusCode = result.error === 'part_not_found' ? 404 : 500;
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
        name: result.name,
        description: result.description,
        condition: result.condition,
        stock_address: result.stock_address,
        dimensions: result.dimensions,
        weight: result.weight,
        compatibility: result.compatibility,
        min_price: result.min_price,
        suggested_price: result.suggested_price,
        max_price: result.max_price,
        ad_title: result.ad_title,
        ad_description: result.ad_description,
        images: result.images,
        created_at: result.created_at.toISOString(),
        updated_at: result.updated_at.toISOString(),
        car_id: result.car_id,
        car: result.car
      }
    });

  } catch (error) {
    console.error('Erro no controller getPartById:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

export async function getAllParts(
  request: FastifyRequest, 
  reply: FastifyReply
): Promise<PartResponse> {
  try {
    console.log('📋 Buscando todas as peças');

    // Chama o service para buscar todas as peças
    const result = await partService.getAllParts();

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
      car: part.car
    }));

    return reply.status(200).send({
      success: true,
      data: formattedParts
    });

  } catch (error) {
    console.error('Erro no controller getAllParts:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
} 