import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import * as partService from '../services/part.service';
import { CreatePartSchema, UpdatePartSchema, ProcessPartSchema } from '../schemas/part.schema';
import type { PartResponse, UpdatePartResponse, DeletePartResponse, ProcessPartResponse } from '../schemas/part.schema';
import * as imageService from '../services/image.service';
import * as storageService from '../services/storage.service';
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
    console.log('📱 Iniciando processamento da requisição...');
    
    // Timeout específico para iOS (pode ser mais lento)
    const startTime = Date.now();
    
    // DEBUG: Informações da requisição (mesmo que processPart)
    const userAgent = request.headers['user-agent'] || 'unknown';
    const contentType = request.headers['content-type'] || 'unknown';
    const contentLength = request.headers['content-length'] || 'unknown';
    
    // Detecção melhorada para iOS/Expo/React Native (mesmo que processPart)
    const isIOS = userAgent.toLowerCase().includes('ios') || 
                  userAgent.toLowerCase().includes('iphone') || 
                  userAgent.toLowerCase().includes('ipad');
    const isExpo = userAgent.includes('Expo/') || userAgent.includes('CFNetwork');
    const isReactNative = userAgent.includes('React Native') || isExpo;
    const isDarwin = userAgent.includes('Darwin/');
    
    // Considera iOS se for qualquer um destes
    const isMobileClient = isIOS || isExpo || isReactNative || isDarwin;
    
    console.log('📱 DEBUG - Informações da requisição createPart:');
    console.log(`   User-Agent: ${userAgent}`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Length: ${contentLength}`);
    console.log(`   iOS nativo detectado: ${isIOS}`);
    console.log(`   Expo detectado: ${isExpo}`);
    console.log(`   React Native detectado: ${isReactNative}`);
    console.log(`   Darwin detectado: ${isDarwin}`);
    console.log(`   Cliente mobile detectado: ${isMobileClient}`);
    
    // Função para verificar timeout específico do iOS
    const checkIOSTimeout = () => {
      const elapsed = Date.now() - startTime;
      const IOS_TIMEOUT = 120000; // 2 minutos
      if (elapsed > IOS_TIMEOUT) {
        throw new Error(`iOS timeout: processamento excedeu ${IOS_TIMEOUT/1000}s`);
      }
    };

    // Configurar headers para manter conexão viva com iOS
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Keep-Alive', 'timeout=65, max=1000');
    
    // Processa os campos do form e arquivos com tratamento melhorado para iOS
    const fields: FormFields = {};
    const files: MultipartFile[] = [];
    const parts = request.parts();
    
    console.log('🔄 Processando multipart/form-data...');
    let partCount = 0;
    
    // Timeout específico para clientes mobile (mesmo que processPart)
    const MOBILE_PART_TIMEOUT = isMobileClient ? 10000 : 20000; // 10s para mobile, 20s para outros
    const MOBILE_BUFFER_TIMEOUT = isMobileClient ? 15000 : 20000; // 15s para mobile, 20s para outros
    
    console.log(`⚙️ DEBUG - Timeouts createPart configurados para cliente mobile: ${isMobileClient}`);
    console.log(`   Part timeout: ${MOBILE_PART_TIMEOUT}ms`);
    console.log(`   Buffer timeout: ${MOBILE_BUFFER_TIMEOUT}ms`);
    
    try {
      // Timeout geral para todo o processamento multipart
      const multipartPromise = (async () => {
        for await (const part of parts) {
          partCount++;
          console.log(`🔄 DEBUG - Processando parte ${partCount}...`);
          checkIOSTimeout(); // Verifica timeout a cada parte processada
          
          if ('value' in part) {
            const value = part.value as string;
            console.log(`📝 Campo encontrado: ${part.fieldname} = ${value?.substring(0, 100)}${value && value.length > 100 ? '...' : ''}`);
            fields[part.fieldname as keyof FormFields] = value;
          } else if ('file' in part) {
            console.log('📁 Arquivo encontrado:', {
              fieldname: part.fieldname,
              filename: part.filename,
              mimetype: part.mimetype,
              encoding: part.encoding
            });
            
            // Para clientes mobile, processa o arquivo imediatamente para evitar timeout
            if (isMobileClient) {
              console.log(`📱 DEBUG - Cliente mobile detectado: processamento otimizado para ${part.filename}`);
              
              // Lê o buffer imediatamente com timeout reduzido
              try {
                console.log(`💾 DEBUG - Iniciando leitura buffer otimizada para mobile...`);
                const bufferStartTime = Date.now();
                
                const bufferPromise = part.toBuffer();
                const bufferTimeoutPromise = new Promise<never>((_, reject) => {
                  setTimeout(() => reject(new Error('Mobile buffer timeout')), MOBILE_BUFFER_TIMEOUT);
                });
                
                const buffer = await Promise.race([bufferPromise, bufferTimeoutPromise]);
                const bufferTime = Date.now() - bufferStartTime;
                
                console.log(`✅ DEBUG - Buffer mobile lido em ${bufferTime}ms, tamanho: ${buffer.length} bytes`);
                
                // Criar um objeto que simula o MultipartFile para compatibilidade
                const processedFile = {
                  ...part,
                  _buffer: buffer,
                  async toBuffer() { return buffer; }
                };
                
                files.push(processedFile as MultipartFile);
                
              } catch (error) {
                console.error(`❌ DEBUG - Erro ao ler buffer mobile para ${part.filename}:`, error);
                throw error;
              }
            } else {
              // Para outros clientes, adiciona normalmente
              files.push(part);
            }
          }
          
          // Log de progresso para manter conexão viva
          if (partCount % 3 === 0) { // Mais frequente para mobile
            console.log(`📦 Processadas ${partCount} partes...`);
          }
        }
      })();
      
      // Timeout específico para o processamento multipart completo
      const multipartTimeout = isMobileClient ? 30000 : 60000; // 30s para mobile, 60s para outros
      const multipartTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Multipart timeout')), multipartTimeout);
      });
      
      console.log(`⏱️ DEBUG - Iniciando processamento multipart com timeout de ${multipartTimeout}ms`);
      await Promise.race([multipartPromise, multipartTimeoutPromise]);
      
    } catch (error) {
      console.error('❌ Erro ao processar multipart data:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('iOS timeout') || error.message.includes('Mobile buffer timeout')) {
          console.log('📱 DEBUG - Timeout específico de cliente mobile detectado');
          return reply.status(408).send({
            success: false,
            error: {
              type: 'mobile_timeout_error',
              message: 'Timeout de upload para cliente mobile. Tente novamente com imagens menores.'
            }
          });
        }
        
        if (error.message.includes('Multipart timeout')) {
          console.log('📦 DEBUG - Timeout geral do multipart detectado');
          return reply.status(408).send({
            success: false,
            error: {
              type: 'multipart_timeout_error',
              message: 'Timeout no processamento do upload. Tente novamente.'
            }
          });
        }
        
        if (error.message.includes('aborted') || (error as any).code === 'ECONNRESET') {
          console.log('🔌 DEBUG - Conexão abortada pelo cliente (ECONNRESET)');
          return reply.status(408).send({
            success: false,
            error: {
              type: 'connection_aborted',
              message: 'Conexão interrompida durante upload. Verifique sua conexão e tente novamente.'
            }
          });
        }
      }
      
      return reply.status(400).send({
        success: false,
        error: {
          type: 'multipart_error',
          message: 'Erro ao processar dados do formulário. Tente novamente.'
        }
      });
    }
    
    console.log(`✅ Processamento completo: ${partCount} partes, ${files.length} arquivos, ${Object.keys(fields).length} campos`);

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

    // Processa os arquivos com otimizações para iOS
    const processedImages = [];
    
    console.log(`🔍 Iniciando validação de ${files.length} arquivos...`);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📁 Processando arquivo ${i + 1}/${files.length}: ${file.filename}`);
      
      // Verifica o tipo de arquivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      console.log(`🔍 Verificando tipo: ${file.mimetype}`);
      
      if (!allowedTypes.includes(file.mimetype)) {
        console.log(`❌ Tipo não permitido: ${file.mimetype}`);
        return reply.status(400).send({
          success: false,
          error: {
            type: 'invalid_format',
            message: `Formato de arquivo inválido: ${file.mimetype}. Apenas JPEG, PNG e WEBP são aceitos.`
          }
        });
      }

      try {
        // Lê o arquivo com timeout para iOS
        console.log(`💾 Convertendo arquivo para buffer: ${file.filename}`);
        const bufferStartTime = Date.now();
        
        let buffer: Buffer;
        
        // Para clientes mobile, o buffer já foi carregado durante o multipart
        if (isMobileClient && (file as any)._buffer) {
          console.log(`📱 DEBUG - Usando buffer pré-carregado para cliente mobile`);
          buffer = (file as any)._buffer;
        } else {
          // Para outros clientes, carrega o buffer normalmente
          const bufferPromise = file.toBuffer();
          const bufferTimeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout na conversão do arquivo')), 30000)
          );
          
          buffer = await Promise.race([bufferPromise, bufferTimeoutPromise]);
        }
        
        const bufferTime = Date.now() - bufferStartTime;
        console.log(`✅ Buffer criado em ${bufferTime}ms, tamanho: ${buffer.length} bytes`);
      
      // Validação de tamanho (50MB)
      if (buffer.length > 52428800) {
          console.log(`❌ Arquivo muito grande: ${buffer.length} bytes`);
        return reply.status(400).send({
          success: false,
          error: {
            type: 'file_too_large',
              message: `Arquivo muito grande: ${Math.round(buffer.length / 1024 / 1024)}MB. Tamanho máximo: 50MB.`
          }
        });
      }

      processedImages.push({
        buffer,
          filename: file.filename || `arquivo_${i + 1}`
        });
        
      } catch (error) {
        console.error(`❌ Erro ao processar arquivo ${file.filename}:`, error);
        
        if (error instanceof Error && error.message.includes('iOS timeout')) {
          return reply.status(408).send({
            success: false,
            error: {
              type: 'timeout_error',
              message: `Timeout ao processar arquivo ${file.filename}. Tente com imagens menores.`
            }
          });
        }
        
        return reply.status(400).send({
          success: false,
          error: {
            type: 'file_processing_error',
            message: `Erro ao processar arquivo ${file.filename}. Tente novamente com um arquivo menor.`
          }
      });
    }
    }
    
    console.log(`✅ Todos os ${processedImages.length} arquivos processados com sucesso`);

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
    
    // Configurações específicas para iOS
    const startTime = Date.now();
    const IOS_TIMEOUT = 120000; // 2 minutos - timeout mais conservador para iOS
    const HEARTBEAT_INTERVAL = 15000; // 15 segundos
    
    // DEBUG: Informações da requisição
    const userAgent = request.headers['user-agent'] || 'unknown';
    const contentType = request.headers['content-type'] || 'unknown';
    const contentLength = request.headers['content-length'] || 'unknown';
    
    // Detecção melhorada para iOS/Expo/React Native
    const isIOS = userAgent.toLowerCase().includes('ios') || 
                  userAgent.toLowerCase().includes('iphone') || 
                  userAgent.toLowerCase().includes('ipad');
    const isExpo = userAgent.includes('Expo/') || userAgent.includes('CFNetwork');
    const isReactNative = userAgent.includes('React Native') || isExpo;
    const isDarwin = userAgent.includes('Darwin/');
    
    // Considera iOS se for qualquer um destes
    const isMobileClient = isIOS || isExpo || isReactNative || isDarwin;
    
    console.log('📱 DEBUG - Informações da requisição:');
    console.log(`   User-Agent: ${userAgent}`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Length: ${contentLength}`);
    console.log(`   iOS nativo detectado: ${isIOS}`);
    console.log(`   Expo detectado: ${isExpo}`);
    console.log(`   React Native detectado: ${isReactNative}`);
    console.log(`   Darwin detectado: ${isDarwin}`);
    console.log(`   Cliente mobile detectado: ${isMobileClient}`);
    
    console.log('🔄 DEBUG - ETAPA 1/6: Iniciando processamento multipart...');
    
    // Função para verificar timeout específico do iOS
    const checkIOSTimeout = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > IOS_TIMEOUT) {
        throw new Error(`iOS timeout: processamento excedeu ${IOS_TIMEOUT/1000}s`);
      }
    };

    // Configurar headers para manter conexão viva com iOS
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Keep-Alive', 'timeout=65, max=1000');
    
    // Processa os campos do form e arquivos com timeout por parte
    const fields: ProcessFormFields = {};
    const files: MultipartFile[] = [];
    const parts = request.parts();
    
    let partCount = 0;
    let totalBytesReceived = 0;
    console.log('🔄 Processando multipart data...');
    const multipartStartTime = Date.now();
    
    // Timeout específico para clientes mobile (Expo/React Native)
    const MOBILE_PART_TIMEOUT = isMobileClient ? 10000 : 20000; // 10s para mobile, 20s para outros
    const MOBILE_BUFFER_TIMEOUT = isMobileClient ? 15000 : 20000; // 15s para mobile, 20s para outros
    
    console.log(`⚙️ DEBUG - Timeouts configurados para cliente mobile: ${isMobileClient}`);
    console.log(`   Part timeout: ${MOBILE_PART_TIMEOUT}ms`);
    console.log(`   Buffer timeout: ${MOBILE_BUFFER_TIMEOUT}ms`);
    
    try {
      // Timeout geral para todo o processamento multipart
      const multipartPromise = (async () => {
        for await (const part of parts) {
          partCount++;
          console.log(`🔄 DEBUG - Processando parte ${partCount}...`);
          checkIOSTimeout(); // Verifica timeout a cada parte processada
          
          if ('value' in part) {
            const value = part.value as string;
            console.log(`📝 Campo encontrado: ${part.fieldname} = ${value?.substring(0, 100)}${value && value.length > 100 ? '...' : ''}`);
            fields[part.fieldname as keyof ProcessFormFields] = value;
          } else if ('file' in part) {
            console.log('📁 Arquivo encontrado:', {
              fieldname: part.fieldname,
              filename: part.filename,
              mimetype: part.mimetype,
              encoding: part.encoding
            });
            
            // Para clientes mobile, processa o arquivo imediatamente para evitar timeout
            if (isMobileClient) {
              console.log(`📱 DEBUG - Cliente mobile detectado: processamento otimizado para ${part.filename}`);
              
              // Lê o buffer imediatamente com timeout reduzido
              try {
                console.log(`💾 DEBUG - Iniciando leitura buffer otimizada para mobile...`);
                const bufferStartTime = Date.now();
                
                const bufferPromise = part.toBuffer();
                const bufferTimeoutPromise = new Promise<never>((_, reject) => {
                  setTimeout(() => reject(new Error('Mobile buffer timeout')), MOBILE_BUFFER_TIMEOUT);
                });
                
                const buffer = await Promise.race([bufferPromise, bufferTimeoutPromise]);
                const bufferTime = Date.now() - bufferStartTime;
                
                console.log(`✅ DEBUG - Buffer mobile lido em ${bufferTime}ms, tamanho: ${buffer.length} bytes`);
                
                // Criar um objeto que simula o MultipartFile para compatibilidade
                const processedFile = {
                  ...part,
                  _buffer: buffer,
                  async toBuffer() { return buffer; }
                };
                
                files.push(processedFile as MultipartFile);
                
              } catch (error) {
                console.error(`❌ DEBUG - Erro ao ler buffer mobile para ${part.filename}:`, error);
                throw error;
              }
            } else {
              // Para outros clientes, adiciona normalmente
              files.push(part);
            }
          }
          
          // Log de progresso para manter conexão viva
          if (partCount % 3 === 0) { // Mais frequente para mobile
            console.log(`📦 Processadas ${partCount} partes...`);
          }
        }
      })();
      
      // Timeout específico para o processamento multipart completo
      const multipartTimeout = isMobileClient ? 30000 : 60000; // 30s para mobile, 60s para outros
      const multipartTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Multipart timeout')), multipartTimeout);
      });
      
      console.log(`⏱️ DEBUG - Iniciando processamento multipart com timeout de ${multipartTimeout}ms`);
      await Promise.race([multipartPromise, multipartTimeoutPromise]);
      
    } catch (error) {
      console.error('❌ Erro ao processar multipart data:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('iOS timeout') || error.message.includes('Mobile buffer timeout')) {
          console.log('📱 DEBUG - Timeout específico de cliente mobile detectado');
          return reply.status(408).send({
            success: false,
            error: {
              type: 'mobile_timeout_error',
              message: 'Timeout de upload para cliente mobile. Tente novamente com imagens menores.'
            }
          });
        }
        
        if (error.message.includes('Multipart timeout')) {
          console.log('📦 DEBUG - Timeout geral do multipart detectado');
          return reply.status(408).send({
            success: false,
            error: {
              type: 'multipart_timeout_error',
              message: 'Timeout no processamento do upload. Tente novamente.'
            }
          });
        }
        
        if (error.message.includes('aborted') || (error as any).code === 'ECONNRESET') {
          console.log('🔌 DEBUG - Conexão abortada pelo cliente (ECONNRESET)');
          return reply.status(408).send({
            success: false,
            error: {
              type: 'connection_aborted',
              message: 'Conexão interrompida durante upload. Verifique sua conexão e tente novamente.'
            }
          });
        }
      }
      
      return reply.status(400).send({
        success: false,
        error: {
          type: 'multipart_error',
          message: 'Erro ao processar dados do formulário. Tente novamente.'
        }
      });
    }

    const multipartTime = Date.now() - multipartStartTime;
    console.log(`⏱️ DEBUG - Multipart processado em: ${multipartTime}ms`);
    console.log(`📊 DEBUG - Total de arquivos recebidos: ${files.length}`);

    console.log('✅ DEBUG - ETAPA 1/6 COMPLETA: Multipart processado');
    console.log('🔄 DEBUG - ETAPA 2/6: Validando dados...');

    console.log('Campos recebidos:', fields);
    checkIOSTimeout();

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

    checkIOSTimeout();

    // Busca dados do veículo com timeout
    console.log(`🔍 Buscando veículo com ID interno: ${validationResult.data.vehicle_internal_id}`);
    const dbStartTime = Date.now();
    const vehiclePromise = prisma.car.findFirst({
      where: {
        OR: [
          { id: validationResult.data.vehicle_internal_id },
          { internal_id: validationResult.data.vehicle_internal_id }
        ]
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database timeout')), 10000);
    });

    const vehicle = await Promise.race([vehiclePromise, timeoutPromise]).catch(error => {
      if (error.message === 'Database timeout') {
        throw new Error('iOS timeout: consulta de veículo muito lenta');
      }
      throw error;
    });

    const dbTime = Date.now() - dbStartTime;
    console.log(`⏱️ DEBUG - Consulta DB executada em: ${dbTime}ms`);

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
    console.log('✅ DEBUG - ETAPA 2/6 COMPLETA: Dados validados');
    console.log('🔄 DEBUG - ETAPA 3/6: Processando arquivos de imagem...');
    checkIOSTimeout();

    // Processa as imagens com timeout individual por arquivo
    const processedImages: string[] = [];
    const imagesToUpload: Array<{ buffer: Buffer; filename: string }> = [];
    
    console.log('📸 Processando arquivos com timeout otimizado para iOS...');
    const fileProcessingStartTime = Date.now();
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📁 Processando arquivo ${i + 1}/${files.length}: ${file.filename}`);
      
      // DEBUG: Informações detalhadas do arquivo
      console.log(`🔍 DEBUG - Arquivo ${i + 1} detalhes:`);
      console.log(`   Nome: ${file.filename}`);
      console.log(`   Tipo MIME: ${file.mimetype}`);
      console.log(`   Encoding: ${file.encoding}`);
      console.log(`   Fieldname: ${file.fieldname}`);
      
      // Verificação do tipo de arquivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        console.log(`❌ DEBUG - Tipo não permitido: ${file.mimetype}`);
        return reply.status(400).send({
          success: false,
          error: {
            type: 'invalid_format',
            message: 'Formato de arquivo inválido. Apenas JPEG, PNG e WEBP são aceitos.'
          }
        });
      }

      try {
        // Lê o arquivo com timeout específico
        console.log(`💾 Convertendo arquivo para buffer: ${file.filename}`);
        const bufferStartTime = Date.now();
        
        let buffer: Buffer;
        
        // Para clientes mobile, o buffer já foi carregado durante o multipart
        if (isMobileClient && (file as any)._buffer) {
          console.log(`📱 DEBUG - Usando buffer pré-carregado para cliente mobile`);
          buffer = (file as any)._buffer;
        } else {
          // Para outros clientes, carrega o buffer normalmente
          const bufferPromise = file.toBuffer();
          const bufferTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('File buffer timeout')), MOBILE_BUFFER_TIMEOUT);
          });
          
          buffer = await Promise.race([bufferPromise, bufferTimeoutPromise]).catch(error => {
            if (error.message === 'File buffer timeout') {
              throw new Error(`iOS timeout: arquivo ${file.filename} muito lento para processar`);
            }
            throw error;
          });
        }
        
        const bufferTime = Date.now() - bufferStartTime;
        const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
        
        console.log(`✅ Buffer criado em ${bufferTime}ms`);
        console.log(`📏 DEBUG - Tamanho do arquivo: ${buffer.length} bytes (${fileSizeMB} MB)`);
        
        totalBytesReceived += buffer.length;
        
        // DEBUG: Análise do header do arquivo para detectar formato real
        const firstBytes = Array.from(buffer.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`🔍 DEBUG - Primeiros bytes (hex): ${firstBytes}`);
        
        // Detecta formato real pelos magic bytes
        let realFormat = 'unknown';
        if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
          realFormat = 'JPEG';
        } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
          realFormat = 'PNG';
        } else if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') {
          realFormat = 'WEBP';
        }
        
        console.log(`🎯 DEBUG - Formato detectado: ${realFormat} (MIME informado: ${file.mimetype})`);
        
        checkIOSTimeout();
      
        // Validação de tamanho (50MB)
        if (buffer.length > 52428800) {
          console.log(`❌ Arquivo muito grande: ${buffer.length} bytes (${fileSizeMB} MB)`);
          return reply.status(400).send({
            success: false,
            error: {
              type: 'file_too_large',
              message: `Arquivo muito grande: ${fileSizeMB}MB. Tamanho máximo: 50MB.`
            }
          });
        }

        // DEBUG: Tempo para converter para base64
        const base64StartTime = Date.now();
        const base64 = buffer.toString('base64');
        const base64Time = Date.now() - base64StartTime;
        const base64SizeMB = (base64.length / 1024 / 1024).toFixed(2);
        
        console.log(`🔤 DEBUG - Base64 gerado em ${base64Time}ms`);
        console.log(`📏 DEBUG - Tamanho base64: ${base64.length} chars (${base64SizeMB} MB)`);
        console.log(`📊 DEBUG - Aumento de tamanho: ${((base64.length / buffer.length - 1) * 100).toFixed(1)}%`);
        
        const dataUrl = `data:${file.mimetype};base64,${base64}`;
        processedImages.push(dataUrl);

        // Guarda para upload posterior
        imagesToUpload.push({
          buffer,
          filename: file.filename
        });
        
        console.log(`✅ Arquivo ${i + 1} processado com sucesso`);
        
      } catch (error) {
        console.error(`❌ Erro ao processar arquivo ${file.filename}:`, error);
        
        if (error instanceof Error && error.message.includes('iOS timeout')) {
          return reply.status(408).send({
            success: false,
            error: {
              type: 'timeout_error',
              message: `Timeout ao processar arquivo ${file.filename}. Tente com imagens menores.`
            }
          });
        }
        
        return reply.status(400).send({
          success: false,
          error: {
            type: 'file_processing_error',
            message: `Erro ao processar arquivo ${file.filename}. Tente novamente com um arquivo menor.`
          }
        });
      }
    }

    const fileProcessingTime = Date.now() - fileProcessingStartTime;
    const totalSizeMB = (totalBytesReceived / 1024 / 1024).toFixed(2);
    
    console.log(`⏱️ DEBUG - Processamento de arquivos completo em: ${fileProcessingTime}ms`);
    console.log(`📊 DEBUG - Total de bytes processados: ${totalBytesReceived} (${totalSizeMB} MB)`);
    console.log(`📊 DEBUG - Média de tamanho por arquivo: ${(totalBytesReceived / files.length / 1024 / 1024).toFixed(2)} MB`);

    console.log('✅ DEBUG - ETAPA 3/6 COMPLETA: Arquivos processados');
    console.log('🔄 DEBUG - ETAPA 4/6: Processando com IA...');
    checkIOSTimeout();

    // Processa com IA com timeout específico
    console.log('🤖 Enviando para processamento com IA (com timeout para iOS)...');
    const aiStartTime = Date.now();
    
    // DEBUG: Tamanho total das imagens que vão para IA
    const totalAIPayloadSize = processedImages.reduce((acc, img) => acc + img.length, 0);
    const aiPayloadSizeMB = (totalAIPayloadSize / 1024 / 1024).toFixed(2);
    console.log(`📤 DEBUG - Payload para IA: ${aiPayloadSizeMB} MB (${processedImages.length} imagens)`);
    
    const aiPromise = imageService.processPartWithAI(
      processedImages,
      validationResult.data.name,
      validationResult.data.description,
      vehicle.brand,
      vehicle.model,
      vehicle.year,
      true // includePrices = true para gerar preços com IA
    );

    const aiTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI processing timeout')), 45000); // 45s para IA
    });

    const aiResult = await Promise.race([aiPromise, aiTimeoutPromise]).catch(error => {
      if (error.message === 'AI processing timeout') {
        throw new Error('iOS timeout: processamento IA muito lento');
      }
      throw error;
    });

    const aiTime = Date.now() - aiStartTime;
    console.log(`⏱️ DEBUG - Processamento IA completo em: ${aiTime}ms`);

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
    console.log('✅ DEBUG - ETAPA 4/6 COMPLETA: IA processada');
    console.log('🔄 DEBUG - ETAPA 5/6: Removendo background das imagens...');
    checkIOSTimeout();

    // Processa as imagens (remove fundo) e converte para base64 com timeout por imagem
    console.log('🖼️ Processando imagens e removendo fundo...');
    const processedImagesBase64: string[] = [];
    const bgProcessingStartTime = Date.now();
    
    for (let i = 0; i < imagesToUpload.length; i++) {
      const { buffer, filename } = imagesToUpload[i];
      console.log(`🔄 Processando imagem ${i + 1}/${imagesToUpload.length}: ${filename}`);
      
      try {
        checkIOSTimeout();
        
        // Remove o fundo da imagem com timeout
        const bgRemovalStartTime = Date.now();
        console.log(`🎨 DEBUG - Iniciando remoção de fundo para ${filename}`);
        
        const bgRemovalPromise = storageService.removeBackground(buffer);
        const bgTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Background removal timeout')), 25000); // 25s por imagem
        });
        
        const backgroundRemovalResult = await Promise.race([bgRemovalPromise, bgTimeoutPromise]).catch(error => {
          if (error.message === 'Background removal timeout') {
            console.log(`⏰ Timeout na remoção de fundo para ${filename} - usando imagem original`);
            return { error: 'timeout', message: 'Timeout' };
          }
          throw error;
        });
        
        const bgRemovalTime = Date.now() - bgRemovalStartTime;
        console.log(`⏱️ DEBUG - Remoção de fundo para ${filename}: ${bgRemovalTime}ms`);
        
        let finalBuffer = buffer; // Imagem original como fallback
        
        if ('error' in backgroundRemovalResult) {
          console.log(`📝 Remove.bg não pôde processar ${filename} - usando original`);
        } else {
          finalBuffer = backgroundRemovalResult;
          const reductionPercent = ((1 - finalBuffer.length / buffer.length) * 100).toFixed(1);
          console.log(`✅ Fundo removido com sucesso para ${filename}`);
          console.log(`📏 DEBUG - Tamanho após remoção: ${finalBuffer.length} bytes (redução: ${reductionPercent}%)`);
        }
        
        // DEBUG: Tempo para converter imagem final para base64
        const finalBase64StartTime = Date.now();
        const base64 = finalBuffer.toString('base64');
        const finalBase64Time = Date.now() - finalBase64StartTime;
        const finalBase64SizeMB = (base64.length / 1024 / 1024).toFixed(2);
        
        console.log(`🔤 DEBUG - Base64 final gerado em ${finalBase64Time}ms (${finalBase64SizeMB} MB)`);
        
        const mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;
        
        processedImagesBase64.push(dataUrl);
        
      } catch (error) {
        console.error(`❌ Erro ao processar imagem ${filename}:`, error);
        
        if (error instanceof Error && error.message.includes('iOS timeout')) {
          return reply.status(408).send({
            success: false,
            error: {
              type: 'timeout_error',
              message: `Timeout ao processar imagem ${filename}. Tente novamente.`
            }
          });
        }
        
        // Em caso de erro, usa a imagem original em base64
        const base64 = buffer.toString('base64');
        const mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64}`;
        processedImagesBase64.push(dataUrl);
        console.log(`⚠️ Usando imagem original para ${filename} devido a erro no processamento`);
      }
    }

    const bgProcessingTime = Date.now() - bgProcessingStartTime;
    console.log(`⏱️ DEBUG - Processamento de background completo em: ${bgProcessingTime}ms`);

    console.log('✅ DEBUG - ETAPA 5/6 COMPLETA: Background processado');
    console.log('🔄 DEBUG - ETAPA 6/6: Montando resposta final...');

    // DEBUG: Análise da resposta final
    const totalTime = Date.now() - startTime;
    const finalResponseSize = processedImagesBase64.reduce((acc, img) => acc + img.length, 0);
    const finalResponseSizeMB = (finalResponseSize / 1024 / 1024).toFixed(2);
    
    console.log(`🏁 DEBUG - RESUMO FINAL:`);
    console.log(`   ⏱️ Tempo total: ${totalTime}ms`);
    console.log(`   📥 Bytes recebidos: ${totalBytesReceived} (${totalSizeMB} MB)`);
    console.log(`   📤 Bytes na resposta: ${finalResponseSize} (${finalResponseSizeMB} MB)`);
    console.log(`   📊 Aumento total: ${((finalResponseSize / totalBytesReceived - 1) * 100).toFixed(1)}%`);
    console.log(`   🖼️ Imagens processadas: ${processedImagesBase64.length}`);
    console.log(`   ⚡ Média por imagem: ${(totalTime / files.length).toFixed(0)}ms`);
    console.log(`   💾 Tamanho médio resposta por imagem: ${(finalResponseSize / processedImagesBase64.length / 1024 / 1024).toFixed(2)} MB`);

    console.log(`✅ ${processedImagesBase64.length} imagens processadas em ${totalTime}ms`);
    console.log('🎉 DEBUG - ETAPA 6/6 COMPLETA: Resposta montada com sucesso!');

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
        prices: 'prices' in aiResult ? aiResult.prices : undefined
      }
    });

  } catch (error) {
    console.error('Erro no controller processPart:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    
    // Tratamento específico para timeouts do iOS
    if (error instanceof Error && error.message.includes('iOS timeout')) {
      return reply.status(408).send({
        success: false,
        error: {
          type: 'timeout_error',
          message: 'Processamento muito longo para iOS. Tente novamente com imagens menores ou menos imagens.'
        }
      });
    }
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

export async function searchPartsByName(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const query = request.query as { name?: string };
    const { name } = query;

    // Validação do parâmetro de busca
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Parâmetro de busca "name" é obrigatório e deve ser uma string não vazia.'
        }
      });
    }

    // Chama o service para buscar as peças
    const result = await partService.searchPartsByName(name.trim());

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
      data: result
    });

  } catch (error) {
    console.error('Erro no controller searchPartsByName:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
} 