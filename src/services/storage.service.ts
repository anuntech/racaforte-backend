import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import { config } from 'dotenv';

config();

export interface UploadResult {
  url: string;
  key: string;
}

export interface StorageError {
  error: string;
  message: string;
}

// Configuração do cliente S3 para Hetzner com otimizações para iOS
const s3Client = new S3Client({
  endpoint: process.env.HETZNER_S3_ENDPOINT,
  region: 'eu-central-1', // Região padrão do Hetzner
  credentials: {
    accessKeyId: process.env.HETZNER_ACCESS_KEY || '',
    secretAccessKey: process.env.HETZNER_SECRET_KEY || '',
  },
  forcePathStyle: true, // Necessário para alguns provedores S3 compatíveis
  // Retry policy mais agressiva para iOS - aumenta tentativas de conexão
  maxAttempts: 5, // Aumenta de 3 para 5 tentativas
});

/**
 * Remove o background de uma imagem usando a API removeBG
 */
export async function removeBackground(imageBuffer: Buffer): Promise<Buffer | StorageError> {
  try {
    if (!process.env.REMOVEBG_API_KEY) {
      throw new Error('REMOVEBG_API_KEY não configurada');
    }

    console.log('🔄 Removendo background da imagem...');
    
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('image_file', blob);
    formData.append('size', 'auto');

    const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
      headers: {
        'X-Api-Key': process.env.REMOVEBG_API_KEY,
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'arraybuffer'
    });

    console.log('✅ Background removido com sucesso');
    return Buffer.from(response.data);

  } catch (error) {
    console.error('❌ Erro ao remover background:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 402) {
        return {
          error: 'quota_exceeded',
          message: 'Cota da API removeBG excedida. Usando imagem original.'
        };
      }
      
      return {
        error: 'removebg_api_error',
        message: 'Erro na API removeBG. Usando imagem original.'
      };
    }

    return {
      error: 'removebg_error',
      message: 'Erro ao processar remoção de background. Usando imagem original.'
    };
  }
}

/**
 * Faz upload de uma imagem para o S3 da Hetzner com retry especializado para iOS
 */
export async function uploadImageToS3(
  imageBuffer: Buffer, 
  filename: string, 
  partId: string
): Promise<UploadResult | StorageError> {
  if (!process.env.HETZNER_S3_BUCKET || !process.env.HETZNER_ACCESS_KEY || !process.env.HETZNER_SECRET_KEY) {
    return {
      error: 'config_error',
      message: 'Configurações S3 não encontradas'
    };
  }

  // Gera um nome único para o arquivo
  const timestamp = Date.now();
  const extension = filename.split('.').pop() || 'jpg';
  const key = `parts/${partId}/${timestamp}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}.${extension}`;

  console.log(`📤 Fazendo upload para S3 (iOS-optimized): ${key}`);

  // Retry manual otimizado para iOS
  const maxRetries = 5;
  const baseDelay = 2000; // 2 segundos
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Tentativa ${attempt}/${maxRetries} para upload S3...`);
      
      const command = new PutObjectCommand({
        Bucket: process.env.HETZNER_S3_BUCKET,
        Key: key,
        Body: imageBuffer,
        ContentType: `image/${extension}`,
        ACL: 'public-read',
      });

      // Timeout customizado com Promise.race para iOS
      const uploadPromise = s3Client.send(command);
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutMs = 60000 + (attempt * 30000); // Aumenta timeout a cada tentativa
        setTimeout(() => reject(new Error(`Upload timeout após ${timeoutMs}ms na tentativa ${attempt}`)), timeoutMs);
      });

      await Promise.race([uploadPromise, timeoutPromise]);

      // Constrói a URL pública da imagem
      const baseUrl = process.env.HETZNER_S3_ENDPOINT?.replace(/\/+$/, '');
      const bucket = process.env.HETZNER_S3_BUCKET;
      if (!baseUrl) {
        throw new Error('HETZNER_S3_ENDPOINT não configurado');
      }
      
      const publicUrl = `${baseUrl}/${bucket}/${key}`.replace(/([^:]\/)\/+/g, '$1');

      console.log(`✅ Upload S3 concluído na tentativa ${attempt}: ${publicUrl}`);

      return {
        url: publicUrl,
        key: key
      };

    } catch (error) {
      console.error(`❌ Erro na tentativa ${attempt}/${maxRetries}:`, error);
      
      // Se não é a última tentativa, aguarda antes de tentar novamente
      if (attempt < maxRetries) {
        const delay = baseDelay * (2 ** (attempt - 1)); // Backoff exponencial
        console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Última tentativa falhou
      let errorMessage = 'Erro ao fazer upload da imagem.';
      
      if (error instanceof Error) {
        if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
          errorMessage = 'Timeout na conexão com S3. Verifique sua conexão de internet e tente novamente.';
        } else if (error.message.includes('ENETUNREACH') || error.message.includes('connect')) {
          errorMessage = 'Problema de conectividade com S3. Tente novamente em alguns minutos.';
        } else {
          errorMessage = `Erro no upload: ${error.message}`;
        }
      }

      return {
        error: 'upload_error',
        message: errorMessage
      };
    }
  }

  // Nunca deveria chegar aqui, mas por segurança
  return {
    error: 'upload_error',
    message: 'Falha no upload após todas as tentativas.'
  };
}

/**
 * Processa uma imagem: remove background e faz upload para S3
 */
export async function processAndUploadImage(
  imageBuffer: Buffer,
  filename: string,
  partId: string,
  removeBackgroundEnabled: boolean = true
): Promise<UploadResult | StorageError> {
  try {
    let processedBuffer = imageBuffer;

    // Remove background se habilitado
    if (removeBackgroundEnabled) {
      const bgRemovalResult = await removeBackground(imageBuffer);
      
      if ('error' in bgRemovalResult) {
        console.log('⚠️ Continuando com imagem original:', bgRemovalResult.message);
        // Continua com a imagem original se houver erro na remoção do background
      } else {
        processedBuffer = bgRemovalResult;
        console.log('✅ Background removido, usando imagem processada');
      }
    }

    // Faz upload da imagem (com ou sem background removido)
    return await uploadImageToS3(processedBuffer, filename, partId);

  } catch (error) {
    console.error('❌ Erro no processamento da imagem:', error);
    return {
      error: 'processing_error',
      message: 'Erro ao processar imagem. Tente novamente.'
    };
  }
}

/**
 * Processa múltiplas imagens em paralelo
 */
export async function processAndUploadMultipleImages(
  images: Array<{ buffer: Buffer; filename: string }>,
  partId: string,
  removeBackgroundEnabled: boolean = true
): Promise<Array<UploadResult | StorageError>> {
  console.log(`🚀 Processando ${images.length} imagens em paralelo...`);

  const uploadPromises = images.map((image, index) => {
    console.log(`📸 Processando imagem ${index + 1}: ${image.filename}`);
    return processAndUploadImage(image.buffer, image.filename, partId, removeBackgroundEnabled);
  });

  const results = await Promise.all(uploadPromises);
  
  const successCount = results.filter(result => !('error' in result)).length;
  const errorCount = results.filter(result => 'error' in result).length;
  
  console.log(`📊 Resultados: ${successCount} sucessos, ${errorCount} erros`);
  
  return results;
}

/**
 * Extrai a chave (key) do S3 a partir de uma URL pública
 */
function extractS3KeyFromUrl(url: string): string | null {
  try {
    const baseUrl = process.env.HETZNER_S3_ENDPOINT?.replace(/\/+$/, '');
    const bucket = process.env.HETZNER_S3_BUCKET;
    
    if (!baseUrl || !bucket) {
      return null;
    }

    // Padrão esperado: https://endpoint/bucket/parts/partId/filename
    const expectedPrefix = `${baseUrl}/${bucket}/`;
    
    if (url.startsWith(expectedPrefix)) {
      return url.substring(expectedPrefix.length);
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao extrair chave S3 da URL:', error);
    return null;
  }
}

/**
 * Deleta uma imagem do S3 da Hetzner
 */
export async function deleteImageFromS3(imageUrl: string): Promise<true | StorageError> {
  try {
    if (!process.env.HETZNER_S3_BUCKET || !process.env.HETZNER_ACCESS_KEY || !process.env.HETZNER_SECRET_KEY) {
      throw new Error('Configurações S3 não encontradas');
    }

    // Extrai a chave do S3 a partir da URL
    const key = extractS3KeyFromUrl(imageUrl);
    
    if (!key) {
      return {
        error: 'invalid_url',
        message: 'URL da imagem inválida para deleção.'
      };
    }

    console.log(`🗑️ Deletando imagem do S3: ${key}`);

    const command = new DeleteObjectCommand({
      Bucket: process.env.HETZNER_S3_BUCKET,
      Key: key,
    });

    await s3Client.send(command);

    console.log(`✅ Imagem deletada com sucesso: ${key}`);
    return true;

  } catch (error) {
    console.error('❌ Erro ao deletar imagem do S3:', error);
    if (error instanceof Error) {
      return {
        error: 'delete_error',
        message: `Erro ao deletar imagem: ${error.message}`
      };
    }
    return {
      error: 'delete_error',
      message: 'Erro ao deletar imagem. Tente novamente.'
    };
  }
}

/**
 * Deleta múltiplas imagens do S3 em paralelo
 */
export async function deleteMultipleImagesFromS3(imageUrls: string[]): Promise<Array<true | StorageError>> {
  console.log(`🗑️ Deletando ${imageUrls.length} imagens do S3 em paralelo...`);

  const deletePromises = imageUrls.map((url, index) => {
    console.log(`🗑️ Deletando imagem ${index + 1}: ${url}`);
    return deleteImageFromS3(url);
  });

  const results = await Promise.all(deletePromises);
  
  const successCount = results.filter(result => result === true).length;
  const errorCount = results.filter(result => result !== true).length;
  
  console.log(`📊 Resultados da deleção: ${successCount} sucessos, ${errorCount} erros`);
  
  return results;
} 