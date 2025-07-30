export function buildPartProcessingPrompt(
  partName: string,
  partDescription: string,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  return `Realize uma busca no mercado livre para encontrar o melhor preço para a peça ${partName} ${partDescription} do veículo ${vehicleBrand} ${vehicleModel} ${vehicleYear}.

Retorne JSON:
{
  "prices": {
    "min_price": preco_min_numero,
    "suggested_price": preco_sugerido_numero,
    "max_price": preco_max_numero
  },
  "ad_description": "descrição da peça para anúncio",
  "dimensions": {
    "width": "largura cm",
    "height": "altura cm", 
    "depth": "profundidade cm",
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