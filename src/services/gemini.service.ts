import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  buildPartProcessingPrompt,
  buildPricesPrompt,
  buildAdDescriptionPrompt,
  buildDimensionsPrompt,
  buildWeightPrompt,
  buildCompatibilityPrompt
} from '../prompts/part-processing.prompts.js';

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

// Tipos específicos para cada resposta individual
interface PricesResponse {
  prices: {
    min_price: number;
    suggested_price: number;
    max_price: number;
  };
}

interface AdDescriptionResponse {
  ad_description: string;
}

interface DimensionsResponse {
  dimensions: {
    width: string;
    height: string;
    depth: string;
    unit: string;
  };
}

interface WeightResponse {
  weight: number;
}

interface CompatibilityResponse {
  compatibility: Array<{
    brand: string;
    model: string;
    year: string;
  }>;
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

// Extrai a primeira substring que representa um objeto JSON balanceado
function extractFirstJsonObject(text: string): string | null {
  const startIndex = text.indexOf('{');
  if (startIndex === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.substring(startIndex, i + 1);
      }
    }
  }
  return null;
}

// Faz o parse robusto do JSON vindo do modelo (tolerante a texto extra)
function safeParseLlmJson<T>(rawContent: string): T {
  const cleaned = cleanGeminiResponse(rawContent);
  // Tenta diretamente
  try {
    return JSON.parse(cleaned) as T;
  } catch (_) {
    // Tenta extrair primeiro objeto JSON balanceado
    const candidate = extractFirstJsonObject(cleaned);
    if (!candidate) throw new Error('invalid_json: no_json_object_found');
    try {
      return JSON.parse(candidate) as T;
    } catch (err) {
      // Pequena tentativa de normalizar vírgulas finais comuns
      const withoutTrailingCommas = candidate
        .replace(/,\s*}/g, '}')
        .replace(/,\s*\]/g, ']');
      return JSON.parse(withoutTrailingCommas) as T;
    }
  }
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
  console.log('🔍 DEBUG - Análise das imagens para Gemini:');
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
      
                    console.log(`💰 DEBUG - Preços: R$${parsedResponse.prices.min_price} - R$${parsedResponse.prices.max_price}`);

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
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<PartProcessingWithPrices | ProcessingError> {
  
  const aiStartTime = Date.now();
  const genAI = initializeGemini();
  
  console.log(`🤖 Iniciando processamento de dados da peça com Gemini: ${partName}`);
  console.log(`🚗 Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`);
  console.log('📝 Processamento apenas textual (sem imagens)');

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

// Função auxiliar para fazer chamadas individuais ao Gemini
async function callGeminiWithPrompt<T>(
  prompt: string,
  timeoutMs = 10000,
  label = 'generic'
): Promise<T> {
  const genAI = initializeGemini();
  
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048, // Aumentado para evitar MAX_TOKENS
      // Desabilita o raciocínio interno que está consumindo tokens
      responseLogprobs: false,
    },
    systemInstruction: "Responda de forma direta e concisa. Não inclua explicações ou raciocínio extra."
  });

  console.log(`\n🔎 [Gemini:${label}] Prompt (${prompt.length} chars):`);
  console.log(prompt.length > 600 ? `${prompt.slice(0, 600)}...` : prompt);
  console.log(`📤 [Gemini:${label}] Enviando requisição (timeout: ${timeoutMs}ms)`);

  const geminiPromise = model.generateContent([prompt]);
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Gemini timeout após ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const result = await Promise.race([geminiPromise, timeoutPromise]);
  const content = result.response.text();
  
  console.log(`📥 [Gemini:${label}] Resposta recebida (${content?.length || 0} chars):`);
  if (content) {
    console.log(content.length > 800 ? `${content.slice(0, 800)}...` : content);
  } else {
    console.log(`❌ [Gemini:${label}] Resposta vazia`);
    // Log resumido para debug
    if (result.response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      console.log(`🔍 [Gemini:${label}] Motivo: MAX_TOKENS atingido`);
    }
    // Lança erro específico para permitir fallback sem logar erro de parse
    throw new Error('empty_response');
  }

  try {
    const parsed = safeParseLlmJson<T>(content);
    const preview = JSON.stringify(parsed, null, 2);
    console.log(`✅ [Gemini:${label}] JSON parse OK (${preview.length} chars)`);
    console.log(preview.length > 800 ? `${preview.slice(0, 800)}...` : preview);
    return parsed;
  } catch (err) {
    console.error(`❌ [Gemini:${label}] Falha ao parsear JSON do Gemini:`, err);
    console.error(`❌ [Gemini:${label}] Conteúdo bruto retornado:`, content);
    throw err;
  }
}

// Função para buscar preços - PRIORIDADE MÁXIMA
async function getPrices(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<PricesResponse> {
  const prompt = buildPricesPrompt(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear);
  
  // Configuração especial para prices - SEM limitações de tokens
  const genAI = initializeGemini();
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.2, // Mais determinístico para preços
      maxOutputTokens: 16384, // MÁXIMO ABSOLUTO (16K)
      // Sem responseLogprobs para permitir pensamento completo
    },
    systemInstruction: "Pesquise preços reais no mercado brasileiro. Retorne valores numéricos válidos, nunca null. Use dados do Mercado Livre, OLX e lojas de autopeças. Seja DIRETO e CONCISO na resposta - foque apenas no JSON."
  });

  try {
    console.log(`💰 [Gemini:prices] PRIORIDADE MÁXIMA - Prompt (${prompt.length} chars):`);
    console.log(prompt);
    console.log('📤 [Gemini:prices] Enviando com configuração especial (maxTokens: 16384, sem limites de pensamento)');

    const geminiPromise = model.generateContent([prompt]);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Gemini timeout após 20000ms'));
      }, 20000); // Timeout maior para permitir pensamento
    });

    const result = await Promise.race([geminiPromise, timeoutPromise]);
    const content = result.response.text();
    
    console.log(`📥 [Gemini:prices] Resposta recebida (${content?.length || 0} chars):`);
    console.log(content);
    
    // Log detalhado do motivo da falha se necessário
    if (!content) {
      console.log('🔍 [Gemini:prices] DEBUG - Analisando motivo da resposta vazia:');
      console.log('   result.response.candidates:', result.response.candidates);
      console.log('   finishReason:', result.response.candidates?.[0]?.finishReason);
      console.log('   usageMetadata:', result.response.usageMetadata);
      throw new Error('empty_response');
    }

    const parsed = safeParseLlmJson<PricesResponse>(content);
    
    // Validação especial para prices - nunca aceitar null
    if (!parsed.prices || 
        parsed.prices.min_price === null || 
        parsed.prices.suggested_price === null || 
        parsed.prices.max_price === null ||
        parsed.prices.min_price === undefined || 
        parsed.prices.suggested_price === undefined || 
        parsed.prices.max_price === undefined) {
      console.warn('⚠️ [Gemini:prices] Resposta contém valores null/undefined, tentando novamente...');
      throw new Error('invalid_prices');
    }

    console.log('✅ [Gemini:prices] Preços válidos obtidos');
    return parsed;

  } catch (err) {
    console.warn('⚠️ [Gemini:prices] Primeira tentativa falhou, analisando erro...');
    console.log('🔍 [Gemini:prices] Erro capturado:', err);
    console.warn('⚠️ [Gemini:prices] Usando prompt simplificado...');
    
    // Segunda tentativa com prompt mais direto
    const simplePrompt = `Estime preços realistas para a peça automotiva "${partName}" no mercado brasileiro atual.

Retorne JSON com preços em reais (números, não null):
{
  "prices": {
    "min_price": preco_minimo_numero,
    "suggested_price": preco_sugerido_numero,
    "max_price": preco_maximo_numero
  }
}

IMPORTANTE: Use valores numéricos reais, nunca null.`;

    try {
      const result2 = await model.generateContent([simplePrompt]);
      const content2 = result2.response.text();
      
      if (content2) {
        const parsed2 = safeParseLlmJson<PricesResponse>(content2);
        if (parsed2.prices && 
            typeof parsed2.prices.min_price === 'number' && 
            typeof parsed2.prices.suggested_price === 'number' && 
            typeof parsed2.prices.max_price === 'number') {
          console.log('✅ [Gemini:prices] Sucesso na segunda tentativa');
          return parsed2;
        }
      }
    } catch (err2) {
      console.warn('⚠️ [Gemini:prices] Segunda tentativa também falhou');
    }

    // Fallback final baseado no tipo de peça
    console.warn('⚠️ [Gemini:prices] Usando fallback inteligente baseado na peça');
    const baseName = partName.toLowerCase();
    let basePrice = 150; // Padrão

    if (baseName.includes('alternador')) basePrice = 250;
    else if (baseName.includes('motor')) basePrice = 800;
    else if (baseName.includes('transmissao')) basePrice = 1200;
    else if (baseName.includes('freio')) basePrice = 120;
    else if (baseName.includes('lanterna')) basePrice = 80;
    else if (baseName.includes('farol')) basePrice = 150;
    else if (baseName.includes('para-choque')) basePrice = 200;
    else if (baseName.includes('porta')) basePrice = 300;

    return {
      prices: {
        min_price: Math.round(basePrice * 0.6),
        suggested_price: basePrice,
        max_price: Math.round(basePrice * 2.0),
      },
    };
  }
}

// Função para gerar descrição do anúncio
async function getAdDescription(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<AdDescriptionResponse> {
  const prompt = buildAdDescriptionPrompt(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear);
  return await callGeminiWithPrompt<AdDescriptionResponse>(prompt, 20000, 'ad_description');
}

// Função para estimar dimensões
async function getDimensions(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<DimensionsResponse> {
  const prompt = buildDimensionsPrompt(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear);
  try {
    return await callGeminiWithPrompt<DimensionsResponse>(prompt, 20000, 'dimensions');
  } catch (err) {
    console.warn('⚠️ [Gemini:dimensions] Tentando novamente com timeout maior...');
    try {
      return await callGeminiWithPrompt<DimensionsResponse>(prompt, 30000, 'dimensions-retry');
    } catch (err2) {
      console.warn('⚠️ [Gemini:dimensions] Retornando fallback com dimensões padrão.');
      return {
        dimensions: {
          width: "20",
          height: "15",
          depth: "10",
          unit: "cm",
        },
      };
    }
  }
}

// Função para estimar peso
async function getWeight(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<WeightResponse> {
  const prompt = buildWeightPrompt(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear);
  return await callGeminiWithPrompt<WeightResponse>(prompt, 20000, 'weight');
}

// Função para determinar compatibilidade
async function getCompatibility(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<CompatibilityResponse> {
  const prompt = buildCompatibilityPrompt(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear);
  try {
    return await callGeminiWithPrompt<CompatibilityResponse>(prompt, 20000, 'compatibility');
  } catch (err) {
    if (err instanceof Error && err.message === 'empty_response') {
      console.warn('⚠️ [Gemini:compatibility] Resposta vazia. Usando fallback com veículo original.');
      return {
        compatibility: [
          {
            brand: vehicleBrand,
            model: vehicleModel,
            year: String(vehicleYear),
          },
        ],
      };
    }
    console.warn('⚠️ [Gemini:compatibility] Tentando novamente com timeout maior...');
    try {
      return await callGeminiWithPrompt<CompatibilityResponse>(prompt, 30000, 'compatibility-retry');
    } catch (err2) {
      console.warn('⚠️ [Gemini:compatibility] Retornando fallback com veículo original.');
      return {
        compatibility: [
          {
            brand: vehicleBrand,
            model: vehicleModel,
            year: String(vehicleYear),
          },
        ],
      };
    }
  }
}

/**
 * Nova função que processa peça usando prompts separados para melhor qualidade
 */
export async function processPartWithSeparatePrompts(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<PartProcessingWithPrices | ProcessingError> {
  
  console.log(`🤖 Iniciando processamento com prompts separados: ${partName}`);
  console.log(`🚗 Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`);
  
  try {
    // Executa todas as chamadas em paralelo para melhor performance
    console.log('🔄 Executando consultas em paralelo...');
    const [
      pricesResult,
      adDescriptionResult,
      dimensionsResult,
      weightResult,
      compatibilityResult
    ] = await Promise.all([
      getPrices(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear),
      getAdDescription(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear),
      getDimensions(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear),
      getWeight(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear),
      getCompatibility(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear)
    ]);

    console.log('✅ Todas as consultas concluídas');

    // Combina todos os resultados
    const combinedResult: PartProcessingWithPrices = {
      prices: pricesResult.prices,
      ad_description: adDescriptionResult.ad_description,
      dimensions: dimensionsResult.dimensions,
      weight: weightResult.weight,
      compatibility: compatibilityResult.compatibility
    };

    console.log('✅ Processamento com prompts separados concluído');
    return combinedResult;

  } catch (error) {
    console.error('❌ Erro no processamento com prompts separados:', error);
    
    if (error instanceof Error && error.message.includes('timeout')) {
      return {
        error: "gemini_timeout",
        message: "Processamento muito lento - tente novamente."
      };
    }

    return {
      error: "api_error", 
      message: "Erro no processamento com IA. Tente novamente."
    };
  }
} 