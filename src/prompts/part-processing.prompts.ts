// Prompt para analisar preços do Mercado Livre com dados reais de webscraping
export function buildPricesPrompt(
  partName: string,
  partDescription: string | undefined,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number,
  webscrapingData?: { results: Array<{ name: string; price: number; url: string; [key: string]: any }> }
): string {
  const description = partDescription ? ` ${partDescription}` : '';
  
  if (webscrapingData && webscrapingData.results.length > 0) {
    // Novo prompt com dados reais de webscraping
    return `Você é um especialista em análise de preços de autopeças do Mercado Livre. Analise os dados de webscraping fornecidos e identifique quais anúncios são realmente da peça solicitada, retornando *somente* um JSON válido conforme o esquema fornecido.

## Peça solicitada
- Nome: ${partName}
- Descrição: ${description}
- Veículo: ${vehicleBrand} ${vehicleModel} ${vehicleYear}

## Dados de webscraping do Mercado Livre
${JSON.stringify(webscrapingData.results, null, 2)}

## Sua tarefa
1. **Filtre os anúncios relevantes**: Analise cada anúncio e identifique quais são realmente da peça "${partName}" para ${vehicleBrand} ${vehicleModel} ${vehicleYear}
2. **Critérios de filtragem**:
   - O nome/título deve conter a peça solicitada ou termos similares
   - Deve ser compatível com a marca/modelo/ano do veículo (ou ser genérico/universal)
   - Ignore peças de outros veículos incompatíveis
   - Ignore kits, lotes ou produtos que não sejam a peça específica
   - Prefira anúncios com condição "usado"
3. **Calcule preços**:
   - min_price: menor preço dos anúncios filtrados
   - max_price: maior preço dos anúncios filtrados  
   - suggested_price: mediana dos preços (se 3+ anúncios), média (se 2 anúncios), ou o próprio preço (se 1 anúncio)
4. **Retorne ads filtrados**: Apenas os anúncios que realmente são da peça solicitada, incluindo:
   - title: nome/título do anúncio
   - price: preço numérico 
   - url: URL completa do anúncio

## Formato de saída obrigatório
Retorne *APENAS* o JSON válido com TODOS os campos obrigatórios:

{
  "prices": {
    "min_price": <number>,
    "suggested_price": <number>,
    "max_price": <number>
  },
  "ads": [
    {
      "title": "<string: nome completo do anúncio>",
      "price": <number: preço numérico>,
      "url": "<string: URL completa do anúncio>"
    }
  ]
}

IMPORTANTE: Cada objeto em "ads" DEVE conter exatamente os 3 campos: title, price, url

Se nenhum anúncio relevante for encontrado:
{
  "prices": {
    "min_price": 0,
    "suggested_price": 0,
    "max_price": 0
  },
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