import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import * as partService from '../services/part.service';
import { CreatePartSchema, UpdatePartSchema, ProcessPartSchema } from '../schemas/part.schema';
import type { PartResponse, UpdatePartResponse, DeletePartResponse, ProcessPartResponse } from '../schemas/part.schema';
import * as imageService from '../services/image.service';
import * as storageService from '../services/storage.service';
import * as mercadoLivreService from '../services/mercadolivre.service';
import { PrismaClient } from '../../generated/prisma';

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
        images: result.images
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

export async function updatePart(
  request: FastifyRequest<{ Params: { id: string } }>, 
  reply: FastifyReply
): Promise<UpdatePartResponse> {
  try {
    const { id } = request.params;
    console.log(`✏️ Atualizando peça com ID: ${id}`);

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

    // Prepara os dados para validação (apenas os campos fornecidos)
    const partData: Record<string, unknown> = {};
    
    if (fields.name) partData.name = fields.name;
    if (fields.description) partData.description = fields.description;
    if (fields.condition) partData.condition = fields.condition;
    if (fields.stock_address) partData.stock_address = fields.stock_address;
    if (fields.dimensions) partData.dimensions = JSON.parse(fields.dimensions);
    if (fields.weight) partData.weight = Number.parseFloat(fields.weight);
    if (fields.compatibility) partData.compatibility = JSON.parse(fields.compatibility);
    if (fields.min_price) partData.min_price = Number.parseFloat(fields.min_price);
    if (fields.suggested_price) partData.suggested_price = Number.parseFloat(fields.suggested_price);
    if (fields.max_price) partData.max_price = Number.parseFloat(fields.max_price);
    if (fields.ad_title) partData.ad_title = fields.ad_title;
    if (fields.ad_description) partData.ad_description = fields.ad_description;
    if (fields.car_id) partData.car_id = fields.car_id;

    console.log('Dados processados:', partData);

    // Valida os dados da peça
    const validationResult = UpdatePartSchema.safeParse(partData);
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

    // Processa imagens se fornecidas
    let processedImages: Array<{ buffer: Buffer; filename: string }> | undefined;
    
    if (files.length > 0) {
      console.log('Total de arquivos encontrados:', files.length);

      if (files.length > 5) {
        return reply.status(400).send({
          success: false,
          error: {
            type: 'too_many_files',
            message: 'Máximo de 5 imagens permitidas.'
          }
        });
      }

      processedImages = [];
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
    }

    // Chama o service para atualizar a peça
    const result = await partService.updatePart(id, validationResult.data, processedImages);

    // Verifica se houve erro no service
    if ('error' in result) {
      const statusCode = result.error === 'part_not_found' ? 404 :
                        result.error === 'car_not_found' ? 404 : 500;
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
        updated_at: result.updated_at.toISOString(),
        car_id: result.car_id,
        car: result.car
      }
    });

  } catch (error) {
    console.error('Erro no controller updatePart:', error);
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

export async function deletePart(
  request: FastifyRequest<{ Params: { id: string } }>, 
  reply: FastifyReply
): Promise<DeletePartResponse> {
  try {
    const { id } = request.params;
    console.log(`🗑️ Deletando peça com ID: ${id}`);

    // Chama o service para deletar a peça
    const result = await partService.deletePart(id);

    // Verifica se houve erro no service
    if (result !== true) {
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
      message: 'Peça deletada com sucesso.'
    });

  } catch (error) {
    console.error('Erro no controller deletePart:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

const prisma = new PrismaClient();

interface ProcessFormFields {
  name?: string;
  description?: string;
  vehicle_internal_id?: string;
}

export async function processPart(
  request: FastifyRequest, 
  reply: FastifyReply
): Promise<ProcessPartResponse> {
  try {
    console.log('🚀 Iniciando processamento completo da peça...');
    
    // Processa os campos do form e arquivos
    const fields: ProcessFormFields = {};
    const files: MultipartFile[] = [];
    const parts = request.parts();
    
    for await (const part of parts) {
      if ('value' in part) {
        console.log('Campo encontrado:', part.fieldname);
        fields[part.fieldname as keyof ProcessFormFields] = part.value as string;
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

    console.log('Campos recebidos:', fields);

    // Prepara os dados para validação
    const processData = {
      name: fields.name,
      description: fields.description,
      vehicle_internal_id: fields.vehicle_internal_id,
    };

    // Valida os dados
    const validationResult = ProcessPartSchema.safeParse(processData);
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

    // Busca dados do veículo
    console.log(`🔍 Buscando veículo com ID interno: ${validationResult.data.vehicle_internal_id}`);
    const vehicle = await prisma.car.findFirst({
      where: {
        OR: [
          { id: validationResult.data.vehicle_internal_id },
          { internal_id: validationResult.data.vehicle_internal_id }
        ]
      }
    });

    if (!vehicle) {
      return reply.status(404).send({
        success: false,
        error: {
          type: 'vehicle_not_found',
          message: 'Veículo não encontrado.'
        }
      });
    }

    console.log(`✅ Veículo encontrado: ${vehicle.brand} ${vehicle.model} ${vehicle.year}`);

    // Processa as imagens
    const processedImages: string[] = [];
    const imagesToUpload: Array<{ buffer: Buffer; filename: string }> = [];
    
    for (const file of files) {
      // Verificação do tipo de arquivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: {
            type: 'invalid_format',
            message: 'Formato de arquivo inválido. Apenas JPEG, PNG e WEBP são aceitos.'
          }
        });
      }

      // Lê o arquivo
      const buffer = await file.toBuffer();
      console.log(`📏 Arquivo ${file.filename}: ${buffer.length} bytes`);
      
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

      // Converte para base64 para enviar para IA
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${file.mimetype};base64,${base64}`;
      processedImages.push(dataUrl);

      // Guarda para upload posterior
      imagesToUpload.push({
        buffer,
        filename: file.filename
      });
    }

    // Processa com IA para gerar informações completas
    console.log('🤖 Enviando para processamento com IA...');
    const aiResult = await imageService.processPartWithAI(
      processedImages,
      validationResult.data.name,
      validationResult.data.description,
      vehicle.brand,
      vehicle.model,
      vehicle.year
    );

    // Verifica se houve erro no processamento IA
    if ('error' in aiResult) {
      console.log('❌ Erro no processamento IA:', aiResult.error, aiResult.message);
      return reply.status(400).send({
        success: false,
        error: {
          type: aiResult.error,
          message: aiResult.message
        }
      });
    }

    console.log('✅ Processamento IA concluído com sucesso');

    // Busca preços reais no Mercado Livre - OBRIGATÓRIO
    console.log('💰 Buscando preços no Mercado Livre...');
    const priceResult = await mercadoLivreService.getPriceSuggestions(
      validationResult.data.name,
      vehicle.brand,
      vehicle.model,
      vehicle.year,
      'used' // Assumindo peças usadas por padrão
    );

    if ('error' in priceResult) {
      console.error(`❌ Falha ao buscar preços no Mercado Livre: ${priceResult.message}`);
      return reply.status(400).send({
        success: false,
        error: {
          type: 'mercadolivre_error',
          message: `Erro ao obter preços: ${priceResult.message}. Verifique se as credenciais do MercadoLivre estão configuradas corretamente.`
        }
      });
    }

    const prices = priceResult;
    console.log(`✅ Preços encontrados no Mercado Livre: R$ ${prices.min_price} - R$ ${prices.max_price}`);

    // Processa as imagens (remove fundo) e converte para base64
    console.log('🖼️ Processando imagens e removendo fundo...');
    const processedImagesBase64: string[] = [];
    
    for (let i = 0; i < imagesToUpload.length; i++) {
      const { buffer, filename } = imagesToUpload[i];
      console.log(`🔄 Processando imagem ${i + 1}/${imagesToUpload.length}: ${filename}`);
      
      // Remove o fundo da imagem
      const backgroundRemovalResult = await storageService.removeBackground(buffer);
      
      let finalBuffer = buffer; // Imagem original como fallback
      
      if ('error' in backgroundRemovalResult) {
        console.log(`📝 Remove.bg não pôde processar ${filename} (normal para imagens pequenas) - usando original`);
      } else {
        finalBuffer = backgroundRemovalResult;
        console.log(`✅ Fundo removido com sucesso para ${filename}`);
      }
      
      // Converte para base64
      const base64 = finalBuffer.toString('base64');
      const mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      processedImagesBase64.push(dataUrl);
    }

    console.log(`✅ ${processedImagesBase64.length} imagens processadas e convertidas para base64`);

    // Resposta de sucesso
    return reply.status(200).send({
      success: true,
      data: {
        processed_images: processedImagesBase64,
        ad_title: aiResult.ad_title,
        ad_description: aiResult.ad_description,
        dimensions: aiResult.dimensions,
        weight: aiResult.weight,
        compatibility: aiResult.compatibility,
        prices: prices
      }
    });

  } catch (error) {
    console.error('Erro no controller processPart:', error);
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