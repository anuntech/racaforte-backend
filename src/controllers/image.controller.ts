import type { FastifyRequest, FastifyReply } from 'fastify';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as storageService from '../services/storage.service';

interface BackgroundRemovalResponse {
  success: boolean;
  data?: {
    processed_images: string[];
    processing_info: {
      total_images: number;
      successful_removals: number;
      failed_removals: number;
      processing_time_ms: number;
    };
  };
  error?: {
    type: string;
    message: string;
  };
}

export async function removeBackground(request: FastifyRequest, reply: FastifyReply): Promise<BackgroundRemovalResponse> {
  const startTime = Date.now();
  
  try {
    console.log('🎨 Iniciando processamento de remoção de fundo...');
    
    // Usa saveRequestFiles para melhor compatibilidade com iOS
    const files = await request.saveRequestFiles({
      tmpdir: tmpdir(), // Usa diretório temporário do sistema
      limits: {
        fileSize: 52428800, // 50MB
        files: 10 // Máximo 10 arquivos
      }
    });

    if (files.length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          type: 'no_file',
          message: 'Nenhum arquivo foi enviado.'
        }
      });
    }

    if (files.length > 10) {
      return reply.status(400).send({
        success: false,
        error: {
          type: 'too_many_files',
          message: 'Máximo de 10 imagens permitidas.'
        }
      });
    }

    console.log(`📁 Processando remoção de fundo para ${files.length} arquivos`);
    
    const processedImages: string[] = [];
    let successfulRemovals = 0;
    let failedRemovals = 0;
    
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

      try {
        // Lê o arquivo do disco
        const buffer = await readFile(file.filepath);
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

        console.log(`🎨 Removendo fundo da imagem: ${file.filename}`);
        
        // Remove o fundo da imagem
        const bgRemovalResult = await storageService.removeBackground(buffer);
        
        let finalBuffer = buffer; // Imagem original como fallback
        
        if ('error' in bgRemovalResult) {
          console.log(`📝 Remove.bg não pôde processar ${file.filename} - usando original`);
          failedRemovals++;
        } else {
          finalBuffer = bgRemovalResult;
          const reductionPercent = ((1 - finalBuffer.length / buffer.length) * 100).toFixed(1);
          console.log(`✅ Fundo removido com sucesso para ${file.filename}`);
          console.log(`📏 Redução de tamanho: ${reductionPercent}%`);
          successfulRemovals++;
        }
        
        // Converte para base64 e cria URL de dados
        const base64 = finalBuffer.toString('base64');
        const dataUrl = `data:${file.mimetype};base64,${base64}`;
        processedImages.push(dataUrl);
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${file.filename}:`, error);
        failedRemovals++;
        
        // Se houver erro, usa a imagem original
        const buffer = await readFile(file.filepath);
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${file.mimetype};base64,${base64}`;
        processedImages.push(dataUrl);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Processamento de remoção de fundo completo em: ${processingTime}ms`);
    console.log(`📊 Resultados: ${successfulRemovals} sucessos, ${failedRemovals} falhas`);

    // Resposta de sucesso
    return reply.status(200).send({
      success: true,
      data: {
        processed_images: processedImages,
        processing_info: {
          total_images: files.length,
          successful_removals: successfulRemovals,
          failed_removals: failedRemovals,
          processing_time_ms: processingTime
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro no controller removeBackground:', error);
    
    return reply.status(500).send({
      success: false,
      error: {
        type: 'server_error',
        message: 'Erro interno do servidor na remoção de fundo. Tente novamente.'
      }
    });
  }
} 