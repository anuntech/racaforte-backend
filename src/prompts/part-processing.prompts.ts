// Tipos para os anúncios filtrados
interface FilteredAd {
  title: string;
  price: number;
  url: string;
}

interface FilteredAdsResponse {
  ads: FilteredAd[];
}

interface PricesCalculated {
  min_price: number;
  suggested_price: number;
  max_price: number;
}

interface PricesWithAds {
  prices: PricesCalculated;
  ads: FilteredAd[];
}

// Função que calcula preços automaticamente baseado nos anúncios filtrados pela IA
export function calculatePricesFromAds(filteredAdsResponse: FilteredAdsResponse): PricesWithAds {
  const ads = filteredAdsResponse.ads || [];
  
  // Se não há anúncios, lança erro específico
  if (ads.length === 0) {
    const noAdsError = new Error('Anúncios correspondentes a peça não encontrados');
    (noAdsError as any).code = 'NO_ADS_FOUND';
    throw noAdsError;
  }
  
  // Extrai apenas os preços válidos (números positivos)
  const validPrices = ads
    .map(ad => ad.price)
    .filter(price => typeof price === 'number' && price > 0)
    .sort((a, b) => a - b); // Ordena do menor para o maior
  
  // Se não há preços válidos, lança erro específico
  if (validPrices.length === 0) {
    const invalidPricesError = new Error('Nenhum preço válido foi encontrado nos anúncios filtrados');
    (invalidPricesError as any).code = 'INVALID_PRICES';
    throw invalidPricesError;
  }
  
  // Calcula preços baseado nos anúncios encontrados
  const minPrice = validPrices[0]; // Menor preço
  const maxPrice = validPrices[validPrices.length - 1]; // Maior preço
  
  let suggestedPrice: number;
  
  if (validPrices.length === 1) {
    // Se há apenas 1 anúncio, o preço sugerido é o próprio preço
    suggestedPrice = validPrices[0];
  } else if (validPrices.length === 2) {
    // Se há 2 anúncios, o preço sugerido é a média
    suggestedPrice = Math.round((validPrices[0] + validPrices[1]) / 2);
  } else {
    // Se há 3 ou mais anúncios, o preço sugerido é a mediana
    const middleIndex = Math.floor(validPrices.length / 2);
    if (validPrices.length % 2 === 0) {
      // Se número par de elementos, média dos dois do meio
      suggestedPrice = Math.round((validPrices[middleIndex - 1] + validPrices[middleIndex]) / 2);
    } else {
      // Se número ímpar de elementos, elemento do meio
      suggestedPrice = validPrices[middleIndex];
    }
  }
  
  return {
    prices: {
      min_price: minPrice,
      suggested_price: suggestedPrice,
      max_price: maxPrice
    },
    ads: ads
  };
}

// Prompt para analisar preços do Mercado Livre com dados reais de webscraping
export function buildPricesPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string | null,
  vehicleModel: string | null,
  vehicleYear: number | null,
  webscrapingData?: { results: Array<{ name: string; price: number; url: string; thumbnail?: string | null; brand?: string | null; rating?: number | null; total_ratings?: number | null; listing_price?: number | null; currency_symbol?: string | null; currency?: string | null }> }
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  const vehicleInfo = vehicleBrand && vehicleModel && vehicleYear 
    ? `${vehicleBrand} ${vehicleModel} ${vehicleYear}`
    : null; // null quando não há dados do veículo
  
  if (webscrapingData && webscrapingData.results.length > 0) {
    // Novo prompt com dados reais de webscraping
    const vehicleSection = vehicleInfo 
      ? `- Veículo: ${vehicleInfo}` 
      : '- Busca: Genérica (qualquer veículo compatível)';
    
    return `Preciso que você filtre os anúncios abaixo que sejam realmente da peça:

- Nome: ${partName}
- Descrição: ${description}
${vehicleSection}

## Dados dos anúncios
${JSON.stringify(webscrapingData.results, null, 2)}

## Instruções de filtragem
- Se encontrar anúncios da peça solicitada, inclua-os na lista
- Se NÃO encontrar anúncios compatíveis, retorne um array vazio
- Seja flexível: aceite variações de nome da peça
- Ignore incompatibilidades de veículo se a peça for a mesma

## Formato de saída obrigatório
Retorne *APENAS* o JSON válido com TODOS os campos exatamente como o exemplo abaixo:

{
  "ads": [
    {
      "title": "<string: nome completo do anúncio>",
      "price": <number: preço numérico>,
      "url": "<string: URL completa do anúncio>"
    }
  ]
}

**IMPORTANTE: Mesmo se não encontrar anúncios compatíveis, retorne:**
{
  "ads": []
}

Retorne APENAS o JSON válido, sem comentários ou texto adicional.`;
  }
  
  // Se não há dados de webscraping, retornar erro
  throw new Error('Dados de webscraping são obrigatórios para análise de preços');
}

// Prompt para gerar descrição do anúncio
export function buildAdDescriptionPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  return `Crie uma descrição atrativa para anúncio da peça ${partName}${description} do veículo ${vehicleBrand} ${vehicleModel} ${vehicleYear}. Evite usar aspas não balanceadas e caracteres que quebrem JSON.

Retorne JSON:
{
  "ad_description": "descrição da peça para anúncio"
}

Retorne APENAS o JSON válido.`;
}

// Prompt para estimar dimensões
export function buildDimensionsPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  return `Estime as dimensões aproximadas da peça ${partName}${description} do veículo ${vehicleBrand} ${vehicleModel} ${vehicleYear}.

Retorne JSON:
{
  "dimensions": {
    "width": "largura (integer number)",
    "height": "altura (integer number)",
    "depth": "profundidade (integer number)",
    "unit": "cm"
  }
}

Retorne APENAS o JSON válido.`;
}

// Prompt para estimar peso
export function buildWeightPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  return `Estime o peso aproximado da peça ${partName}${description} do veículo ${vehicleBrand} ${vehicleModel} ${vehicleYear}.

Retorne JSON:
{
  "weight": peso_numero_em_kg
}

Retorne APENAS o JSON válido.`;
}

// Prompt para determinar compatibilidade
export function buildCompatibilityPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  return `Liste veículos compatíveis com a peça ${partName}${description} do veículo ${vehicleBrand} ${vehicleModel} ${vehicleYear}. Se não houver outros veículos compatíveis, retorne apenas o veículo de onde a peça veio.

Retorne JSON:
{
  "compatibility": [
    {
      "brand": "marca",
      "model": "modelo",
      "year": "anos"
    }
  ]
}

Retorne APENAS o JSON válido.`;
}

// Função original mantida para compatibilidade
export function buildPartProcessingPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  return `Realize uma busca no mercado livre para encontrar o melhor preço para a peça (usada) ${partName}${description} do veículo ${vehicleBrand} ${vehicleModel} ${vehicleYear}.

Retorne JSON:
{
  "prices": {
    "min_price": preco_min_numero,
    "suggested_price": preco_sugerido_numero,
    "max_price": preco_max_numero
  },
  "ad_description": "descrição da peça para anúncio",
  "dimensions": {
    "width": "largura (integer number)",
    "height": "altura (integer number)", 
    "depth": "profundidade (integer number)",
    "unit": "cm"
  },
  "weight": peso_numero,
  "compatibility": [
    {
      "brand": "marca",
      "model": "modelo", 
      "year": "anos"
    }
  ]
}

Retorne APENAS o JSON válido.`;
} 