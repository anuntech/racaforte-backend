// Prompt para buscar preços no Mercado Livre
export function buildPricesPrompt(
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
  }
}

Retorne APENAS o JSON válido.`;
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