import OpenAI from 'openai';
import {
  buildPricesPrompt,
  calculatePricesFromAds
} from '../prompts/part-processing.prompts.js';
import { unwrangleService } from './unwrangle.service.js';
import { filterUnwrangleAds } from './ad-filtering.service.js';

// Tipos para compatibilidade com o sistema existente
interface ProcessingError {
  error: string;
  message: string;
}

interface PartProcessingWithPrices {
  ad_title: string;
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

// Função auxiliar para fazer chamadas ao OpenAI (sem retry, timeout indefinido)
async function callOpenAIWithPrompt<T>(
  prompt: string,
  timeoutMs = 0, // 0 = sem timeout
  label = 'generic'
): Promise<T> {
  const client = initializeOpenAI();
  
  console.log(`\n🔎 [OpenAI:${label}] Prompt (${prompt.length} chars):`);
  console.log(prompt.length > 600 ? `${prompt.slice(0, 600)}...` : prompt);
  console.log(`📤 [OpenAI:${label}] Enviando requisição (timeout: ${timeoutMs === 0 ? 'INDEFINIDO' : timeoutMs + 'ms'})`);

  try {
    let openaiPromise = client.chat.completions.create({
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

    // Se timeoutMs > 0, aplica timeout, senão espera indefinidamente
    let response;
    if (timeoutMs > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`OpenAI timeout após ${timeoutMs}ms`));
        }, timeoutMs);
      });
      response = await Promise.race([openaiPromise, timeoutPromise]);
    } else {
      response = await openaiPromise;
    }
    
    if (!response.choices || response.choices.length === 0) {
      const invalidResponseError = new Error('Invalid response from OpenAI API');
      (invalidResponseError as any).code = 'OPENAI_INVALID_RESPONSE';
      throw invalidResponseError;
    }

    const content = response.choices[0].message?.content;
    
    console.log(`📥 [OpenAI:${label}] Resposta recebida (${content?.length || 0} chars):`);
    
    if (!content || content.trim().length === 0) {
      console.log(`❌ [OpenAI:${label}] Resposta vazia`);
      const emptyResponseError = new Error('Resposta vazia da OpenAI');
      (emptyResponseError as any).code = 'OPENAI_EMPTY_RESPONSE';
      throw emptyResponseError;
    }

    console.log(content.length > 800 ? `${content.slice(0, 800)}...` : content);

    try {
      const parsed = safeParseLlmJson<T>(content);
      const preview = JSON.stringify(parsed, null, 2);
      console.log(`✅ [OpenAI:${label}] JSON parse OK (${preview.length} chars)`);
      console.log(preview.length > 800 ? `${preview.slice(0, 800)}...` : preview);
      return parsed;
    } catch (err) {
      console.error(`❌ [OpenAI:${label}] Falha ao parsear JSON do OpenAI:`, err);
      console.error(`❌ [OpenAI:${label}] Conteúdo bruto retornado:`, content);
      const jsonParseError = new Error('Resposta JSON inválida');
      (jsonParseError as any).code = 'OPENAI_INVALID_JSON';
      throw jsonParseError;
    }

  } catch (error) {
    console.error(`❌ [OpenAI:${label}] Erro na requisição:`, error);
    
    if (error instanceof Error) {
      // Erros específicos
      if (error.message.includes('401')) {
        const authError = new Error('OpenAI API: Chave de API inválida');
        (authError as any).code = 'OPENAI_AUTH_ERROR';
        throw authError;
      }
      if (error.message.includes('429')) {
        const rateLimitError = new Error('OpenAI API: Limite de requisições excedido');
        (rateLimitError as any).code = 'OPENAI_RATE_LIMIT';
        throw rateLimitError;
      }
      if (error.message.includes('500')) {
        const serverError = new Error('OpenAI API: Erro interno do servidor');
        (serverError as any).code = 'OPENAI_SERVER_ERROR';
        throw serverError;
      }
      
      // Se já tem código específico, propaga diretamente
      if ((error as any).code) {
        throw error;
      }
    }
    
    const genericError = new Error('OpenAI API: Erro na requisição');
    (genericError as any).code = 'OPENAI_GENERIC_ERROR';
    throw genericError;
  }
}

// Função para buscar preços - PRIORIDADE MÁXIMA com Webscraping e Filtragem Personalizada
async function getPrices(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string | null,
  vehicleModel: string | null,
  vehicleYear: number | null,
  useVehicleInSearch: boolean = true
): Promise<PricesResponse> {
  console.log('💰 [FilteringService:prices] Iniciando busca de preços com webscraping + filtro personalizado');
  
  try {
    // Primeiro: buscar dados reais do Mercado Livre via Unwrangle API
    const searchTerm = useVehicleInSearch && vehicleBrand && vehicleModel && vehicleYear 
      ? unwrangleService.formatSearchTerm(partName, vehicleBrand, vehicleModel, vehicleYear)
      : partName; // Busca apenas pelo nome da peça se useVehicleInSearch=false
    console.log(`🔍 [FilteringService:prices] Buscando no Mercado Livre: "${searchTerm}" (useVehicleInSearch: ${useVehicleInSearch})`);
    
    const webscrapingResult = await unwrangleService.searchMercadoLivre(searchTerm, 1);
    
    if ('error' in webscrapingResult) {
      console.error(`❌ [FilteringService:prices] Erro no webscraping: ${webscrapingResult.message}`);
      
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
    
    console.log(`✅ [FilteringService:prices] Webscraping bem-sucedido: ${webscrapingResult.result_count} resultados`);
    console.log(`💳 [FilteringService:prices] Créditos: ${webscrapingResult.credits_used} usados, ${webscrapingResult.remaining_credits} restantes`);
    
    // Segundo: usar nosso sistema de filtragem personalizado ao invés da IA
    console.log('🔍 [FilteringService:prices] Aplicando filtros personalizados aos anúncios...');
    console.log(`🔍 [FilteringService:prices] useVehicleInSearch: ${useVehicleInSearch}`);
    console.log(`🔍 [FilteringService:prices] Veículo para filtragem: ${useVehicleInSearch && vehicleBrand ? `${vehicleBrand} ${vehicleModel} ${vehicleYear}` : 'Nenhum (busca genérica)'}`);
    
    const filteringResult = filterUnwrangleAds(
      webscrapingResult.results,
      partName,
      partDescription,
      useVehicleInSearch ? vehicleBrand : null,
      useVehicleInSearch ? vehicleModel : null,
      useVehicleInSearch ? vehicleYear : null,
      {
        maxPriceVariation: 200, // Permite até 200% de variação do preço mediano
        minConfidence: 0.3, // Confiança mínima de 30%
        includeGenericParts: true // Inclui peças universais/genéricas
      }
    );
    
    console.log('✅ [FilteringService:prices] Filtragem personalizada completa');
    console.log('📊 [FilteringService:prices] Estatísticas da filtragem:', filteringResult.filteringStats);
    console.log(`📊 [FilteringService:prices] Anúncios processados: ${filteringResult.totalProcessed}, filtrados: ${filteringResult.totalFiltered}`);
    
    // Converter para o formato esperado pelo calculatePricesFromAds
    const filteredAdsResponse = {
      ads: filteringResult.ads.map(ad => ({
        title: ad.title,
        price: ad.price,
        url: ad.url
      }))
    };
    
    // Calcula preços automaticamente baseado nos anúncios filtrados
    const result = calculatePricesFromAds(filteredAdsResponse);
    
    console.log('✅ [FilteringService:prices] Preços calculados automaticamente baseado nos anúncios filtrados');
    
    // Log dos preços calculados
    console.log(`💰 [Prices] Preços calculados: R$${result.prices.min_price} - R$${result.prices.suggested_price} - R$${result.prices.max_price}`);
    
    // Log dos anúncios encontrados (se houver)
    if (result.ads && result.ads.length > 0) {
      console.log(`🔗 [Prices] ${result.ads.length} anúncios filtrados pelo sistema personalizado:`);
      result.ads.forEach((ad, index) => {
        const adWithConfidence = filteringResult.ads.find(filteredAd => filteredAd.title === ad.title);
        console.log(`   ${index + 1}. R$${ad.price} - ${ad.title}`);
        console.log(`      URL: ${ad.url}`);
        if (adWithConfidence) {
          console.log(`      Confiança: ${(adWithConfidence.confidence * 100).toFixed(1)}%`);
          console.log(`      Motivos: ${adWithConfidence.matchReasons.join(', ')}`);
        }
      });
    } else {
      console.log('🔗 [Prices] Nenhum anúncio relevante encontrado pelo sistema de filtragem');
    }
    
    return result;

  } catch (err) {
    console.error('❌ [FilteringService:prices] Erro no processamento de preços:', err);
    throw err; // Propaga o erro ao invés de usar fallback
  }
}

// Função para gerar descrição do anúncio
async function getAdDescription(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string | null,
  vehicleModel: string | null,
  vehicleYear: number | null,
  useVehicleInPrompt: boolean = true
): Promise<AdDescriptionResponse> {
  const desc = partDescription ? ` ${partDescription}` : '';
  
  let vehicleSection = '';
  if (useVehicleInPrompt && vehicleBrand && vehicleModel && vehicleYear) {
    vehicleSection = `\nVeículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`;
  } else if (!useVehicleInPrompt) {
    vehicleSection = '\nTipo: Peça automotiva genérica/universal';
  } else {
    vehicleSection = '\nCompatibilidade: Múltiplos veículos';
  }
  
  const prompt = `Crie uma descrição de anúncio profissional para venda de autopeça usada no Mercado Livre brasileiro.

Peça: ${partName}${desc}${vehicleSection}

Requisitos:
- Descrição atrativa e profissional
- Mencionar estado de conservação
- Destacar compatibilidade${useVehicleInPrompt ? '' : ' (sem mencionar veículo específico)'}
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
      0, // Sem timeout
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
  vehicleBrand: string | null,
  vehicleModel: string | null,
  vehicleYear: number | null,
  useVehicleInPrompt: boolean = true
): Promise<DimensionsResponse> {
  const desc = partDescription ? ` ${partDescription}` : '';
  
  let vehicleSection = '';
  if (useVehicleInPrompt && vehicleBrand && vehicleModel && vehicleYear) {
    vehicleSection = `\nVeículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`;
  } else if (!useVehicleInPrompt) {
    vehicleSection = '\nTipo: Peça automotiva genérica';
  } else {
    vehicleSection = '\nVeículo: padrão genérico';
  }
  
  const prompt = `Estime as dimensões reais da autopeça para embalagem e envio.

Peça: ${partName}${desc}${vehicleSection}

Baseado em especificações técnicas reais dessa peça${useVehicleInPrompt ? ' para esse veículo' : ''}, estime:
- Largura, altura e profundidade em centímetros
- Considere dimensões práticas para embalagem
- Use conhecimento técnico automotivo
- ${useVehicleInPrompt ? 'Seja preciso baseado no modelo específico' : 'Use dimensões típicas para esse tipo de peça'}

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
      0, // Sem timeout
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
  vehicleBrand: string | null,
  vehicleModel: string | null,
  vehicleYear: number | null,
  useVehicleInPrompt: boolean = true
): Promise<WeightResponse> {
  const desc = partDescription ? ` ${partDescription}` : '';
  
  let vehicleSection = '';
  if (useVehicleInPrompt && vehicleBrand && vehicleModel && vehicleYear) {
    vehicleSection = `\nVeículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`;
  } else if (!useVehicleInPrompt) {
    vehicleSection = '\nTipo: Peça automotiva genérica';
  } else {
    vehicleSection = '\nVeículo: padrão genérico';
  }
  
  const prompt = `Estime o peso real da autopeça para cálculo de frete.

Peça: ${partName}${desc}${vehicleSection}

Baseado em especificações técnicas reais:
- Peso aproximado em quilogramas (kg)
- Considere material e construção da peça
- Use conhecimento técnico automotivo
- ${useVehicleInPrompt ? 'Seja preciso para o modelo específico' : 'Use peso típico para esse tipo de peça'}
- Retorne número decimal (ex: 2.5)

Retorne APENAS o JSON:
{
  "weight": numero_em_kg
}`;

  try {
    const result = await callOpenAIWithPrompt<WeightResponse>(
      prompt,
      0, // Sem timeout
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
  vehicleBrand: string | null,
  vehicleModel: string | null,
  vehicleYear: number | null,
  useVehicleInPrompt: boolean = true
): Promise<CompatibilityResponse> {
  const desc = partDescription ? ` ${partDescription}` : '';
  
  const baseInstructions = `
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

  let prompt: string;
  
  if (useVehicleInPrompt && vehicleBrand && vehicleModel && vehicleYear) {
    // Usa veículo específico para compatibilidade
    prompt = `Determine a compatibilidade real dessa autopeça com outros veículos.

Peça: ${partName}${desc}
Veículo Original: ${vehicleBrand} ${vehicleModel} ${vehicleYear}${baseInstructions}`;
  } else {
    // Busca genérica - não menciona veículo específico
    prompt = `Determine a compatibilidade dessa autopeça com veículos brasileiros.

Peça: ${partName}${desc}
Contexto: Busca genérica - liste os veículos mais comuns que usam essa peça no mercado brasileiro${baseInstructions}`;
  }

  try {
    const result = await callOpenAIWithPrompt<CompatibilityResponse>(
      prompt,
      0, // Sem timeout
      'compatibility'
    );
    
    console.log('✅ [OpenAI:compatibility] Compatibilidade calculada com sucesso');
    return result;
    
  } catch (error) {
    console.error('❌ [OpenAI:compatibility] Erro no cálculo de compatibilidade:', error);
    throw error; // Propaga o erro ao invés de usar fallback
  }
}

// Função para gerar título do anúncio via IA
async function getAdTitle(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string | null,
  vehicleModel: string | null,
  vehicleYear: number | null,
  useVehicleInPrompt: boolean = true
): Promise<{ ad_title: string }> {
  const desc = partDescription ? ` ${partDescription}` : '';
  
  let vehicleSection = '';
  if (useVehicleInPrompt && vehicleBrand && vehicleModel && vehicleYear) {
    vehicleSection = `\nVeículo Original: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`;
  } else if (!useVehicleInPrompt) {
    vehicleSection = '\nTipo: Peça automotiva genérica/universal';
  }
  
  const prompt = `Crie um título otimizado para anúncio de autopeça no Mercado Livre brasileiro.

Peça: ${partName}${desc}${vehicleSection}

Requisitos para o título:
- Máximo 60 caracteres (limite do Mercado Livre)
- Incluir nome da peça
- ${useVehicleInPrompt ? 'Incluir marca e modelo do veículo principal' : 'NÃO mencionar veículo específico (peça genérica/universal)'}
- ${useVehicleInPrompt ? 'Incluir ano ou faixa de anos se possível' : 'Focar na universalidade da peça'}
- Linguagem atrativa para vendas
- Seguir padrão: "${useVehicleInPrompt ? 'Nome da Peça Marca Modelo Ano' : 'Nome da Peça Universal/Genérica'}"
- Ser direto e claro

Retorne APENAS o JSON:
{
  "ad_title": "título_otimizado_aqui"
}`;

  try {
    const result = await callOpenAIWithPrompt<{ ad_title: string }>(
      prompt,
      0, // Sem timeout
      'ad_title'
    );
    
    console.log('✅ [OpenAI:ad_title] Título gerado com sucesso');
    return result;
    
  } catch (error) {
    console.error('❌ [OpenAI:ad_title] Erro na geração do título:', error);
    throw error;
  }
}


/**
 * Função principal que processa peça usando OpenAI GPT-5 Mini com prompts separados e Webscraping para preços
 */
export async function processPartWithOpenAI(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string | null,
  vehicleModel: string | null,
  vehicleYear: number | null,
  useVehicleInSearch: boolean = true
): Promise<PartProcessingWithPrices | ProcessingError> {
  
  console.log(`🤖 [OPENAI] Iniciando processamento com GPT-5 Mini + Webscraping: ${partName}`);
  
  if (vehicleBrand && vehicleModel && vehicleYear) {
    console.log(`🚗 Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`);
  } else {
    console.log('🚗 Veículo: BUSCA GENÉRICA (sem dados do veículo)');
  }
  
  try {
    // Executa todas as chamadas em paralelo para melhor performance
    // PRIORIDADE: Preços com Webscraping | Outros: GPT-5 Mini normal
    console.log('🔄 Executando todas as consultas com GPT-5 Mini (Webscraping APENAS para preços)...');
    const [
      pricesResult,
      adDescriptionResult,
      dimensionsResult,
      weightResult,
      compatibilityResult,
      adTitleResult
    ] = await Promise.all([
      getPrices(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear, useVehicleInSearch), // PRIORIDADE: Com Webscraping
      getAdDescription(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear, useVehicleInSearch), // ChatGPT normal
      getDimensions(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear, useVehicleInSearch), // ChatGPT normal
      getWeight(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear, useVehicleInSearch), // ChatGPT normal
      getCompatibility(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear, useVehicleInSearch), // GPT-5 Mini normal
      getAdTitle(partName, partDescription, vehicleBrand, vehicleModel, vehicleYear, useVehicleInSearch) // Título em paralelo
    ]);

    console.log('✅ Todas as consultas concluídas com GPT-5 Mini');
    
    // Sempre usa o título gerado em paralelo (máxima performance)
    const finalAdTitle = adTitleResult.ad_title;
    console.log('✅ Usando título gerado em paralelo (máxima velocidade)');

    // Combina todos os resultados
    const combinedResult: PartProcessingWithPrices = {
      prices: pricesResult.prices,
      ad_title: finalAdTitle,
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
