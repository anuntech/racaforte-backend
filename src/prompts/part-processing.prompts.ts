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
    "depth": "profundidade (integer number)}",
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