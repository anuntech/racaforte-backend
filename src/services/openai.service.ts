import OpenAI from 'openai';
import {
  buildPricesPrompt,
  calculatePricesFromAds
} from '../prompts/part-processing.prompts.js';
import { unwrangleService } from './unwrangle.service.js';

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
  ads?: Array<{
    title: string;
    price: number;
    url: string;
  }>;
}

// Tipos específicos para cada resposta individual
interface PricesResponse {
  prices: {
    min_price: number;
    suggested_price: number;
    max_price: number;
  };
  ads?: Array<{
    title: string;
    price: number;
    url: string;
  }>;
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

// Instância compartilhada do OpenAI
let openaiClient: OpenAI;

function initializeOpenAI() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      console.log('OPENAI_API_KEY não encontrada nas variáveis de ambiente');
      throw new Error('OPENAI_API_KEY is required');
    }

    console.log('✅ Chave OpenAI encontrada, inicializando com GPT-5 Mini...');
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

function cleanOpenAIResponse(content: string): string {
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
  const cleaned = cleanOpenAIResponse(rawContent);
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

// Função auxiliar para fazer chamadas ao OpenAI
async function callOpenAIWithPrompt<T>(
  prompt: string,
  timeoutMs = 90000, // Timeout padrão de 1.5 minutos
  label = 'generic'
): Promise<T> {
  const client = initializeOpenAI();
  
  console.log(`\n🔎 [OpenAI:${label}] Prompt (${prompt.length} chars):`);
  console.log(prompt.length > 600 ? `${prompt.slice(0, 600)}...` : prompt);
  console.log(`📤 [OpenAI:${label}] Enviando requisição (timeout: ${timeoutMs}ms)`);

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`OpenAI timeout após ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const openaiPromise = client.chat.completions.create({
      model: 'gpt-5-mini', // Usando GPT-5 Mini (mais rápido e econômico)
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em autopeças brasileiras. Analise detalhadamente para retornar a resposta mais precisa possível em formato JSON válido.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 4096
    });

    const response = await Promise.race([openaiPromise, timeoutPromise]);
    
    if (!response.choices || response.choices.length === 0) {
      throw new Error('Invalid response from OpenAI API');
    }

    const content = response.choices[0].message?.content;
    
    console.log(`📥 [OpenAI:${label}] Resposta recebida (${content?.length || 0} chars):`);
    
    if (content) {
      console.log(content.length > 800 ? `${content.slice(0, 800)}...` : content);
    } else {
      console.log(`❌ [OpenAI:${label}] Resposta vazia`);
      throw new Error('empty_response');
    }

    try {
      const parsed = safeParseLlmJson<T>(content);
      const preview = JSON.stringify(parsed, null, 2);
      console.log(`✅ [OpenAI:${label}] JSON parse OK (${preview.length} chars)`);
      console.log(preview.length > 800 ? `${preview.slice(0, 800)}...` : preview);
      return parsed;
    } catch (err) {
      console.error(`❌ [OpenAI:${label}] Falha ao parsear JSON do OpenAI:`, err);
      console.error(`❌ [OpenAI:${label}] Conteúdo bruto retornado:`, content);
      throw err;
    }

  } catch (error) {
    console.error(`❌ [OpenAI:${label}] Erro na requisição:`, error);
    
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        throw new Error('OpenAI API: Chave de API inválida');
      }
      if (error.message.includes('429')) {
        throw new Error('OpenAI API: Limite de requisições excedido');
      }
      if (error.message.includes('500')) {
        throw new Error('OpenAI API: Erro interno do servidor');
      }
    }
    
    throw error;
  }
}

// Função para buscar preços - PRIORIDADE MÁXIMA com Webscraping
async function getPrices(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<PricesResponse> {
  console.log('💰 [OpenAI:prices] Iniciando busca de preços com webscraping + AI');
  
  try {
    // Primeiro: buscar dados reais do Mercado Livre via Unwrangle API
    const searchTerm = unwrangleService.formatSearchTerm(partName, vehicleBrand, vehicleModel, vehicleYear);
    console.log(`🔍 [OpenAI:prices] Buscando no Mercado Livre: "${searchTerm}"`);
    
    const webscrapingResult = await unwrangleService.searchMercadoLivre(searchTerm, 1);
    
    if ('error' in webscrapingResult) {
      console.error(`❌ [OpenAI:prices] Erro no webscraping: ${webscrapingResult.message}`);
      
      // Tratamento específico para diferentes tipos de erro do Unwrangle
      if (webscrapingResult.error === 'quota_exceeded') {
        const unwrangleError = new Error('Plano do unwrangle passou dos limites');
        (unwrangleError as any).code = 'UNWRANGLE_LIMIT_EXCEEDED';
        throw unwrangleError;
      }
      
      // Outros erros do webscraping
      const webscrapeError = new Error(`Erro no webscraping: ${webscrapingResult.message}`);
      (webscrapeError as any).code = 'WEBSCRAPING_FAILED';
      throw webscrapeError;
    }
    
    console.log(`✅ [OpenAI:prices] Webscraping bem-sucedido: ${webscrapingResult.result_count} resultados`);
    console.log(`💳 [OpenAI:prices] Créditos: ${webscrapingResult.credits_used} usados, ${webscrapingResult.remaining_credits} restantes`);
    
    // Mapear TODOS os campos disponíveis da resposta (não apenas alguns)
    const webscrapingData = {
      results: webscrapingResult.results.map(item => ({
        name: item.name,
        price: item.price,
        url: item.url,
        thumbnail: item.thumbnail,
        brand: item.brand,
        rating: item.rating,
        total_ratings: item.total_ratings,
        listing_price: item.listing_price,
        currency_symbol: item.currency_symbol,
        currency: item.currency
      }))
    };

    // Segundo: enviar dados para o AI analisar
    const prompt = buildPricesPrompt(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear, webscrapingData);
    
    console.log('💰 [OpenAI:prices] Enviando dados de webscraping para AI analisar');
    console.log(`💰 [OpenAI:prices] Prompt (${prompt.length} chars)`);
    console.log('🤖 [OpenAI:prices] Modo: Análise APENAS de dados reais de webscraping');

    // A IA agora retorna apenas os anúncios filtrados, não os preços
    const filteredAdsResult = await callOpenAIWithPrompt<{ ads: Array<{ title: string; price: number; url: string }> }>(
      prompt,
      90000, // 1.5 minutos de timeout
      'prices'
    );
    
    console.log('✅ [OpenAI:prices] Anúncios filtrados pela AI recebidos');
    
    // Calcula preços automaticamente baseado nos anúncios filtrados
    const result = calculatePricesFromAds(filteredAdsResult);
    
    console.log('✅ [OpenAI:prices] Preços calculados automaticamente baseado nos anúncios');
    
    // Log dos preços calculados
    console.log(`💰 [Prices] Preços calculados: R$${result.prices.min_price} - R$${result.prices.suggested_price} - R$${result.prices.max_price}`);
    
    // Log dos anúncios encontrados (se houver)
    if (result.ads && result.ads.length > 0) {
      console.log(`🔗 [Prices] ${result.ads.length} anúncios filtrados pela AI:`);
      result.ads.forEach((ad, index) => {
        console.log(`   ${index + 1}. R$${ad.price} - ${ad.title}`);
        console.log(`      URL: ${ad.url}`);
      });
    } else {
      console.log('🔗 [Prices] Nenhum anúncio relevante encontrado pela AI');
    }
    
    return result;

  } catch (err) {
    console.error('❌ [OpenAI:prices] Erro no processamento de preços:', err);
    throw err; // Propaga o erro ao invés de usar fallback
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
  const desc = partDescription ? ` ${partDescription}` : '';
  const prompt = `Crie uma descrição de anúncio profissional para venda de autopeça usada no Mercado Livre brasileiro.

Peça: ${partName}${desc}
Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}

Requisitos:
- Descrição atrativa e profissional
- Mencionar estado de conservação
- Destacar compatibilidade
- Incluir informações técnicas relevantes
- Máximo 200 palavras
- Linguagem persuasiva para vendas

Retorne APENAS o JSON:
{
  "ad_description": "descrição_completa_aqui"
}`;

  try {
    const result = await callOpenAIWithPrompt<AdDescriptionResponse>(
      prompt,
      90000, // 1.5 minutos de timeout
      'ad_description'
    );
    
    console.log('✅ [OpenAI:ad_description] Descrição gerada com sucesso');
    return result;
    
  } catch (error) {
    console.error('❌ [OpenAI:ad_description] Erro na geração da descrição:', error);
    throw error; // Propaga o erro ao invés de usar fallback
  }
}

// Função para estimar dimensões
async function getDimensions(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<DimensionsResponse> {
  const desc = partDescription ? ` ${partDescription}` : '';
  const prompt = `Estime as dimensões reais da autopeça para embalagem e envio.

Peça: ${partName}${desc}
Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}

Baseado em especificações técnicas reais dessa peça para esse veículo, estime:
- Largura, altura e profundidade em centímetros
- Considere dimensões práticas para embalagem
- Use conhecimento técnico automotivo
- Seja preciso baseado no modelo específico

Retorne APENAS o JSON:
{
  "dimensions": {
    "width": "valor_em_cm",
    "height": "valor_em_cm", 
    "depth": "valor_em_cm",
    "unit": "cm"
  }
}`;

  try {
    const result = await callOpenAIWithPrompt<DimensionsResponse>(
      prompt,
      90000,
      'dimensions'
    );
    
    console.log('✅ [OpenAI:dimensions] Dimensões calculadas com sucesso');
    return result;
    
  } catch (error) {
    console.error('❌ [OpenAI:dimensions] Erro no cálculo de dimensões:', error);
    throw error; // Propaga o erro ao invés de usar fallback
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
  const desc = partDescription ? ` ${partDescription}` : '';
  const prompt = `Estime o peso real da autopeça para cálculo de frete.

Peça: ${partName}${desc}
Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}

Baseado em especificações técnicas reais:
- Peso aproximado em quilogramas (kg)
- Considere material e construção da peça
- Use conhecimento técnico automotivo
- Seja preciso para o modelo específico
- Retorne número decimal (ex: 2.5)

Retorne APENAS o JSON:
{
  "weight": numero_em_kg
}`;

  try {
    const result = await callOpenAIWithPrompt<WeightResponse>(
      prompt,
      90000,
      'weight'
    );
    
    console.log('✅ [OpenAI:weight] Peso calculado com sucesso');
    return result;
    
  } catch (error) {
    console.error('❌ [OpenAI:weight] Erro no cálculo de peso:', error);
    throw error; // Propaga o erro ao invés de usar fallback
  }
}

// Função para determinar compatibilidade
async function getCompatibility(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<CompatibilityResponse> {
  const desc = partDescription ? ` ${partDescription}` : '';
  const prompt = `Determine a compatibilidade real dessa autopeça com outros veículos.

Peça: ${partName}${desc}
Veículo Original: ${vehicleBrand} ${vehicleModel} ${vehicleYear}

Baseado em conhecimento técnico automotivo:
- Liste veículos compatíveis (mesma marca/grupo ou intercambiáveis)
- Considere anos próximos com mesmas especificações
- Inclua apenas compatibilidades REAIS e confirmadas
- Foque em veículos vendidos no Brasil
- Máximo 5 veículos compatíveis

Retorne APENAS o JSON:
{
  "compatibility": [
    {
      "brand": "marca",
      "model": "modelo",
      "year": "ano_ou_intervalo"
    }
  ]
}`;

  try {
    const result = await callOpenAIWithPrompt<CompatibilityResponse>(
      prompt,
      90000,
      'compatibility'
    );
    
    console.log('✅ [OpenAI:compatibility] Compatibilidade calculada com sucesso');
    return result;
    
  } catch (error) {
    console.error('❌ [OpenAI:compatibility] Erro no cálculo de compatibilidade:', error);
    throw error; // Propaga o erro ao invés de usar fallback
  }
}

/**
 * Função principal que processa peça usando OpenAI GPT-5 Mini com prompts separados e Webscraping para preços
 */
export async function processPartWithOpenAI(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<PartProcessingWithPrices | ProcessingError> {
  
  console.log(`🤖 [OPENAI] Iniciando processamento com GPT-5 Mini + Webscraping: ${partName}`);
  console.log(`🚗 Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`);
  
  try {
    // Executa todas as chamadas em paralelo para melhor performance
    // PRIORIDADE: Preços com Webscraping | Outros: GPT-5 Mini normal
    console.log('🔄 Executando todas as consultas com GPT-5 Mini (Webscraping APENAS para preços)...');
    const [
      pricesResult,
      adDescriptionResult,
      dimensionsResult,
      weightResult,
      compatibilityResult
    ] = await Promise.all([
      getPrices(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear), // PRIORIDADE: Com Webscraping
      getAdDescription(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear), // ChatGPT normal
      getDimensions(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear), // ChatGPT normal
      getWeight(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear), // ChatGPT normal
      getCompatibility(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear) // GPT-5 Mini normal
    ]);

    console.log('✅ Todas as consultas concluídas com GPT-5 Mini');

    // Combina todos os resultados
    const combinedResult: PartProcessingWithPrices = {
      prices: pricesResult.prices,
      ad_description: adDescriptionResult.ad_description,
      dimensions: dimensionsResult.dimensions,
      weight: weightResult.weight,
      compatibility: compatibilityResult.compatibility
    };

    // Adiciona anúncios se encontrados pelo webscraping
    if (pricesResult.ads && pricesResult.ads.length > 0) {
      combinedResult.ads = pricesResult.ads;
      console.log(`🔗 [Final] Incluindo ${pricesResult.ads.length} anúncios encontrados na resposta`);
    }

    console.log('✅ Processamento com GPT-5 Mini + Webscraping concluído');
    return combinedResult;

  } catch (error) {
    console.error('❌ Erro no processamento com GPT-5 Mini:', error);
    
    if (error instanceof Error) {
      // Propaga erros específicos com código
      const errorCode = (error as any).code;
      if (errorCode) {
        throw error; // Deixa o controller tratar o erro específico
      }
      
      if (error.message.includes('timeout')) {
        return {
          error: "openai_timeout",
          message: "Processamento muito lento - tente novamente."
        };
      }
      
      if (error.message.includes('OpenAI API')) {
        return {
          error: "openai_api_error",
          message: "Erro na API do OpenAI. Verifique sua conexão e chave de API."
        };
      }
    }

    return {
      error: "api_error", 
      message: "Erro no processamento com IA. Tente novamente."
    };
  }
}
