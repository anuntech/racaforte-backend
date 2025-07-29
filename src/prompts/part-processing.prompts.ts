export function buildPartProcessingPrompt(
  partName: string,
  partDescription: string,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): string {
  return `Você é especialista em autopeças. Gere dados para:

PEÇA: ${partName} - ${partDescription}
VEÍCULO: ${vehicleBrand} ${vehicleModel} ${vehicleYear}

Retorne JSON:
{
  "ad_title": "título para anúncio (máx 60 chars)",
  "ad_description": "descrição detalhada da peça",
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
  ],
  "prices": {
    "min_price": preco_min_numero,
    "suggested_price": preco_sugerido_numero,
    "max_price": preco_max_numero
  }
}

INSTRUÇÕES:
1. Estime dimensões e peso da peça
2. Liste veículos compatíveis (máximo 5)
3. Título otimizado para marketplace
4. Peça usada em boa condição
5. Busque preços deste item no mercado livre (apenas no mercado livre)

Retorne APENAS o JSON válido.`;
} 