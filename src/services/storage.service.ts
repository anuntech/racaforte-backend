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
    const startTime = Date.now();
    
    if (!process.env.REMOVEBG_API_KEY) {
      throw new Error('REMOVEBG_API_KEY não configurada');
    }

    // DEBUG: Análise da imagem de entrada
    const inputSizeMB = (imageBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`🔄 Removendo background da imagem (${inputSizeMB} MB)...`);
    
    // DEBUG: Detectar formato da imagem pelos magic bytes
    let imageFormat = 'unknown';
    if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF) {
      imageFormat = 'JPEG';
    } else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
      imageFormat = 'PNG';
    } else if (imageBuffer.slice(0, 4).toString() === 'RIFF' && imageBuffer.slice(8, 12).toString() === 'WEBP') {
      imageFormat = 'WEBP';
    }
    
    console.log('🖼️ DEBUG - Remove.bg input:');
    console.log(`   Formato detectado: ${imageFormat}`);
    console.log(`   Tamanho: ${imageBuffer.length} bytes (${inputSizeMB} MB)`);
    
    const formDataStartTime = Date.now();
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('image_file', blob);
    formData.append('size', 'auto');
    
    const formDataTime = Date.now() - formDataStartTime;
    console.log(`⏱️ DEBUG - FormData criado em: ${formDataTime}ms`);

    // Configuração otimizada para iOS com timeout mais baixo
    const axiosConfig = {
      headers: {
        'X-Api-Key': process.env.REMOVEBG_API_KEY,
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'arraybuffer' as const,
      timeout: 20000, // 20 segundos - mais conservador para iOS
      maxRedirects: 3,
      // Configurações de retry para iOS
      validateStatus: (status: number) => status < 500, // Não retry em 4xx
    };

    console.log(`📡 DEBUG - Enviando para remove.bg (timeout: ${axiosConfig.timeout}ms)...`);
    const requestStartTime = Date.now();
    
    const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, axiosConfig);

    const requestTime = Date.now() - requestStartTime;
    
    // Verificar se a resposta indica erro (status 402 = sem créditos)
    if (response.status === 402) {
      console.log('💳 DEBUG - Status 402: Créditos insuficientes na remove.bg');
      return {
        error: 'insufficient_credits',
        message: 'Créditos insuficientes na API remove.bg. Usando imagem original.'
      };
    }
    
    // DEBUG: Verificar resposta detalhadamente
    console.log('🔍 DEBUG - Resposta remove.bg:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Headers Content-Type: ${response.headers['content-type']}`);
    console.log(`   Data type: ${typeof response.data}`);
    console.log(`   Data length: ${response.data.length || response.data.byteLength || 'undefined'}`);
    
    // Verificar se a resposta é JSON (erro) em vez de uma imagem
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      console.log('❌ DEBUG - Resposta é JSON (erro), não uma imagem');
      let errorMessage = 'Erro na API remove.bg';
      
      try {
        const errorData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (errorData.errors?.[0]?.title) {
          errorMessage = errorData.errors[0].title;
        }
        console.log(`   Erro da API: ${errorMessage}`);
      } catch (e) {
        console.log('   Não foi possível decodificar erro JSON');
      }
      
      return {
        error: 'api_error',
        message: `${errorMessage}. Usando imagem original.`
      };
    }
    
    const resultBuffer = Buffer.from(response.data);
    console.log(`   Buffer criado - length: ${resultBuffer.length} bytes`);
    
    // Verificar se o buffer não está vazio
    if (resultBuffer.length === 0) {
      console.log('❌ DEBUG - Buffer vazio recebido do remove.bg!');
      return {
        error: 'empty_result',
        message: 'Remove.bg retornou resultado vazio. Usando imagem original.'
      };
    }
    
    // Verificar magic bytes do resultado
    let resultFormat = 'unknown';
    if (resultBuffer[0] === 0xFF && resultBuffer[1] === 0xD8 && resultBuffer[2] === 0xFF) {
      resultFormat = 'JPEG';
    } else if (resultBuffer[0] === 0x89 && resultBuffer[1] === 0x50 && resultBuffer[2] === 0x4E && resultBuffer[3] === 0x47) {
      resultFormat = 'PNG';
    } else if (resultBuffer.slice(0, 4).toString() === 'RIFF' && resultBuffer.slice(8, 12).toString() === 'WEBP') {
      resultFormat = 'WEBP';
    }
    
    const outputSizeMB = (resultBuffer.length / 1024 / 1024).toFixed(2);
    const totalTime = Date.now() - startTime;
    const compressionPercent = ((1 - resultBuffer.length / imageBuffer.length) * 100).toFixed(1);
    
    console.log('✅ Background removido com sucesso');
    console.log('⏱️ DEBUG - Remove.bg timing:');
    console.log(`   Request: ${requestTime}ms`);
    console.log(`   Total: ${totalTime}ms`);
    console.log('📏 DEBUG - Remove.bg resultado:');
    console.log(`   Tamanho original: ${inputSizeMB} MB`);
    console.log(`   Tamanho resultado: ${outputSizeMB} MB`);
    console.log(`   Formato resultado: ${resultFormat}`);
    console.log(`   Compressão: ${compressionPercent}%`);
    console.log(`   Status response: ${response.status}`);
    
    return resultBuffer;

  } catch (error) {
    const totalTime = Date.now() - (Date.now() - 1000); // Estimativa
    console.error('❌ Erro ao remover background:', error);
    
    // DEBUG: Análise detalhada do erro
    if (axios.isAxiosError(error)) {
      console.log('🔍 DEBUG - Axios error details:');
      console.log(`   Code: ${error.code}`);
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Status text: ${error.response?.statusText}`);
      console.log(`   Message: ${error.message}`);
      
      if (error.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData === 'string') {
          console.log(`   Response data: ${errorData.substring(0, 200)}`);
        } else {
          console.log(`   Response data type: ${typeof errorData}`);
        }
      }
      
      // Timeout específico
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        console.log('⏰ DEBUG - Timeout detectado após tentativa de conexão');
        return {
          error: 'removebg_timeout',
          message: 'Timeout na remoção de background. Usando imagem original.'
        };
      }
      
      if (error.response?.status === 402) {
        console.log('💳 DEBUG - Quota excedida (status 402)');
        return {
          error: 'quota_exceeded',
          message: 'Cota da API removeBG excedida. Usando imagem original.'
        };
      }
      
      // Rate limit
      if (error.response?.status === 429) {
        console.log('🚫 DEBUG - Rate limit (status 429)');
        return {
          error: 'rate_limit',
          message: 'Rate limit da API removeBG. Usando imagem original.'
        };
      }
      
      // Outros erros HTTP
      if (error.response?.status) {
        console.log(`🔴 DEBUG - HTTP error status ${error.response.status}`);
      }
      
      return {
        error: 'removebg_api_error',
        message: 'Erro na API removeBG. Usando imagem original.'
      };
    }

    // Outros tipos de erro
    if (error instanceof Error) {
      console.log('🔍 DEBUG - Generic error:');
      console.log(`   Type: ${error.constructor.name}`);
      console.log(`   Message: ${error.message}`);
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
  removeBackgroundEnabled = true
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
  removeBackgroundEnabled = true
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