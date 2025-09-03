import axios from 'axios';
import {
  buildPricesPrompt
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

// Instância compartilhada do Grok
let grokApiKey: string;

function initializeGrok() {
  if (!grokApiKey) {
    if (!process.env.GROK_API_KEY) {
      console.log('GROK_API_KEY não encontrada nas variáveis de ambiente');
      throw new Error('GROK_API_KEY is required');
    }

    console.log('✅ Chave Grok encontrada, inicializando...');
    grokApiKey = process.env.GROK_API_KEY;
  }
  return grokApiKey;
}

function cleanGrokResponse(content: string): string {
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
  const cleaned = cleanGrokResponse(rawContent);
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

// Função auxiliar para fazer chamadas ao Grok
async function callGrokWithPrompt<T>(
  prompt: string,
  timeoutMs = 90000, // Timeout padrão de 1.5 minutos
  label = 'generic',
  useSearch = false
): Promise<T> {
  const apiKey = initializeGrok();
  
  console.log(`\n🔎 [Grok:${label}] Prompt (${prompt.length} chars):`);
  console.log(prompt.length > 600 ? `${prompt.slice(0, 600)}...` : prompt);
  console.log(`📤 [Grok:${label}] Enviando requisição (timeout: ${timeoutMs}ms, live search: ${useSearch})`);

  const requestData: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature: number;
    max_tokens: number;
    search_parameters?: {
      mode: string;
      sources: Array<{ type: string }>;
      max_search_results: number;
      return_citations: boolean;
    };
  } = {
    model: 'grok-3', // Usando Grok 4
    messages: [
      {
        role: 'system',
        content: 'Você é um especialista em autopeças brasileiras. Pesquise e analise detalhadamente para retornar a resposta mais precisa possível em formato JSON válido.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    max_tokens: 4096
  };

  // Adiciona live search apenas quando necessário (para pesquisa de preços)
  if (useSearch) {
    requestData.search_parameters = {
      mode: 'on', // FORÇAR Live Search sempre ativo
      sources: [
        { type: 'web' }
      ],
      max_search_results: 10,
      return_citations: true
    };
    console.log(`🔍 [Grok:${label}] Live Search FORÇADO como 'on' - Pesquisa ativa garantida`);
    console.log(`🔍 [Grok:${label}] Parâmetros Live Search enviados:`, JSON.stringify(requestData.search_parameters, null, 2));
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Grok timeout após ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const grokPromise = axios.post('https://api.x.ai/v1/chat/completions', requestData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: timeoutMs
    });

    const response = await Promise.race([grokPromise, timeoutPromise]);
    
    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
      throw new Error('Invalid response from Grok API');
    }

    const content = response.data.choices[0].message?.content;
    
    // Log detalhado do uso de fontes quando live search é usado
    if (useSearch) {
      console.log(`\n🔍 === VERIFICAÇÃO LIVE SEARCH [${label}] ===`);
      console.log('📋 Dados de usage completos:', JSON.stringify(response.data.usage, null, 2));
      
      if (response.data.usage) {
        const sourcesUsed = response.data.usage.num_sources_used || 0;
        const cost = sourcesUsed * 0.025; // $0.025 por fonte
        
        console.log(`🔍 Fontes utilizadas: ${sourcesUsed}`);
        console.log(`💰 Custo: $${cost.toFixed(4)}`);
        
        if (sourcesUsed > 0) {
          console.log('✅ LIVE SEARCH CONFIRMADO: Fontes externas foram utilizadas!');
        } else {
          console.log('⚠️  Live Search configurado (mode: on), mas 0 fontes utilizadas');
          console.log('   Isso pode acontecer se o modelo decidir que não precisa de busca externa');
        }
      } else {
        console.log('❌ Nenhuma informação de usage encontrada na resposta');
      }
      
      // Verifica citações
      if (response.data.citations && response.data.citations.length > 0) {
        console.log(`📚 Citações encontradas: ${response.data.citations.length}`);
        response.data.citations.forEach((citation: any, index: number) => {
          console.log(`   ${index + 1}. ${citation.url || citation.title || 'Fonte'}`);
        });
      } else {
        console.log('📚 Nenhuma citação retornada');
      }
      
      console.log('🔍 === FIM VERIFICAÇÃO ===\n');
    }
    
    console.log(`📥 [Grok:${label}] Resposta recebida (${content?.length || 0} chars):`);
    
    if (content) {
      console.log(content.length > 800 ? `${content.slice(0, 800)}...` : content);
    } else {
      console.log(`❌ [Grok:${label}] Resposta vazia`);
      throw new Error('empty_response');
    }

    try {
      const parsed = safeParseLlmJson<T>(content);
      const preview = JSON.stringify(parsed, null, 2);
      console.log(`✅ [Grok:${label}] JSON parse OK (${preview.length} chars)`);
      console.log(preview.length > 800 ? `${preview.slice(0, 800)}...` : preview);
      return parsed;
    } catch (err) {
      console.error(`❌ [Grok:${label}] Falha ao parsear JSON do Grok:`, err);
      console.error(`❌ [Grok:${label}] Conteúdo bruto retornado:`, content);
      throw err;
    }

  } catch (error) {
    console.error(`❌ [Grok:${label}] Erro na requisição:`, error);
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Grok API: Chave de API inválida');
      }
      if (error.response?.status === 429) {
        throw new Error('Grok API: Limite de requisições excedido');
      }
      if (error.response?.status && error.response.status >= 500) {
        throw new Error('Grok API: Erro interno do servidor');
      }
    }
    
    throw error;
  }
}

// Função para buscar preços - PRIORIDADE MÁXIMA com Live Search
async function getPrices(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<PricesResponse> {
  console.log('💰 [Grok:prices] Iniciando busca de preços com webscraping + AI');
  
  try {
    // Primeiro: buscar dados reais do Mercado Livre via Unwrangle API
    const searchTerm = unwrangleService.formatSearchTerm(partName, vehicleBrand, vehicleModel, vehicleYear);
    console.log(`🔍 [Grok:prices] Buscando no Mercado Livre: "${searchTerm}"`);
    
    const webscrapingResult = await unwrangleService.searchMercadoLivre(searchTerm, 1);
    
    let webscrapingData;
    if ('error' in webscrapingResult) {
      console.error(`❌ [Grok:prices] Erro no webscraping: ${webscrapingResult.message}`);
      throw new Error(`Webscraping falhou: ${webscrapingResult.message}`);
    } else {
      console.log(`✅ [Grok:prices] Webscraping bem-sucedido: ${webscrapingResult.result_count} resultados`);
      
      // 🔍 LOG COMPLETO DA RESPOSTA UNWRANGLE (dados brutos + tratados)
      console.log('📊 [DEBUG] RESPOSTA COMPLETA DA API UNWRANGLE:');
      console.log('=====================================');
      console.log('🔍 Busca:', webscrapingResult.search);
      console.log('📊 Total encontrado:', webscrapingResult.total_results);
      console.log('📦 Esta página:', webscrapingResult.result_count);
      console.log('💳 Créditos usados:', webscrapingResult.credits_used);
      console.log('💰 Créditos restantes:', webscrapingResult.remaining_credits);
      console.log('🛒 RESULTADOS (enviados para AI):');
      console.log(JSON.stringify(webscrapingResult.results, null, 2));
      console.log('=====================================');
      
      // Mapear TODOS os campos disponíveis da resposta (não apenas alguns)
      webscrapingData = {
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
    }

    // Segundo: enviar dados para o AI analisar
    const prompt = buildPricesPrompt(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear, webscrapingData);
    
    console.log('💰 [Grok:prices] Enviando dados de webscraping para AI analisar');
    console.log(`💰 [Grok:prices] Prompt (${prompt.length} chars)`);
    console.log('🤖 [Grok:prices] Modo: Análise APENAS de dados reais de webscraping (sem Live Search)');

    const result = await callGrokWithPrompt<PricesResponse>(
      prompt,
      90000, // 1.5 minutos de timeout
      'prices',
      false // NUNCA usar Live Search - apenas análise de dados
    );
    
    // Normalizar formato da resposta - AI às vezes retorna "min" ao invés de "min_price"
    if (result.prices && 'min' in result.prices && !('min_price' in result.prices)) {
      const normalizedPrices = result.prices as any;
      result.prices = {
        min_price: normalizedPrices.min,
        suggested_price: normalizedPrices.suggested,
        max_price: normalizedPrices.max
      };
      console.log('🔄 [Grok:prices] Formato normalizado: min -> min_price, suggested -> suggested_price, max -> max_price');
    }

    // Validação especial para prices - nunca aceitar null
    if (!result.prices || 
        result.prices.min_price === null || 
        result.prices.suggested_price === null || 
        result.prices.max_price === null ||
        result.prices.min_price === undefined || 
        result.prices.suggested_price === undefined || 
        result.prices.max_price === undefined) {
      console.warn('⚠️ [Grok:prices] Resposta contém valores null/undefined, tentando novamente...');
      console.warn('⚠️ [Grok:prices] Valores recebidos:', JSON.stringify(result.prices, null, 2));
      throw new Error('invalid_prices');
    }

    console.log('✅ [Grok:prices] Preços válidos obtidos com webscraping + AI');
    
    // Log dos preços encontrados
    console.log(`💰 [Prices] Preços: R$${result.prices.min_price} - R$${result.prices.suggested_price} - R$${result.prices.max_price}`);
    
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
    console.warn('⚠️ [Grok:prices] Primeira tentativa falhou, tentando prompt simplificado...');
    console.log('🔍 [Grok:prices] Erro capturado:', err);
    
    // Segunda tentativa com prompt mais direto (sem live search para economizar)
    const simplePrompt = `Estime preços realistas para a peça automotiva "${partName}" no mercado brasileiro atual (2025).

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
      const result2 = await callGrokWithPrompt<PricesResponse>(
        simplePrompt,
        90000, // 1.5 minutos de timeout
        'prices_fallback',
        false // Sem live search no fallback
      );
      
      if (result2.prices && 
          typeof result2.prices.min_price === 'number' && 
          typeof result2.prices.suggested_price === 'number' && 
          typeof result2.prices.max_price === 'number') {
        console.log('✅ [Grok:prices] Sucesso na segunda tentativa');
        
        // Log dos preços da segunda tentativa
        console.log(`💰 [Prices] Preços (2ª tentativa): R$${result2.prices.min_price} - R$${result2.prices.suggested_price} - R$${result2.prices.max_price}`);
        
        return result2;
      }
    } catch (err2) {
      console.warn('⚠️ [Grok:prices] Segunda tentativa também falhou');
    }

    // Fallback final baseado no tipo de peça
    console.warn('⚠️ [Grok:prices] Usando fallback inteligente baseado na peça');
    const baseName = partName.toLowerCase();
    let basePrice = 150; // Padrão

    if (baseName.includes('alternador')) {
      basePrice = 250;
    } else if (baseName.includes('motor')) {
      basePrice = 800;
    } else if (baseName.includes('transmissao')) {
      basePrice = 1200;
    } else if (baseName.includes('freio')) {
      basePrice = 120;
    } else if (baseName.includes('lanterna')) {
      basePrice = 80;
    } else if (baseName.includes('farol')) {
      basePrice = 150;
    } else if (baseName.includes('para-choque')) {
      basePrice = 200;
    } else if (baseName.includes('porta')) {
      basePrice = 300;
    }

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
    const result = await callGrokWithPrompt<AdDescriptionResponse>(
      prompt,
      90000, // 1.5 minutos de timeout
      'ad_description',
      false // SEM live search para não afetar prioridade dos preços
    );
    
    console.log('✅ [Grok:ad_description] Descrição gerada com sucesso');
    return result;
    
  } catch (error) {
    console.warn('⚠️ [Grok:ad_description] Erro, usando fallback mínimo');
    // Fallback mínimo apenas em caso de erro
    return {
      ad_description: `${partName}${desc} original para ${vehicleBrand} ${vehicleModel} ${vehicleYear}. Peça em excelente estado de conservação, removida de veículo em funcionamento. Ideal para reposição ou manutenção preventiva.`
    };
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
    const result = await callGrokWithPrompt<DimensionsResponse>(
      prompt,
      90000,
      'dimensions', 
      false // SEM live search
    );
    
    console.log('✅ [Grok:dimensions] Dimensões calculadas com sucesso');
    return result;
    
  } catch (error) {
    console.warn('⚠️ [Grok:dimensions] Erro, usando estimativa baseada na peça');
    // Fallback inteligente apenas em caso de erro
    const partLower = partName.toLowerCase();
    let dimensions = { width: "20", height: "15", depth: "10", unit: "cm" };
    
    if (partLower.includes('para-choque') || partLower.includes('parachoque')) {
      dimensions = { width: "150", height: "40", depth: "25", unit: "cm" };
    } else if (partLower.includes('farol') || partLower.includes('lanterna')) {
      dimensions = { width: "35", height: "25", depth: "20", unit: "cm" };
    } else if (partLower.includes('retrovisor') || partLower.includes('espelho')) {
      dimensions = { width: "25", height: "20", depth: "15", unit: "cm" };
    } else if (partLower.includes('porta') || partLower.includes('portinha')) {
      dimensions = { width: "120", height: "80", depth: "8", unit: "cm" };
    } else if (partLower.includes('capô') || partLower.includes('capo')) {
      dimensions = { width: "150", height: "120", depth: "5", unit: "cm" };
    }
    
    return { dimensions };
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
    const result = await callGrokWithPrompt<WeightResponse>(
      prompt,
      90000,
      'weight',
      false // SEM live search
    );
    
    console.log('✅ [Grok:weight] Peso calculado com sucesso');
    return result;
    
  } catch (error) {
    console.warn('⚠️ [Grok:weight] Erro, usando estimativa baseada na peça');
    // Fallback inteligente apenas em caso de erro
    const baseName = partName.toLowerCase();
    let estimatedWeight = 2.0;
    
    if (baseName.includes('motor')) {
      estimatedWeight = 120.0;
    } else if (baseName.includes('transmissao') || baseName.includes('cambio')) {
      estimatedWeight = 50.0;
    } else if (baseName.includes('alternador')) {
      estimatedWeight = 6.5;
    } else if (baseName.includes('bateria')) {
      estimatedWeight = 15.0;
    } else if (baseName.includes('radiador')) {
      estimatedWeight = 8.0;
    } else if (baseName.includes('para-choque')) {
      estimatedWeight = 12.0;
    } else if (baseName.includes('porta')) {
      estimatedWeight = 25.0;
    } else if (baseName.includes('capo')) {
      estimatedWeight = 18.0;
    } else if (baseName.includes('freio') || baseName.includes('disco')) {
      estimatedWeight = 5.0;
    } else if (baseName.includes('roda') || baseName.includes('aro')) {
      estimatedWeight = 10.0;
    } else if (baseName.includes('farol') || baseName.includes('lanterna')) {
      estimatedWeight = 1.5;
    }
    
    return {
      weight: estimatedWeight
    };
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
    const result = await callGrokWithPrompt<CompatibilityResponse>(
      prompt,
      90000,
      'compatibility',
      false // SEM live search
    );
    
    console.log('✅ [Grok:compatibility] Compatibilidade calculada com sucesso');
    return result;
    
  } catch (error) {
    console.warn('⚠️ [Grok:compatibility] Erro, retornando veículo original');
    // Fallback: apenas o veículo original
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

/**
 * Função principal que processa peça usando Grok com prompts separados e Live Search para preços
 */
export async function processPartWithGrok(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<PartProcessingWithPrices | ProcessingError> {
  
  console.log(`🤖 [GROK] Iniciando processamento com Grok + Webscraping: ${partName}`);
  console.log(`🚗 Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`);
  
  try {
    // Executa todas as chamadas em paralelo para melhor performance
    // PRIORIDADE: Preços com Webscraping | Outros: Grok normal (sem live search)
    console.log('🔄 Executando todas as consultas com Grok (Webscraping APENAS para preços)...');
    const [
      pricesResult,
      adDescriptionResult,
      dimensionsResult,
      weightResult,
      compatibilityResult
    ] = await Promise.all([
      getPrices(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear), // PRIORIDADE: Com Webscraping
      getAdDescription(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear), // Grok normal
      getDimensions(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear), // Grok normal
      getWeight(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear), // Grok normal
      getCompatibility(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear) // Grok normal
    ]);

    console.log('✅ Todas as consultas concluídas com Grok');

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

    console.log('✅ Processamento com Grok + Webscraping concluído');
    return combinedResult;

  } catch (error) {
    console.error('❌ Erro no processamento com Grok:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return {
          error: "grok_timeout",
          message: "Processamento muito lento - tente novamente."
        };
      }
      
      if (error.message.includes('API')) {
        return {
          error: "grok_api_error",
          message: "Erro na API do Grok. Verifique sua conexão e chave de API."
        };
      }
    }

    return {
      error: "api_error", 
      message: "Erro no processamento com IA. Tente novamente."
    };
  }
}
