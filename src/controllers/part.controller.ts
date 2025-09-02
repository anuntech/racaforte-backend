import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import * as partService from '../services/part.service.js';
import { CreatePartSchema, UpdatePartSchema, ProcessPartSchema, SearchPartCriteriaSchema } from '../schemas/part.schema.js';
import type { PartResponse, UpdatePartResponse, DeletePartResponse, ProcessPartResponse, SearchPartCriteriaRequest } from '../schemas/part.schema.js';
import type { PartCreationResult, ServiceError } from '../services/part.service.js';

import * as grokService from '../services/grok.service.js';
import { unwrangleService } from '../services/unwrangle.service.js';
import { generateStandardAdTitle } from '../utils/title-generator.js';
import * as storageService from '../services/storage.service.js';
import { PrismaClient } from '../../generated/prisma/index.js';

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
  s3_image_urls?: string; // JSON string com array de URLs S3
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
    
    // Detecção simplificada: se não é desktop/servidor, é mobile
    const isIOS = userAgent.toLowerCase().includes('ios') || 
                  userAgent.toLowerCase().includes('iphone') || 
                  userAgent.toLowerCase().includes('ipad');
    const isDesktop = userAgent.toLowerCase().includes('windows') || 
                      userAgent.toLowerCase().includes('linux') || 
                      userAgent.toLowerCase().includes('macintosh') ||
                      userAgent.toLowerCase().includes('x11');
    const isServer = userAgent.toLowerCase().includes('postman') ||
                     userAgent.toLowerCase().includes('insomnia') ||
                     userAgent.toLowerCase().includes('curl') ||
                     userAgent.toLowerCase().includes('wget');
    
    // Se não é desktop nem servidor, assume que é mobile (Android/iOS)
    const isMobileClient = !isDesktop && !isServer;
    
    console.log('📱 DEBUG - Informações da requisição createPart:');
    console.log(`   User-Agent: ${userAgent}`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Length: ${contentLength}`);
    console.log(`   iOS detectado: ${isIOS}`);
    console.log(`   Desktop detectado: ${isDesktop}`);
    console.log(`   Servidor/API tool detectado: ${isServer}`);
    console.log(`   Cliente mobile detectado: ${isMobileClient} (lógica: !desktop && !server)`);
    
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
    
    // Timeout específico para clientes mobile (mesmo que processPart) - Aumentado para produção
    const MOBILE_PART_TIMEOUT = isMobileClient ? 30000 : 60000; // 30s para mobile, 60s para outros
    const MOBILE_BUFFER_TIMEOUT = isMobileClient ? 60000 : 90000; // 60s para mobile, 90s para outros
    
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
            
            console.log(`🔍 DEBUG - Verificando tipo de cliente: isMobileClient = ${isMobileClient}`);
            
            // Para clientes mobile, processa o arquivo imediatamente para evitar timeout
            if (isMobileClient) {
                              console.log('📱 DEBUG - Cliente mobile detectado: processamento otimizado para', part.filename);
              
              // Lê o buffer imediatamente com timeout reduzido
              try {
                console.log('💾 DEBUG - Iniciando leitura buffer otimizada para mobile...');
                const bufferStartTime = Date.now();
                
                console.log('⏱️ DEBUG - Criando promise de buffer...');
                const bufferPromise = part.toBuffer();
                const bufferTimeoutPromise = new Promise<never>((_, reject) => {
                  setTimeout(() => reject(new Error('Mobile buffer timeout')), MOBILE_BUFFER_TIMEOUT);
                });
                
                console.log(`🏁 DEBUG - Iniciando Promise.race com timeout de ${MOBILE_BUFFER_TIMEOUT}ms...`);
                const buffer = await Promise.race([bufferPromise, bufferTimeoutPromise]);
                const bufferTime = Date.now() - bufferStartTime;
                console.log(`🎯 DEBUG - Promise.race concluído em ${bufferTime}ms`);
                
                console.log(`✅ DEBUG - Buffer mobile lido em ${bufferTime}ms, tamanho: ${buffer.length} bytes`);
                
                console.log('🏗️ DEBUG - Criando processedFile para mobile...');
                // Criar um objeto que simula o MultipartFile para compatibilidade
                const processedFile = {
                  ...part,
                  _buffer: buffer,
                  async toBuffer() { return buffer; }
                };
                
                console.log('📋 DEBUG - Adicionando arquivo mobile ao array files...');
                files.push(processedFile as MultipartFile);
                console.log(`✅ DEBUG - Arquivo mobile adicionado com sucesso. Total de arquivos: ${files.length}`);
                
              } catch (error) {
                console.error('❌ DEBUG - Erro ao ler buffer mobile para', part.filename, ':', error);
                throw error;
              }
            } else {
              console.log('🖥️ DEBUG - Cliente não-mobile detectado: adicionando arquivo diretamente');
              // Para outros clientes, adiciona normalmente
              files.push(part);
              console.log(`✅ DEBUG - Arquivo não-mobile adicionado. Total de arquivos: ${files.length}`);
            }
            
            console.log('🔚 DEBUG - Finalizando processamento do arquivo', part.filename);
          } else {
            console.log(`❓ DEBUG - Part não é field nem file: ${JSON.stringify(part)}`);
          }
          
          // Log de progresso para manter conexão viva
          if (partCount % 3 === 0) { // Mais frequente para mobile
            console.log(`📦 Processadas ${partCount} partes...`);
          }
          
          console.log(`➡️ DEBUG - Finalizada parte ${partCount}, indo para próxima...`);
        }
        
        console.log(`🏁 DEBUG - Loop multipart finalizado. Total de partes processadas: ${partCount}`);
        console.log(`📊 DEBUG - Resumo: ${Object.keys(fields).length} campos, ${files.length} arquivos`);
      })();
      
      // Timeout específico para o processamento multipart completo - Aumentado para produção
      const multipartTimeout = isMobileClient ? 120000 : 180000; // 120s para mobile, 180s para outros
      const multipartTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Multipart timeout')), multipartTimeout);
      });
      
      console.log(`⏱️ DEBUG - Iniciando processamento multipart com timeout de ${multipartTimeout}ms`);
      await Promise.race([multipartPromise, multipartTimeoutPromise]);
      console.log('✅ DEBUG - Promise.race do multipart concluído com sucesso!');
      
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
        
        if (error.message.includes('aborted') || (error as { code?: string }).code === 'ECONNRESET') {
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
      s3_image_urls: fields.s3_image_urls ? JSON.parse(fields.s3_image_urls) : undefined,
    };

    console.log('Dados processados:', partData);

    console.log('🔍 DEBUG - Iniciando validação dos dados da peça...');
    // Valida os dados da peça
    const validationResult = CreatePartSchema.safeParse(partData);
    console.log('🎯 DEBUG - Validação concluída. Sucesso:', validationResult.success);
    
    if (!validationResult.success) {
      console.log('❌ DEBUG - Erro de validação:', validationResult.error.errors);
      const firstError = validationResult.error.errors[0];
      return reply.status(400).send({
        success: false,
        error: {
          type: 'validation_error',
          message: firstError.message
        }
      });
    }

    console.log('📊 DEBUG - Total de arquivos encontrados:', files.length);
    console.log('📊 DEBUG - URLs S3 fornecidas:', validationResult.data.s3_image_urls?.length || 0);

    // Verifica se tem imagens (arquivos OU URLs S3)
    const hasFiles = files.length > 0;
    const hasS3Urls = validationResult.data.s3_image_urls && validationResult.data.s3_image_urls.length > 0;

    console.log('🔍 DEBUG - Verificando se tem imagens (arquivos ou URLs S3)...');
    if (!hasFiles && !hasS3Urls) {
      console.log('ℹ️ DEBUG - Nenhuma imagem encontrada - criando peça sem imagens');
      // Não retorna erro mais - imagens são opcionais agora
    }

    // Verifica se está tentando usar ambos os métodos ao mesmo tempo
    if (hasFiles && hasS3Urls) {
      console.log('❌ DEBUG - Tentando usar arquivos E URLs S3 ao mesmo tempo');
      return reply.status(400).send({
        success: false,
        error: {
          type: 'mixed_image_methods',
          message: 'Escolha apenas um método: envie arquivos OU forneça URLs S3, não ambos.'
        }
      });
    }

    // Verifica limite de imagens apenas se houver imagens
    const totalImages = hasFiles ? files.length : (validationResult.data.s3_image_urls?.length || 0);
    if (totalImages > 5) {
      console.log('❌ DEBUG - Muitas imagens:', totalImages);
      return reply.status(400).send({
        success: false,
        error: {
          type: 'too_many_images',
          message: 'Máximo de 5 imagens permitidas.'
        }
      });
    }

    console.log('✅ DEBUG - Quantidade de imagens válida, iniciando processamento...');
    
    let finalImageUrls: string[] = [];
    let uploadResult: PartCreationResult | ServiceError | undefined;

    if (hasS3Urls) {
      // Caso 1: URLs S3 diretas (skip upload)
      console.log('📋 DEBUG - Usando URLs S3 diretas, pulando upload...');
      finalImageUrls = validationResult.data.s3_image_urls || [];
      console.log('✅ DEBUG - URLs S3 validadas:', finalImageUrls);
    } else if (hasFiles) {
      // Caso 2: Upload de arquivos (comportamento original)
      console.log('📁 DEBUG - Processando upload de arquivos...');
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
        const fileWithBuffer = file as MultipartFile & { _buffer?: Buffer };
        if (isMobileClient && fileWithBuffer._buffer) {
          console.log('📱 DEBUG - Usando buffer pré-carregado para cliente mobile');
          buffer = fileWithBuffer._buffer;
        } else {
          console.log('🖥️ DEBUG - Cliente não-mobile ou sem buffer pré-carregado, chamando file.toBuffer()...');
          console.log(`🔍 DEBUG - isMobileClient: ${isMobileClient}, tem _buffer: ${!!fileWithBuffer._buffer}`);
          // Para outros clientes, carrega o buffer normalmente
          console.log('⏱️ DEBUG - Iniciando file.toBuffer()...');
          const bufferPromise = file.toBuffer();
          const bufferTimeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout na conversão do arquivo')), 30000)
          );
          
          buffer = await Promise.race([bufferPromise, bufferTimeoutPromise]);
          console.log('✅ DEBUG - file.toBuffer() concluído com sucesso!');
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

      // Chama o service para fazer upload e obter URLs
      uploadResult = await partService.createPart(
        validationResult.data, 
        processedImages.length > 0 ? processedImages : undefined
      );
      
      // Verifica se houve erro no service de upload
      if ('error' in uploadResult) {
        const statusCode = uploadResult.error === 'car_not_found' ? 404 : 500;
        return reply.status(statusCode).send({
          success: false,
          error: {
            type: uploadResult.error,
            message: uploadResult.message
          }
        });
      }

      finalImageUrls = uploadResult.images;
    } else {
      // Caso 3: Sem imagens (novo - imagens opcionais)
      console.log('📝 DEBUG - Criando peça sem imagens...');
      finalImageUrls = [];
    }

    // Cria a peça no banco dependendo do método usado
    let finalResult: PartCreationResult | ServiceError;
    if (hasS3Urls) {
      console.log('💾 DEBUG - Criando peça no banco com URLs S3 diretas...');
      finalResult = await partService.createPartWithS3Urls(validationResult.data, finalImageUrls);
    } else if (hasFiles) {
      // Para uploads, o resultado já foi obtido acima
      if (!uploadResult) {
        return reply.status(500).send({
          success: false,
          error: {
            type: 'internal_error',
            message: 'Erro interno: resultado do upload não encontrado.'
          }
        });
      }
      finalResult = uploadResult;
    } else {
      // Sem imagens - criar peça diretamente
      console.log('💾 DEBUG - Criando peça no banco sem imagens...');
      finalResult = await partService.createPart(validationResult.data, undefined);
    }

    // Verifica se houve erro no service
    if ('error' in finalResult) {
      const statusCode = finalResult.error === 'car_not_found' ? 404 : 500;
      return reply.status(statusCode).send({
        success: false,
        error: {
          type: finalResult.error,
          message: finalResult.message
        }
      });
    }

    // Resposta de sucesso
    return reply.status(201).send({
      success: true,
      data: {
        id: finalResult.id,
        name: finalResult.name,
        images: finalResult.images
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
    const requestId = Math.random().toString(36).substring(2, 8);
    console.log(`🚀 [${requestId}] Iniciando processamento de dados da peça...`);
    console.log(`🔍 [${requestId}] DEBUG - Headers da requisição:`, JSON.stringify(request.headers, null, 2));
    console.log(`🔍 [${requestId}] DEBUG - IP do cliente:`, request.ip);
    console.log(`🔍 [${requestId}] DEBUG - Método:`, request.method);
    console.log(`🔍 [${requestId}] DEBUG - URL:`, request.url);
    
    const startTime = Date.now();
    
    // DEBUG: Informações da requisição
    const userAgent = request.headers['user-agent'] || 'unknown';
    const contentType = request.headers['content-type'] || 'unknown';
    
    console.log(`📱 [${requestId}] DEBUG - Informações da requisição:`);
    console.log('   User-Agent:', userAgent);
    console.log('   Content-Type:', contentType);
    
    console.log(`🔄 [${requestId}] DEBUG - ETAPA 1/3: Validando dados de entrada...`);

    // Obtém dados do corpo da requisição (JSON)
    const requestBody = request.body as Record<string, unknown>;
    console.log(`📝 [${requestId}] Dados recebidos:`, requestBody);

    // Prepara os dados para validação
    const processData = {
      name: requestBody.name,
      description: requestBody.description,
      vehicle_internal_id: requestBody.vehicle_internal_id,
    };

    // Valida os dados usando o schema existente
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

    console.log('✅ DEBUG - ETAPA 1/3 COMPLETA: Dados validados');
    console.log('🔄 DEBUG - ETAPA 2/3: Buscando dados do veículo...');

    // Busca dados do veículo
    console.log(`🔍 Buscando veículo com ID interno: ${validationResult.data.vehicle_internal_id}`);
    const dbStartTime = Date.now();
    
    const vehicle = await prisma.car.findFirst({
      where: {
        OR: [
          { id: validationResult.data.vehicle_internal_id },
          { internal_id: validationResult.data.vehicle_internal_id }
        ]
      }
    });

    const dbTime = Date.now() - dbStartTime;
    console.log(`⏱️ DEBUG - Consulta banco completa em: ${dbTime}ms`);

    if (!vehicle) {
      console.log('❌ Veículo não encontrado:', validationResult.data.vehicle_internal_id);
      return reply.status(404).send({
        success: false,
        error: {
          type: 'vehicle_not_found',
          message: 'Veículo não encontrado com o ID fornecido.'
        }
      });
    }

    console.log('✅ Veículo encontrado:', vehicle.brand, vehicle.model, vehicle.year);
    console.log('✅ DEBUG - ETAPA 2/3 COMPLETA: Veículo localizado');
    console.log('🔄 DEBUG - ETAPA 3/3: Processando com IA...');

    // Processa com IA usando apenas dados textuais
    console.log('🤖 Enviando para processamento com IA (Grok + Live Search)...');
    const aiStartTime = Date.now();
    
    const aiResult = await grokService.processPartWithGrok(
      validationResult.data.name,
      validationResult.data.description,
      vehicle.brand,
      vehicle.model,
      vehicle.year
    );

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
    console.log('✅ DEBUG - ETAPA 3/3 COMPLETA: IA processada');
    console.log('🔄 DEBUG - Gerando título padronizado...');

    // Gera título padronizado seguindo o padrão do site
    const standardTitle = generateStandardAdTitle(
      validationResult.data.name,
      vehicle.brand,
      vehicle.model,
      aiResult.compatibility
    );
    
    console.log('📝 DEBUG - Título padronizado:', standardTitle);

    // DEBUG: Análise da resposta final
    const totalTime = Date.now() - startTime;
    
    console.log('🏁 DEBUG - RESUMO FINAL:');
    console.log('   ⏱️ Tempo total:', totalTime, 'ms');
    console.log('   📊 Tempo DB:', dbTime, 'ms');
    console.log('   🤖 Tempo IA:', aiTime, 'ms');
    console.log('   ⚡ Performance: ALTA (sem processamento de imagens)');

    console.log(`✅ Processamento de dados completo em ${totalTime}ms`);
    console.log('🎉 DEBUG - Processamento concluído com sucesso!');

    // Resposta de sucesso (com título padronizado)
    const responseData: Record<string, unknown> = {
      ad_title: standardTitle, // Usando título padronizado ao invés do da IA
      ad_description: aiResult.ad_description,
      dimensions: aiResult.dimensions,
      weight: aiResult.weight,
      compatibility: aiResult.compatibility,
      prices: aiResult.prices
    };

    // Adiciona anúncios se encontrados pelo webscraping + AI
    if ('ads' in aiResult && aiResult.ads && Array.isArray(aiResult.ads) && aiResult.ads.length > 0) {
      responseData.ads = aiResult.ads;
      console.log(`🔗 [Response] Incluindo ${aiResult.ads.length} anúncios filtrados pela AI na resposta`);
    } else {
      // Sempre incluir o campo ads, mesmo que vazio
      responseData.ads = [];
      console.log('🔗 [Response] Nenhum anúncio relevante encontrado - incluindo array vazio');
    }

    return reply.status(200).send({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Erro no controller processPart:', error);
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

export async function searchPartByCriteria(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<PartResponse> {
  try {
    console.log('🔍 Buscando peça por critérios específicos...');

    // Obtém dados do corpo da requisição
    const requestBody = request.body as SearchPartCriteriaRequest;
    console.log('📝 Dados recebidos:', requestBody);

    // Valida os dados usando o schema
    const validationResult = SearchPartCriteriaSchema.safeParse(requestBody);
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

    const { vehicle_internal_id, partName, partDescription } = validationResult.data;

    console.log(`🔍 Buscando peça: ${partName} no veículo: ${vehicle_internal_id}`);

    // Chama o service para buscar a peça
    const result = await partService.searchPartByCriteria(
      vehicle_internal_id,
      partName,
      partDescription
    );

    // Verifica se houve erro no service
    if ('error' in result) {
      const statusCode = result.error === 'car_not_found' ? 404 :
                        result.error === 'part_not_found' ? 404 : 500;
      return reply.status(statusCode).send({
        success: false,
        error: {
          type: result.error,
          message: result.message
        }
      });
    }

    console.log(`✅ Peça encontrada: ${result.name} (ID: ${result.id})`);

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
    console.error('Erro no controller searchPartByCriteria:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
}

// Interface for webscrape test request
interface WebscrapeTestRequest {
  search_term: string;
  page?: number;
}

/**
 * Test endpoint for Unwrangle API webscraping functionality
 */
export async function testWebscrape(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const requestId = Math.random().toString(36).substring(2, 8);
    console.log(`🧪 [${requestId}] Testing Unwrangle API webscraping...`);
    
    const requestBody = request.body as WebscrapeTestRequest;
    const { search_term, page = 1 } = requestBody;
    
    if (!search_term || search_term.trim().length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Search term is required'
        }
      });
    }
    
    console.log(`🔍 [${requestId}] Searching for: "${search_term}" (page ${page})`);
    const startTime = Date.now();
    
    const result = await unwrangleService.searchMercadoLivre(search_term, page);
    const responseTime = Date.now() - startTime;
    
    if ('error' in result) {
      console.log(`❌ [${requestId}] Webscrape failed:`, result.error, result.message);
      return reply.status(400).send({
        success: false,
        error: {
          type: result.error,
          message: result.message
        }
      });
    }
    
    console.log(`✅ [${requestId}] Webscrape completed in ${responseTime}ms`);
    console.log(`📊 [${requestId}] Results: ${result.result_count} items found (${result.total_results} total)`);
    console.log(`💳 [${requestId}] Credits: ${result.credits_used} used, ${result.remaining_credits} remaining`);
    
    return reply.status(200).send({
      success: true,
      data: {
        platform: result.platform,
        search: result.search,
        page: result.page,
        total_results: result.total_results,
        result_count: result.result_count,
        results: result.results,
        credits_used: result.credits_used,
        remaining_credits: result.remaining_credits,
        response_time_ms: responseTime
      }
    });
    
  } catch (error) {
    console.error('❌ Error in testWebscrape:', error);
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente.'
      }
    });
  }
} 