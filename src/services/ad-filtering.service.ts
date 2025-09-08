import type { UnwrangleResult } from './unwrangle.service';

// Interfaces para o sistema de filtragem
export interface FilteredAd {
  title: string;
  price: number;
  url: string;
  confidence: number; // Score de 0-1 indicando confiança na filtragem
  matchReasons: string[]; // Razões pelas quais foi considerado uma correspondência
}

export interface FilteringResult {
  ads: FilteredAd[];
  totalProcessed: number;
  totalFiltered: number;
  filteringStats: {
    byNameMatch: number;
    byKeywordMatch: number;
    byPriceRange: number;
    rejected: number;
  };
}

export interface FilteringOptions {
  partName: string;
  partDescription?: string;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: number | null;
  maxPriceVariation?: number; // Percentual máximo de variação de preço aceitável
  minConfidence?: number; // Score mínimo de confiança (0-1)
  includeGenericParts?: boolean; // Se deve incluir peças genéricas/universais
}

/**
 * Serviço de filtragem de anúncios personalizado para substituir a IA inconsistente
 */
class AdFilteringService {
  
  // Palavras-chave que indicam peças não relevantes
  private readonly irrelevantKeywords = [
    'kit', 'jogo', 'conjunto', 'adesivo', 'decal', 'manual', 'livro', 
    'curso', 'video', 'dvd', 'cd', 'software', 'aplicativo', 'app',
    'miniatura', 'chaveiro', 'camiseta', 'bone', 'caneca', 'poster',
    'quebra-cabeça', 'puzzle', 'brinquedo', 'action figure', 'boneco'
  ];

  // Palavras que indicam que a peça pode ser genérica/universal
  private readonly universalKeywords = [
    'universal', 'generico', 'genérico', 'compatível', 'adaptável',
    'multimarca', 'multi marca', 'qualquer', 'diversos'
  ];

  // Palavras que indicam estado da peça
  private readonly conditionKeywords = {
    new: ['novo', 'nova', 'zero', '0km', 'lacrado', 'original', 'genuíno', 'genuína'],
    used: ['usado', 'usada', 'seminovo', 'seminova', 'conservado', 'conservada'],
    damaged: ['batido', 'batida', 'danificado', 'danificada', 'quebrado', 'quebrada', 'defeito']
  };

  /**
   * Filtra anúncios baseado nos critérios fornecidos
   */
  public filterAds(
    unwrangleResults: UnwrangleResult[], 
    options: FilteringOptions
  ): FilteringResult {
    const stats = {
      byNameMatch: 0,
      byKeywordMatch: 0,
      byPriceRange: 0,
      rejected: 0
    };

    const filteredAds: FilteredAd[] = [];

    for (const result of unwrangleResults) {
      const filterResult = this.evaluateAd(result, options);
      
      if (filterResult.isRelevant) {
        filteredAds.push({
          title: result.name,
          price: result.price,
          url: result.url,
          confidence: filterResult.confidence,
          matchReasons: filterResult.reasons
        });

        // Atualizar estatísticas
        if (filterResult.reasons.includes('name_match')) stats.byNameMatch++;
        if (filterResult.reasons.includes('keyword_match')) stats.byKeywordMatch++;
        if (filterResult.reasons.includes('price_range')) stats.byPriceRange++;
      } else {
        stats.rejected++;
      }
    }

    // Ordenar por confiança (maior primeiro)
    filteredAds.sort((a, b) => b.confidence - a.confidence);

    // Aplicar filtro de confiança mínima se especificado
    const finalAds = options.minConfidence 
      ? filteredAds.filter(ad => ad.confidence >= options.minConfidence!)
      : filteredAds;

    return {
      ads: finalAds,
      totalProcessed: unwrangleResults.length,
      totalFiltered: finalAds.length,
      filteringStats: stats
    };
  }

  /**
   * Avalia um anúncio individual e determina se é relevante
   */
  private evaluateAd(
    ad: UnwrangleResult, 
    options: FilteringOptions
  ): { isRelevant: boolean; confidence: number; reasons: string[] } {
    const adTitle = ad.name.toLowerCase();
    const partName = options.partName.toLowerCase();
    const reasons: string[] = [];
    let confidence = 0;

    // Verificar se contém palavras irrelevantes
    if (this.containsIrrelevantKeywords(adTitle)) {
      return { isRelevant: false, confidence: 0, reasons: ['irrelevant_keywords'] };
    }

    // Verificar preço válido
    if (!ad.price || ad.price <= 0) {
      return { isRelevant: false, confidence: 0, reasons: ['invalid_price'] };
    }

    // 1. Verificação por correspondência exata ou parcial do nome
    const nameMatch = this.evaluateNameMatch(adTitle, partName);
    if (nameMatch.score > 0) {
      confidence += nameMatch.score * 0.4; // 40% da confiança baseada no nome
      reasons.push('name_match');
    }

    // 2. Verificação por palavras-chave da peça
    const keywordMatch = this.evaluateKeywordMatch(adTitle, partName, options.partDescription);
    if (keywordMatch.score > 0) {
      confidence += keywordMatch.score * 0.3; // 30% da confiança baseada em palavras-chave
      reasons.push('keyword_match');
    }

    // 3. Verificação de compatibilidade com veículo (se fornecido)
    if (options.vehicleBrand && options.vehicleModel) {
      const vehicleMatch = this.evaluateVehicleCompatibility(
        adTitle, 
        options.vehicleBrand, 
        options.vehicleModel, 
        options.vehicleYear
      );
      if (vehicleMatch.score > 0) {
        confidence += vehicleMatch.score * 0.2; // 20% da confiança baseada no veículo
        reasons.push('vehicle_match');
      }
    }

    // 4. Verificação de peças universais/genéricas (se permitido)
    if (options.includeGenericParts !== false) {
      const universalMatch = this.evaluateUniversalPart(adTitle);
      if (universalMatch.score > 0) {
        confidence += universalMatch.score * 0.1; // 10% da confiança para peças universais
        reasons.push('universal_part');
      }
    }

    // 5. Penalização por estado da peça (danificada)
    if (this.isDamagedPart(adTitle)) {
      confidence *= 0.7; // Reduz confiança em 30%
      reasons.push('damaged_condition');
    }

    // Verificar se atende ao critério mínimo de relevância
    const isRelevant = confidence >= 0.3 && reasons.length > 0;

    return { isRelevant, confidence: Math.min(confidence, 1.0), reasons };
  }

  /**
   * Avalia correspondência do nome da peça
   */
  private evaluateNameMatch(adTitle: string, partName: string): { score: number } {
    // Correspondência exata
    if (adTitle.includes(partName)) {
      return { score: 1.0 };
    }

    // Correspondência por palavras individuais
    const partWords = partName.split(' ').filter(word => word.length > 2);
    const matchedWords = partWords.filter(word => adTitle.includes(word));
    
    if (matchedWords.length > 0) {
      const matchRatio = matchedWords.length / partWords.length;
      return { score: matchRatio * 0.8 }; // Máximo 80% para correspondência parcial
    }

    // Correspondência difusa (similar)
    const similarity = this.calculateStringSimilarity(adTitle, partName);
    if (similarity > 0.6) {
      return { score: similarity * 0.6 }; // Máximo 60% para similaridade
    }

    return { score: 0 };
  }

  /**
   * Avalia correspondência por palavras-chave relacionadas
   */
  private evaluateKeywordMatch(
    adTitle: string, 
    partName: string, 
    partDescription?: string
  ): { score: number } {
    const keywords = new Set<string>();
    
    // Extrair palavras-chave do nome da peça
    for (const word of partName.split(' ')) {
      if (word.length > 2) keywords.add(word.toLowerCase());
    }

    // Extrair palavras-chave da descrição (se fornecida)
    if (partDescription) {
      for (const word of partDescription.split(' ')) {
        if (word.length > 2) keywords.add(word.toLowerCase());
      }
    }

    // Contar correspondências
    let matches = 0;
    for (const keyword of keywords) {
      if (adTitle.includes(keyword)) matches++;
    }

    return { score: keywords.size > 0 ? matches / keywords.size : 0 };
  }

  /**
   * Avalia compatibilidade com veículo
   */
  private evaluateVehicleCompatibility(
    adTitle: string, 
    brand: string, 
    model: string, 
    year?: number | null
  ): { score: number } {
    let score = 0;
    
    // Verificar marca
    if (adTitle.includes(brand.toLowerCase())) {
      score += 0.4;
    }

    // Verificar modelo
    if (adTitle.includes(model.toLowerCase())) {
      score += 0.4;
    }

    // Verificar ano (se fornecido)
    if (year && adTitle.includes(year.toString())) {
      score += 0.2;
    }

    return { score };
  }

  /**
   * Avalia se é uma peça universal/genérica
   */
  private evaluateUniversalPart(adTitle: string): { score: number } {
    const matchedUniversal = this.universalKeywords.some(keyword => 
      adTitle.includes(keyword)
    );

    return { score: matchedUniversal ? 0.5 : 0 };
  }

  /**
   * Verifica se contém palavras irrelevantes
   */
  private containsIrrelevantKeywords(adTitle: string): boolean {
    return this.irrelevantKeywords.some(keyword => adTitle.includes(keyword));
  }

  /**
   * Verifica se a peça está danificada
   */
  private isDamagedPart(adTitle: string): boolean {
    return this.conditionKeywords.damaged.some(keyword => adTitle.includes(keyword));
  }

  /**
   * Calcula similaridade entre duas strings (algoritmo simples)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calcula distância de Levenshtein entre duas strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Filtra anúncios por faixa de preço baseada na mediana
   */
  public filterByPriceRange(
    ads: FilteredAd[], 
    maxVariationPercent: number = 200
  ): FilteredAd[] {
    if (ads.length === 0) return ads;

    // Calcular mediana dos preços
    const prices = ads.map(ad => ad.price).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];

    // Calcular faixa de preços aceitável
    const minPrice = median * (1 - maxVariationPercent / 100);
    const maxPrice = median * (1 + maxVariationPercent / 100);

    return ads.filter(ad => ad.price >= minPrice && ad.price <= maxPrice);
  }

  /**
   * Aplica filtros de qualidade adicionais
   */
  public applyQualityFilters(ads: FilteredAd[]): FilteredAd[] {
    return ads.filter(ad => {
      // Filtrar anúncios com títulos muito curtos (provavelmente incompletos)
      if (ad.title.length < 10) return false;
      
      // Filtrar anúncios com preços suspeitosamente baixos
      if (ad.price < 10) return false;
      
      // Filtrar anúncios sem URL válida
      if (!ad.url || !ad.url.startsWith('http')) return false;
      
      return true;
    });
  }
}

// Instância singleton do serviço
export const adFilteringService = new AdFilteringService();

// Função utilitária para filtrar anúncios (interface simplificada)
export function filterUnwrangleAds(
  unwrangleResults: UnwrangleResult[],
  partName: string,
  partDescription?: string,
  vehicleBrand?: string | null,
  vehicleModel?: string | null,
  vehicleYear?: number | null,
  options?: {
    maxPriceVariation?: number;
    minConfidence?: number;
    includeGenericParts?: boolean;
  }
): FilteringResult {
  const filteringOptions: FilteringOptions = {
    partName,
    partDescription,
    vehicleBrand,
    vehicleModel,
    vehicleYear,
    maxPriceVariation: options?.maxPriceVariation ?? 200,
    minConfidence: options?.minConfidence ?? 0.3,
    includeGenericParts: options?.includeGenericParts !== false
  };

  const result = adFilteringService.filterAds(unwrangleResults, filteringOptions);
  
  // Aplicar filtros de qualidade
  result.ads = adFilteringService.applyQualityFilters(result.ads);
  
  // Aplicar filtro de faixa de preço se houver múltiplos anúncios
  if (result.ads.length > 3 && options?.maxPriceVariation) {
    result.ads = adFilteringService.filterByPriceRange(result.ads, options.maxPriceVariation);
  }

  return result;
}
