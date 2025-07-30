import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildPartProcessingPrompt } from '../prompts/part-processing.prompts';

// Tipos para compatibilidade com o sistema existente
interface ProcessingError {
  error: string;
  message: string;
}

interface PartProcessingWithPrices {
  ad_description: string;
  dimensions: {
    width: string;
    height: string;
    depth: string;
    unit: string;
  };
  weight: number;
  compatibility: Array<{
    brand: string;
    model: string;
    year: string;
  }>;
  prices: {
    min_price: number;
    suggested_price: number;
    max_price: number;
  };
}

// Removido: sempre incluímos preços agora

// Instância compartilhada do Gemini
let genAI: GoogleGenerativeAI;

function initializeGemini() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      console.log('GEMINI_API_KEY não encontrada nas variáveis de ambiente');
      throw new Error('GEMINI_API_KEY is required');
    }

    console.log('✅ Chave Gemini encontrada, inicializando...');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

function cleanGeminiResponse(content: string): string {
  // Remove markdown code blocks se presentes
  let cleanContent = content.replace(/```json\s*|\s*```/g, '');
  
  // Remove quebras de linha desnecessárias
  cleanContent = cleanContent.trim();
  
  return cleanContent;
}

/**
 * Converte URLs de dados (data URLs) para o formato esperado pelo Gemini
 */
function prepareImagesForGemini(dataUrls: string[]) {
  return dataUrls.map(url => {
    // Extrai o MIME type e dados base64
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Formato de URL de dados inválido');
    }

    const [, mimeType, data] = match;
    
    return {
      inlineData: {
        mimeType,
        data
      }
    };
  });
}

/**
 * Processa completamente uma peça usando Gemini para gerar todas as informações necessárias incluindo preços
 */
export async function processPartWithGemini(
  dataUrls: string[],
  partName: string,
  partDescription: string,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<PartProcessingWithPrices | ProcessingError> {
  
  const aiStartTime = Date.now();
  const genAI = initializeGemini();
  
  console.log(`🤖 Iniciando processamento completo da peça com Gemini: ${partName}`);
  console.log(`🚗 Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`);
  console.log(`📸 Processando ${dataUrls.length} imagens`);

  // DEBUG: Análise detalhada das imagens para IA
  console.log(`🔍 DEBUG - Análise das imagens para Gemini:`);
  let totalPayloadSize = 0;
  
  dataUrls.forEach((url, index) => {
    const sizeBytes = url.length;
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    totalPayloadSize += sizeBytes;
    
    // Extrair tipo MIME da URL
    const mimeMatch = url.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'unknown';
    
    // Calcular tamanho da imagem original (base64 é ~33% maior)
    const originalSizeBytes = sizeBytes * 0.75;
    const originalSizeMB = (originalSizeBytes / 1024 / 1024).toFixed(2);
    
    console.log(`   📷 Imagem ${index + 1}:`);
    console.log(`      MIME: ${mimeType}`);
    console.log(`      Tamanho base64: ${sizeMB} MB`);
    console.log(`      Tamanho original estimado: ${originalSizeMB} MB`);
    console.log(`      Caracteres: ${sizeBytes.toLocaleString()}`);
  });

  const totalPayloadSizeMB = (totalPayloadSize / 1024 / 1024).toFixed(2);
  console.log(`📊 DEBUG - Payload total para Gemini: ${totalPayloadSizeMB} MB`);

  try {
    // Configuração de timeout para iOS/mobile
    const timeoutMs = 35000; // 35 segundos
    const requestStartTime = Date.now();

    // Prepara o prompt usando o arquivo simplificado
    const prompt = buildPartProcessingPrompt(
      partName,
      partDescription,
      vehicleBrand,
      vehicleModel,
      vehicleYear
    );

    // Prepara as imagens para o formato do Gemini
    const imagesParts = prepareImagesForGemini(dataUrls);

    // Configura o modelo Gemini (usando gemini-2.5-flash para melhor performance e disponibilidade)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2, // Reduzido para ser mais consistente
        maxOutputTokens: 2048, // Aumentado para evitar MAX_TOKENS
      }
    });

    // Cria o request com timeout customizado
    console.log(`🚀 DEBUG - Enviando para Gemini (payload: ${totalPayloadSizeMB} MB, timeout: ${timeoutMs}ms)`);
    
    const geminiPromise = model.generateContent([prompt, ...imagesParts]);

    // Timeout personalizado para iOS
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Gemini timeout após ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Race entre request e timeout
    const result = await Promise.race([geminiPromise, timeoutPromise]);

    const requestTime = Date.now() - requestStartTime;
    console.log(`⏱️ DEBUG - Resposta Gemini recebida em: ${requestTime}ms`);

    const content = result.response.text();
    console.log('📥 Resposta Gemini recebida');
    
    // DEBUG: Análise da resposta
    if (content) {
      const contentSize = content.length;
      const contentPreview = content.substring(0, 200);
      console.log(`📄 DEBUG - Tamanho da resposta: ${contentSize} caracteres`);
      console.log(`📄 DEBUG - Preview da resposta: ${contentPreview}...`);
    } else {
      console.log('❌ DEBUG - Nenhum conteúdo na resposta Gemini');
      return {
        error: "api_error",
        message: "Gemini retornou resposta vazia. Tente novamente."
      };
    }

    console.log('❌ Nenhum conteúdo na resposta Gemini');
    if (!content) {
      return {
        error: "api_error",
        message: "Erro na resposta da API Gemini. Tente novamente ou insira os dados manualmente."
      };
    }

    // Limpa e processa a resposta
    const cleanContent = cleanGeminiResponse(content);
    console.log(`🧹 DEBUG - Conteúdo limpo: ${cleanContent.substring(0, 200)}...`);

    // Tenta fazer parse do JSON
    let parsedResponse: PartProcessingWithPrices;
    try {
      console.log('🔄 DEBUG - Fazendo parse do JSON...');
      parsedResponse = JSON.parse(cleanContent);
      console.log('✅ DEBUG - Parse do JSON bem-sucedido');
      
      // Validação básica da estrutura
      if (!parsedResponse.ad_description) {
        throw new Error('Estrutura JSON inválida - campos obrigatórios ausentes');
      }

            // DEBUG: Log dos campos principais
      console.log('📋 DEBUG - Peso estimado:', parsedResponse.weight, 'kg');
              console.log('📋 DEBUG - Veículos compatíveis:', parsedResponse.compatibility?.length || 0);
      
                    console.log('💰 DEBUG - Preços: R$' + parsedResponse.prices.min_price + ' - R$' + parsedResponse.prices.max_price);

    } catch (parseError) {
      console.error('❌ DEBUG - Erro ao fazer parse da resposta Gemini:', parseError);
      console.error('❌ DEBUG - Resposta bruta Gemini:', content);
      
      return {
        error: "parsing_error", 
        message: "Erro ao processar resposta da IA. A peça pode ter características muito específicas - tente inserir os dados manualmente."
      };
    }

    const totalTime = Date.now() - aiStartTime;
    console.log(`⏱️ DEBUG - Processamento Gemini completo em: ${totalTime}ms`);
    console.log('✅ DEBUG - Processamento Gemini concluído com sucesso');

    return parsedResponse;

  } catch (error) {
    const totalTime = Date.now() - aiStartTime;
    console.error('❌ DEBUG - Erro da API Gemini:', error);
    console.log(`⏱️ DEBUG - Falha após ${totalTime}ms`);
    
    if (error instanceof Error && error.message.includes('timeout')) {
      console.log('⏰ DEBUG - Timeout detectado no Gemini');
      return {
        error: "gemini_timeout",
        message: "Processamento muito lento - tente novamente com imagens menores ou insira os dados manualmente."
      };
    }

    // Outros erros da API
    return {
      error: "api_error", 
      message: "Erro na API Gemini. Verifique sua conexão e tente novamente."
    };
  }
} 

/**
 * Processa peça usando apenas dados textuais (sem imagens) com Gemini
 */
export async function processPartDataWithGemini(
  partName: string,
  partDescription: string,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<PartProcessingWithPrices | ProcessingError> {
  
  const aiStartTime = Date.now();
  const genAI = initializeGemini();
  
  console.log(`🤖 Iniciando processamento de dados da peça com Gemini: ${partName}`);
  console.log(`🚗 Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`);
  console.log(`📝 Processamento apenas textual (sem imagens)`);

  try {
    // Configuração de timeout
    const timeoutMs = 15000; // 15 segundos (mais rápido sem imagens)
    const requestStartTime = Date.now();

    // Prepara o prompt usando o arquivo simplificado
    const prompt = buildPartProcessingPrompt(
      partName,
      partDescription,
      vehicleBrand,
      vehicleModel,
      vehicleYear
    );

    // Configura o modelo Gemini
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3, // Um pouco mais alto já que não temos imagens para basear
        maxOutputTokens: 2048, // Aumentado para evitar MAX_TOKENS
      }
    });

    console.log(`🚀 DEBUG - Enviando para Gemini (apenas texto, timeout: ${timeoutMs}ms)`);
    console.log('🔍 DEBUG - Prompt enviado:', prompt);
    console.log('🔍 DEBUG - Tamanho do prompt:', prompt.length, 'caracteres');
    
    const geminiPromise = model.generateContent([prompt]);

    // Timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Gemini timeout após ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Race entre request e timeout
    const result = await Promise.race([geminiPromise, timeoutPromise]);

    const requestTime = Date.now() - requestStartTime;
    console.log(`⏱️ DEBUG - Resposta Gemini recebida em: ${requestTime}ms`);

    console.log('📥 Resposta Gemini recebida (modo texto)');
    
    // DEBUG: Log completo da resposta
    console.log('🔍 DEBUG - Resposta completa do Gemini:', JSON.stringify(result, null, 2));
    console.log('🔍 DEBUG - Result.response:', result.response);
    
    const content = result.response.text();
    console.log('🔍 DEBUG - Content extraído:', content);
    console.log('🔍 DEBUG - Tipo do content:', typeof content);
    console.log('🔍 DEBUG - Length do content:', content?.length);
    
    if (!content) {
      console.log('❌ DEBUG - Nenhum conteúdo na resposta Gemini');
      return {
        error: "api_error",
        message: "Gemini retornou resposta vazia. Tente novamente."
      };
    }

    // Limpa e processa a resposta
    const cleanContent = cleanGeminiResponse(content);
    console.log(`🧹 DEBUG - Conteúdo limpo: ${cleanContent.substring(0, 200)}...`);

    // Tenta fazer parse do JSON
    let parsedResponse: PartProcessingWithPrices;
    try {
      console.log('🔄 DEBUG - Fazendo parse do JSON...');
      parsedResponse = JSON.parse(cleanContent);
      console.log('✅ DEBUG - Parse do JSON bem-sucedido');
      
      // Validação básica da estrutura
      if (!parsedResponse.ad_description) {
        throw new Error('Estrutura JSON inválida - campos obrigatórios ausentes');
      }

      // DEBUG: Log dos campos principais
      console.log('📋 DEBUG - Peso estimado:', parsedResponse.weight, 'kg');
      console.log('📋 DEBUG - Veículos compatíveis:', parsedResponse.compatibility?.length || 0);
      
      console.log(`💰 DEBUG - Preços: R$${parsedResponse.prices.min_price} - R$${parsedResponse.prices.max_price}`);

    } catch (parseError) {
      console.error('❌ DEBUG - Erro ao fazer parse da resposta Gemini:', parseError);
      console.error('❌ DEBUG - Resposta bruta Gemini:', content);
      
      return {
        error: "parsing_error", 
        message: "Erro ao processar resposta da IA. Tente inserir os dados manualmente ou use o endpoint com imagens."
      };
    }

    const totalTime = Date.now() - aiStartTime;
    console.log(`⏱️ DEBUG - Processamento Gemini texto completo em: ${totalTime}ms`);
    console.log('✅ DEBUG - Processamento textual Gemini concluído com sucesso');

    return parsedResponse;

  } catch (error) {
    const totalTime = Date.now() - aiStartTime;
    console.error('❌ DEBUG - Erro da API Gemini (modo texto):', error);
    console.log(`⏱️ DEBUG - Falha após ${totalTime}ms`);
    
    if (error instanceof Error && error.message.includes('timeout')) {
      console.log('⏰ DEBUG - Timeout detectado no Gemini (modo texto)');
      return {
        error: "gemini_timeout",
        message: "Processamento muito lento - tente novamente."
      };
    }

    return {
      error: "api_error", 
      message: "Erro na API Gemini. Verifique sua conexão e tente novamente."
    };
  }
} 