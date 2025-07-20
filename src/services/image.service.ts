import OpenAI from 'openai';

interface ProcessedImageResult {
  partName: string;
  description: string;
}

interface ProcessedMultipleImageResult {
  name: string;
  description: string;
}

interface ProcessingError {
  error: string;
  message: string;
}

// Instância compartilhada do OpenAI
let openai: OpenAI;

function initializeOpenAI() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      console.log('OPENAI_API_KEY não encontrada nas variáveis de ambiente');
      throw new Error('OPENAI_API_KEY is required');
    }
    
    console.log('Chave OpenAI encontrada, inicializando...');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export function validateImage(buffer: Buffer, filename: string): boolean {
  // Verifica tamanho do arquivo (50MB = 50 * 1024 * 1024 bytes)
  const maxSizeInBytes = 52428800;
  if (buffer.length > maxSizeInBytes) {
    throw new Error('File size exceeds 50MB limit');
  }

  // Verifica formato do arquivo
  const jpegMagic = [0xFF, 0xD8, 0xFF];
  const pngMagic = [0x89, 0x50, 0x4E, 0x47];
  const webpMagic = [0x52, 0x49, 0x46, 0x46]; // Primeiros 4 bytes, seguidos por WEBP

  const isJpeg = jpegMagic.every((byte, index) => buffer[index] === byte);
  const isPng = pngMagic.every((byte, index) => buffer[index] === byte);
  const isWebp = webpMagic.every((byte, index) => buffer[index] === byte) && 
                 buffer.slice(8, 12).toString() === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    throw new Error('Invalid file format. Only JPEG, PNG and WEBP are allowed');
  }

  return true;
}

export function convertToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

function cleanOpenAIResponse(content: string): string {
  // Remove blocos de código markdown se presentes
  let cleanContent = content.trim();
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleanContent;
}

export async function processMultipleImages(dataUrls: string[]): Promise<ProcessedMultipleImageResult | ProcessingError> {
  try {
    const client = initializeOpenAI();
    
    console.log(`Iniciando análise de ${dataUrls.length} imagens`);
    dataUrls.forEach((url, index) => {
      const sizeInfo = url.length > 100 ? `${url.length} caracteres` : 'inválido';
      const typeMatch = url.match(/^data:([^;]+);base64,/);
      const mimeType = typeMatch ? typeMatch[1] : 'desconhecido';
      console.log(`  Imagem ${index + 1}: ${mimeType} (${sizeInfo})`);
    });

    const imageContent = dataUrls.map(url => ({
      type: "image_url" as const,
      image_url: {
        url: url
      }
    }));

    console.log('Enviando requisição para OpenAI...');
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Identifique a peça de carro na imagem e forneça seu nome e uma descrição detalhada.
Liste as informações no formato JSON:
{
  "name": "nome",
  "description": "descrição"
}

IMPORTANTE: 
- Analise todas as imagens fornecidas para ter uma visão completa da peça
- As imagens mostram a mesma peça de diferentes ângulos
- Forneça o nome específico da peça automotiva
- Inclua uma descrição detalhada com função, características e aplicações
- Se não conseguir identificar com certeza, retorne: {"error": "low_confidence", "message": "Não foi possível identificar a peça com precisão suficiente"}
- Seja específico e técnico na descrição`
            },
            ...imageContent
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    console.log('📥 Resposta OpenAI recebida');
    console.log('📄 Conteúdo bruto:', content);
    
    if (!content) {
      console.log('❌ Nenhum conteúdo na resposta OpenAI');
      return {
        error: "api_error",
        message: "Erro na resposta da API. Tente novamente ou insira os dados manualmente."
      };
    }

    try {
      const cleanContent = cleanOpenAIResponse(content);
      console.log('🧹 Conteúdo limpo:', cleanContent);
      const parsedResponse = JSON.parse(cleanContent);
      console.log('📊 Resposta parseada:', parsedResponse);
      
      // Verifica se é uma resposta de erro
      if (parsedResponse.error) {
        console.log('⚠️ OpenAI retornou resposta de erro:', parsedResponse.error);
        return {
          error: parsedResponse.error,
          message: "Não foi possível identificar a peça com precisão suficiente. Por favor, insira os dados manualmente."
        };
      }

      // Valida campos obrigatórios
      if (!parsedResponse.name || !parsedResponse.description) {
        console.log('❌ Campos obrigatórios ausentes:', { 
          hasName: !!parsedResponse.name, 
          hasDescription: !!parsedResponse.description 
        });
        return {
          error: "invalid_response",
          message: "Resposta incompleta da API. Por favor, insira os dados manualmente."
        };
      }

      // Verifica respostas vagas
      const vaguePhrases = [
        "não encontrei",
        "não consigo identificar",
        "não é possível",
        "imagem não está clara",
        "não tenho certeza"
      ];

      const responseText = `${parsedResponse.name} ${parsedResponse.description}`.toLowerCase();
      const hasVaguePhrase = vaguePhrases.some(phrase => responseText.includes(phrase));

      if (hasVaguePhrase) {
        console.log('⚠️ Resposta vaga detectada em:', responseText);
        return {
          error: "vague_response",
          message: "Não foi possível identificar a peça com precisão suficiente. Por favor, insira os dados manualmente."
        };
      }

      console.log('✅ Identificação bem-sucedida:', { 
        name: parsedResponse.name, 
        descriptionLength: parsedResponse.description.length 
      });
      return {
        name: parsedResponse.name,
        description: parsedResponse.description
      };

    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta OpenAI:', parseError);
      console.error('Resposta bruta OpenAI:', content);
      return {
        error: "parse_error",
        message: "Erro ao processar resposta da API. Por favor, insira os dados manualmente."
      };
    }

  } catch (error: unknown) {
    console.error('Erro da API OpenAI:', error);
    
    // Verifica se é erro de rate limit
    if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
      const errorObj = error as { headers?: { 'retry-after'?: string } };
      const retryAfter = errorObj.headers?.['retry-after'];
      const retryMessage = retryAfter ? ` Tente novamente em ${Math.ceil(Number(retryAfter) / 60)} minutos.` : '';
      return {
        error: "rate_limit",
        message: `Limite de uso da API excedido.${retryMessage} Tente novamente mais tarde ou insira os dados manualmente.`
      };
    }
    
    return {
      error: "api_error",
      message: "Erro de conexão com a API. Tente novamente ou insira os dados manualmente."
    };
  }
}

export async function identifyAutomotivePart(base64Image: string): Promise<ProcessedImageResult | ProcessingError> {
  try {
    const client = initializeOpenAI();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Identifique a peça de carro na imagem e forneça seu nome e uma descrição detalhada.
Liste as informações no formato JSON:
{
  "name": "nome da peça",
  "description": "descrição detalhada"
}

IMPORTANTE: 
- Forneça o nome específico da peça automotiva
- Inclua uma descrição detalhada com função, características e aplicações
- Se não conseguir identificar com certeza, retorne: {"error": "low_confidence", "message": "Não foi possível identificar a peça com precisão suficiente"}
- Seja específico e técnico na descrição`
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return {
        error: "api_error",
        message: "Erro na resposta da API. Tente novamente ou insira os dados manualmente."
      };
    }

    try {
      const cleanContent = cleanOpenAIResponse(content);
      const parsedResponse = JSON.parse(cleanContent);
      
      // Verifica se é uma resposta de erro
      if (parsedResponse.error) {
        return {
          error: parsedResponse.error,
          message: "Não foi possível identificar a peça com precisão suficiente. Por favor, insira os dados manualmente."
        };
      }

      // Valida campos obrigatórios
      if (!parsedResponse.partName || !parsedResponse.description) {
        return {
          error: "invalid_response",
          message: "Resposta incompleta da API. Por favor, insira os dados manualmente."
        };
      }

      return {
        partName: parsedResponse.partName,
        description: parsedResponse.description
      };

    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta OpenAI:', parseError);
      return {
        error: "parse_error",
        message: "Erro ao processar resposta da API. Por favor, insira os dados manualmente."
      };
    }

  } catch (error) {
    console.error('Erro da API OpenAI:', error);
    return {
      error: "api_error",
      message: "Erro de conexão com a API. Tente novamente ou insira os dados manualmente."
    };
  }
}

export async function processImage(buffer: Buffer, filename: string): Promise<ProcessedImageResult | ProcessingError> {
  try {
    validateImage(buffer, filename);
    const base64 = convertToBase64(buffer);
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    return await identifyAutomotivePart(dataUrl);

  } catch (error) {
    console.error('Erro no processamento da imagem:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('File size exceeds')) {
        return {
          error: "file_too_large",
          message: "Arquivo muito grande. Tamanho máximo permitido: 50MB."
        };
      }
      
      if (error.message.includes('Invalid file format')) {
        return {
          error: "invalid_format",
          message: "Formato de arquivo inválido. Apenas JPEG, PNG e WEBP são aceitos."
        };
      }
    }

    return {
      error: "processing_error",
      message: "Erro no processamento da imagem. Tente novamente ou insira os dados manualmente."
    };
  }
} 

// Interfaces para o processamento completo de peças
interface CompleteProcessingResult {
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
}

// Interface para processamento sem preços (preços virão do Mercado Livre)
interface PartProcessingWithoutPrices {
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
}

// Interface para processamento completo com preços gerados por IA
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
}

/**
 * Processa completamente uma peça usando IA para gerar todas as informações necessárias incluindo preços
 */
export async function processPartWithAI(
  dataUrls: string[],
  partName: string,
  partDescription: string,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number,
  includePrices = true
): Promise<PartProcessingWithPrices | PartProcessingWithoutPrices | ProcessingError> {
  try {
    const aiStartTime = Date.now();
    const client = initializeOpenAI();
    
    console.log(`🤖 Iniciando processamento completo da peça: ${partName}`);
    console.log(`🚗 Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`);
    console.log(`📸 Processando ${dataUrls.length} imagens`);

    // DEBUG: Análise detalhada das imagens para IA
    console.log(`🔍 DEBUG - Análise das imagens para IA:`);
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

    // Verifica tamanho das imagens para otimizar para iOS
    const totalPayloadSizeMB = (totalPayloadSize / 1024 / 1024).toFixed(2);
    console.log(`📊 DEBUG - Payload total para IA: ${totalPayloadSizeMB} MB`);
    console.log(`📊 DEBUG - Tamanho médio por imagem: ${(totalPayloadSize / dataUrls.length / 1024 / 1024).toFixed(2)} MB`);
    
    // Se as imagens são muito grandes, usa timeout mais longo
    const isLargeRequest = totalPayloadSize > 10000000; // 10MB
    const timeoutMs = isLargeRequest ? 40000 : 30000; // 40s para grandes, 30s para normais
    
    console.log(`⏱️ Usando timeout de ${timeoutMs/1000}s para esta requisição (${isLargeRequest ? 'GRANDE' : 'NORMAL'})`);

    // DEBUG: Análise da complexidade da requisição
    const estimatedTokens = Math.ceil(totalPayloadSize / 1000); // Estimativa grosseira
    console.log(`🧮 DEBUG - Tokens estimados: ${estimatedTokens.toLocaleString()}`);

    const imageContent = dataUrls.map(url => ({
      type: "image_url" as const,
      image_url: {
        url: url
      }
    }));

    console.log('📡 Enviando requisição completa para OpenAI...');
    const requestStartTime = Date.now();
    
    // Cria o JSON schema baseado em se deve incluir preços ou não
    const jsonSchema = includePrices ? `{
  "ad_title": "título otimizado para anúncio (máximo 60 caracteres)",
  "ad_description": "descrição detalhada para anúncio com características, estado e aplicação",
  "dimensions": {
    "width": "largura em cm",
    "height": "altura em cm", 
    "depth": "profundidade em cm",
    "unit": "cm"
  },
  "weight": peso_em_kg_como_numero,
  "compatibility": [
    {
      "brand": "marca_compatível",
      "model": "modelo_compatível", 
      "year": "ano_ou_faixa_de_anos"
    }
  ],
  "prices": {
    "min_price": preco_minimo_em_reais_numero,
    "suggested_price": preco_sugerido_em_reais_numero,
    "max_price": preco_maximo_em_reais_numero
  }
}` : `{
  "ad_title": "título otimizado para anúncio (máximo 60 caracteres)",
  "ad_description": "descrição detalhada para anúncio com características, estado e aplicação",
  "dimensions": {
    "width": "largura em cm",
    "height": "altura em cm", 
    "depth": "profundidade em cm",
    "unit": "cm"
  },
  "weight": peso_em_kg_como_numero,
  "compatibility": [
    {
      "brand": "marca_compatível",
      "model": "modelo_compatível", 
      "year": "ano_ou_faixa_de_anos"
    }
  ]
}`;

    // Instruções adicionais para preços se incluídos
    const priceInstructions = includePrices ? `
8. Para preços:
   - Pesquise no Mercado Livre Brasil atual (2025) por "${partName} ${vehicleBrand} ${vehicleModel}" usado
   - Base os preços em anúncios reais atuais de peças similares usadas
   - min_price: 30% menor que a média do mercado
   - suggested_price: preço médio de mercado atual
   - max_price: 20% maior que a média
   - Considere marca do veículo e raridade da peça
9. Retorne APENAS o JSON, sem texto adicional` : `
8. NÃO inclua informações de preços, apenas características técnicas
9. Retorne APENAS o JSON, sem texto adicional`;

    // Cria o request com timeout customizado
    const openaiPromise = client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Você é especialista em autopeças e conhece o Mercado Livre Brasil atual (2024).

PEÇA: ${partName} - ${partDescription}
VEÍCULO: ${vehicleBrand} ${vehicleModel} ${vehicleYear}

Analise as imagens e gere um JSON com especificações${includePrices ? ' e preços baseados no Mercado Livre atual' : ''}:

${jsonSchema}

INSTRUÇÕES:
1. Estime dimensões e peso baseado na imagem
2. Liste 3-5 veículos compatíveis 
3. Título como anúncios do Mercado Livre
4. Descrição de vendedor experiente
5. Considere peça usada em boa condição${priceInstructions}`
            },
            ...imageContent
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.2 // Reduzido para ser mais consistente com preços reais
    });

    // Timeout personalizado para iOS
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`OpenAI timeout após ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // DEBUG: Log antes do envio
    console.log(`🚀 DEBUG - Enviando para OpenAI (payload: ${totalPayloadSizeMB} MB, timeout: ${timeoutMs}ms)`);

    // Race entre request e timeout
    const response = await Promise.race([openaiPromise, timeoutPromise]);

    const requestTime = Date.now() - requestStartTime;
    console.log(`⏱️ DEBUG - Resposta OpenAI recebida em: ${requestTime}ms`);

    const content = response.choices[0]?.message?.content;
    console.log('📥 Resposta OpenAI recebida');
    
    // DEBUG: Análise da resposta
    if (content) {
      console.log(`📏 DEBUG - Tamanho da resposta: ${content.length} caracteres`);
      console.log(`📄 Conteúdo bruto (primeiros 200 chars): ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
    } else {
      console.log('❌ DEBUG - Nenhum conteúdo na resposta OpenAI');
    }
    
    if (!content) {
      console.log('❌ Nenhum conteúdo na resposta OpenAI');
      return {
        error: "api_error",
        message: "Erro na resposta da API. Tente novamente."
      };
    }

    try {
      const parseStartTime = Date.now();
      const cleanContent = cleanOpenAIResponse(content);
      console.log(`🧹 DEBUG - Conteúdo limpo (primeiros 200 chars): ${cleanContent.substring(0, 200)}${cleanContent.length > 200 ? '...' : ''}`);
      
      const parsedResponse = JSON.parse(cleanContent);
      const parseTime = Date.now() - parseStartTime;
      console.log(`⏱️ DEBUG - JSON parseado em: ${parseTime}ms`);
      console.log('📊 Resposta parseada (campos):', Object.keys(parsedResponse));
      
      // Validação dos campos obrigatórios
      const requiredFields = ['ad_title', 'ad_description', 'dimensions', 'weight', 'compatibility'];
      if (includePrices) {
        requiredFields.push('prices');
      }
      const missingFields = requiredFields.filter(field => !parsedResponse[field]);
      
      if (missingFields.length > 0) {
        console.log('❌ Campos obrigatórios ausentes:', missingFields);
        return {
          error: "invalid_response",
          message: `Resposta incompleta da API. Campos ausentes: ${missingFields.join(', ')}`
        };
      }

      // Validação específica de estruturas
      if (!parsedResponse.dimensions.width || !parsedResponse.dimensions.height || !parsedResponse.dimensions.depth) {
        console.log('❌ DEBUG - Dimensões incompletas:', parsedResponse.dimensions);
        return {
          error: "invalid_dimensions",
          message: "Dimensões incompletas na resposta da API."
        };
      }

      if (!Array.isArray(parsedResponse.compatibility) || parsedResponse.compatibility.length === 0) {
        console.log('❌ DEBUG - Compatibilidade inválida:', parsedResponse.compatibility);
        return {
          error: "invalid_compatibility",
          message: "Lista de compatibilidade inválida na resposta da API."
        };
      }

      // Validação específica para preços se incluídos
      if (includePrices) {
        if (!parsedResponse.prices || 
            typeof parsedResponse.prices.min_price !== 'number' ||
            typeof parsedResponse.prices.suggested_price !== 'number' ||
            typeof parsedResponse.prices.max_price !== 'number') {
          console.log('❌ DEBUG - Preços inválidos:', parsedResponse.prices);
          return {
            error: "invalid_prices",
            message: "Preços inválidos na resposta da API."
          };
        }

        // Validação lógica dos preços
        if (parsedResponse.prices.min_price >= parsedResponse.prices.suggested_price ||
            parsedResponse.prices.suggested_price >= parsedResponse.prices.max_price) {
          console.log('❌ DEBUG - Lógica de preços inválida:', parsedResponse.prices);
          return {
            error: "invalid_price_logic",
            message: "Lógica de preços inválida (min < sugerido < max)."
          };
        }
        
        console.log(`💰 DEBUG - Preços gerados: min R$${parsedResponse.prices.min_price}, sugerido R$${parsedResponse.prices.suggested_price}, max R$${parsedResponse.prices.max_price}`);
        
        // DEBUG: Validação adicional de preços realistas
        const minPrice = parsedResponse.prices.min_price;
        const suggestedPrice = parsedResponse.prices.suggested_price;
        const maxPrice = parsedResponse.prices.max_price;
        
        console.log(`🔍 DEBUG - Análise de preços para ${partName}:`);
        console.log(`   Peça: ${partName}`);
        console.log(`   Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}`);
        console.log(`   Preço mínimo: R$ ${minPrice}`);
        console.log(`   Preço sugerido: R$ ${suggestedPrice}`);
        console.log(`   Preço máximo: R$ ${maxPrice}`);
        console.log(`   Diferença min-sugerido: ${((suggestedPrice - minPrice) / minPrice * 100).toFixed(1)}%`);
        console.log(`   Diferença sugerido-max: ${((maxPrice - suggestedPrice) / suggestedPrice * 100).toFixed(1)}%`);
        
        // Alerta para preços suspeitos
        if (suggestedPrice < 30) {
          console.log(`⚠️ DEBUG - PREÇO SUSPEITO: Muito baixo (R$ ${suggestedPrice}) para ${partName}`);
        }
        if (suggestedPrice > 3000) {
          console.log(`⚠️ DEBUG - PREÇO SUSPEITO: Muito alto (R$ ${suggestedPrice}) para ${partName}`);
        }
        
        // Validação de range de preços por categoria
        const partNameLower = partName.toLowerCase();
        let expectedRange = { min: 50, max: 1000 }; // Default
        
        if (partNameLower.includes('alternador')) {
          expectedRange = { min: 150, max: 700 };
        } else if (partNameLower.includes('motor de partida') || partNameLower.includes('arranque')) {
          expectedRange = { min: 120, max: 500 };
        } else if (partNameLower.includes('farol') || partNameLower.includes('lanterna')) {
          expectedRange = { min: 70, max: 350 };
        } else if (partNameLower.includes('para-choque') || partNameLower.includes('parachoque')) {
          expectedRange = { min: 180, max: 900 };
        } else if (partNameLower.includes('radiador')) {
          expectedRange = { min: 120, max: 600 };
        } else if (partNameLower.includes('volante')) {
          expectedRange = { min: 80, max: 400 };
        } else if (partNameLower.includes('espelho')) {
          expectedRange = { min: 50, max: 250 };
        }
        
        if (suggestedPrice < expectedRange.min || suggestedPrice > expectedRange.max) {
          console.log(`⚠️ DEBUG - PREÇO FORA DO RANGE ESPERADO:`);
          console.log(`   Esperado para ${partName}: R$ ${expectedRange.min}-${expectedRange.max}`);
          console.log(`   Gerado: R$ ${suggestedPrice}`);
        } else {
          console.log(`✅ DEBUG - Preço dentro do range esperado: R$ ${expectedRange.min}-${expectedRange.max}`);
        }
      }

      const totalAITime = Date.now() - aiStartTime;
      console.log(`⏱️ DEBUG - Processamento IA total: ${totalAITime}ms (request: ${requestTime}ms, parse: ${parseTime}ms)`);
      console.log('✅ Processamento completo bem-sucedido');
      
      // DEBUG: Análise do resultado final
      console.log(`📝 DEBUG - Título gerado: "${parsedResponse.ad_title}" (${parsedResponse.ad_title?.length} chars)`);
      console.log(`📝 DEBUG - Descrição gerada: ${parsedResponse.ad_description?.length} chars`);
      console.log(`📏 DEBUG - Dimensões: ${parsedResponse.dimensions?.width}x${parsedResponse.dimensions?.height}x${parsedResponse.dimensions?.depth} ${parsedResponse.dimensions?.unit}`);
      console.log(`⚖️ DEBUG - Peso: ${parsedResponse.weight} kg`);
      console.log(`🔗 DEBUG - Compatibilidades: ${parsedResponse.compatibility?.length} veículos`);
      
      const baseResult = {
        ad_title: parsedResponse.ad_title,
        ad_description: parsedResponse.ad_description,
        dimensions: {
          width: String(parsedResponse.dimensions.width),
          height: String(parsedResponse.dimensions.height),
          depth: String(parsedResponse.dimensions.depth),
          unit: parsedResponse.dimensions.unit || 'cm'
        },
        weight: Number(parsedResponse.weight),
        compatibility: parsedResponse.compatibility.map((item: { brand: string; model: string; year: string }) => ({
          brand: String(item.brand),
          model: String(item.model),
          year: String(item.year)
        }))
      };

      // Adiciona preços se incluídos
      if (includePrices) {
        return {
          ...baseResult,
          prices: {
            min_price: Number(parsedResponse.prices.min_price),
            suggested_price: Number(parsedResponse.prices.suggested_price),
            max_price: Number(parsedResponse.prices.max_price)
          }
        };
      }

      return baseResult;

    } catch (parseError) {
      console.error('❌ DEBUG - Erro ao fazer parse da resposta OpenAI:', parseError);
      console.error('❌ DEBUG - Resposta bruta OpenAI:', content);
      console.error('❌ DEBUG - Tamanho da resposta:', content?.length);
      return {
        error: "parse_error",
        message: "Erro ao processar resposta da API. Tente novamente."
      };
    }

  } catch (error: unknown) {
    console.error('❌ DEBUG - Erro da API OpenAI:', error);
    
    // DEBUG: Análise detalhada do erro
    if (error && typeof error === 'object') {
      console.log('🔍 DEBUG - Tipo do erro:', error.constructor.name);
      if ('message' in error) {
        console.log('🔍 DEBUG - Mensagem do erro:', error.message);
      }
      if ('status' in error) {
        console.log('🔍 DEBUG - Status do erro:', error.status);
      }
      if ('code' in error) {
        console.log('🔍 DEBUG - Código do erro:', error.code);
      }
    }
    
    // Tratamento específico para timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      console.log('⏰ DEBUG - Timeout detectado no processamento IA');
      return {
        error: "openai_timeout",
        message: "Timeout no processamento IA. Tente novamente com menos imagens ou imagens menores."
      };
    }
    
    // Verifica se é erro de rate limit
    if (error && typeof error === 'object' && 'status' in error && error.status === 429) {
      const errorObj = error as { headers?: { 'retry-after'?: string } };
      const retryAfter = errorObj.headers?.['retry-after'];
      const retryMessage = retryAfter ? ` Tente novamente em ${Math.ceil(Number(retryAfter) / 60)} minutos.` : '';
      console.log('🚫 DEBUG - Rate limit atingido, retry-after:', retryAfter);
      return {
        error: "rate_limit",
        message: `Limite de uso da API excedido.${retryMessage} Tente novamente mais tarde.`
      };
    }
    
    return {
      error: "api_error",
      message: "Erro de conexão com a API. Tente novamente."
    };
  }
} 