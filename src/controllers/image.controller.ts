import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import * as imageService from '../services/image.service';
import type { ProcessedImageResponse } from '../schemas/image.schema';

export async function uploadImages(request: FastifyRequest, reply: FastifyReply): Promise<ProcessedImageResponse> {
  try {
    // Coleta todos os arquivos enviados via multipart
    const files: MultipartFile[] = [];
    
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        files.push(part);
      }
    }

    if (files.length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          type: 'no_file',
          message: 'Nenhum arquivo foi enviado.'
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

    // Validação e processamento de todos os arquivos
    const processedImages: string[] = [];
    
    console.log(`📁 Processando ${files.length} arquivos:`);
    files.forEach((file, index) => {
      console.log(`  Arquivo ${index + 1}: ${file.filename} (${file.mimetype})`);
    });
    
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

      // Converte o stream do arquivo para buffer
      const buffer = await file.toBuffer();
      console.log(`📏 Arquivo ${file.filename}: ${buffer.length} bytes`);
      
      // Validação de tamanho (50MB)
      if (buffer.length > 52428800) {
        console.log(`❌ Arquivo muito grande: ${buffer.length} bytes > 50MB`);
        return reply.status(400).send({
          success: false,
          error: {
            type: 'file_too_large',
            message: 'Arquivo muito grande. Tamanho máximo: 50MB.'
          }
        });
      }

      // Converte para base64 e cria URL de dados
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${file.mimetype};base64,${base64}`;
      console.log(`🔄 Convertido ${file.filename} para base64 (${base64.length} caracteres)`);
      processedImages.push(dataUrl);
    }

    // Processa as imagens com IA
    console.log('🚀 Enviando para o serviço de IA...');
    const result = await imageService.processMultipleImages(processedImages);
    console.log('🔙 Resultado do serviço de IA:', result);

    // Verifica se houve erro no processamento
    if ('error' in result) {
      console.log('❌ Erro do serviço de IA:', result.error, result.message);
      return reply.status(400).send({
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
        name: result.name,
        description: result.description
      }
    });

  } catch (error) {
    console.error('Erro no controller uploadImages:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente ou insira os dados manualmente.'
      }
    });
  }
}

// Mantém método original para compatibilidade
export async function uploadImage(request: FastifyRequest, reply: FastifyReply): Promise<ProcessedImageResponse> {
  try {
    // Obtém o arquivo enviado via multipart
    const data: MultipartFile | undefined = await request.file();

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: {
          type: 'no_file',
          message: 'Nenhum arquivo foi enviado.'
        }
      });
    }

    // Verifica o tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({
        success: false,
        error: {
          type: 'invalid_format',
          message: 'Formato de arquivo inválido. Apenas JPEG e PNG são aceitos.'
        }
      });
    }

    // Converte o stream do arquivo para buffer
    const buffer = await data.toBuffer();

    // Processa a imagem
    const result = await imageService.processImage(buffer, data.filename);

    // Verifica se houve erro no processamento
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
    return reply.status(200).send({
      success: true,
      data: {
        partName: result.partName,
        description: result.description
      }
    });

  } catch (error) {
    console.error('Erro no controller uploadImage:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor. Tente novamente ou insira os dados manualmente.'
      }
    });
  }
} 