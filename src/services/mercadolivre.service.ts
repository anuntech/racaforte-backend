import axios from 'axios';

interface MercadoLivreCredentials {
  clientId: string;
  secretKey: string;
  redirectUri: string;
  code?: string;
  accessToken?: string;
  refreshToken?: string;
}

interface MercadoLivreSearchResult {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  condition: string;
  thumbnail: string;
  seller: {
    id: number;
    reputation: {
      level_id: string;
    };
  };
}

interface MercadoLivreSearchResponse {
  site_id: string;
  results: MercadoLivreSearchResult[];
  paging: {
    total: number;
    primary_results: number;
    offset: number;
    limit: number;
  };
}

interface PriceAnalysis {
  min_price: number;
  max_price: number;
  suggested_price: number;
  average_price: number;
  total_results: number;
  condition_breakdown: {
    new: number;
    used: number;
  };
}

interface ServiceError {
  error: string;
  message: string;
}

// Configuração das credenciais
function getCredentials(): MercadoLivreCredentials {
  return {
    clientId: process.env.MERCADOLIVRE_CLIENT_ID || '',
    secretKey: process.env.MERCADOLIVRE_SECRET_KEY || '',
    redirectUri: process.env.MERCADOLIVRE_REDIRECT_URI || '',
    code: process.env.MERCADOLIVRE_CODE || '',
  };
}

/**
 * Obtém token de acesso usando o código de autorização
 */
export async function getAccessToken(): Promise<{ access_token: string; refresh_token: string } | ServiceError> {
  try {
    const credentials = getCredentials();
    
    if (!credentials.clientId || !credentials.secretKey || !credentials.code) {
      return {
        error: 'missing_credentials',
        message: 'Credenciais do Mercado Livre não configuradas corretamente'
      };
    }

    console.log('🔑 Obtendo token de acesso do Mercado Livre...');

    const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: credentials.clientId,
      client_secret: credentials.secretKey,
      code: credentials.code,
      redirect_uri: credentials.redirectUri,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    });

    console.log('✅ Token obtido com sucesso');
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
    };

  } catch (error) {
    console.error('❌ Erro ao obter token do Mercado Livre:', error);
    
    if (axios.isAxiosError(error)) {
      return {
        error: 'auth_error',
        message: `Erro de autenticação: ${error.response?.data?.message || error.message}`
      };
    }

    return {
      error: 'unknown_error',
      message: 'Erro desconhecido ao autenticar com Mercado Livre'
    };
  }
}

/**
 * Busca produtos no Mercado Livre baseado em uma query
 */
export async function searchProducts(
  query: string,
  categoryId?: string,
  limit: number = 50
): Promise<MercadoLivreSearchResponse | ServiceError> {
  try {
    console.log(`🔍 Buscando produtos no Mercado Livre: "${query}"`);

    const params = {
      q: query,
      limit: Math.min(limit, 50), // Máximo 50 por request
      ...(categoryId && { category: categoryId }),
    };

    // Configura headers com token se disponível
    const headers = {
      'Accept': 'application/json',
      ...(process.env.MERCADOLIVRE_ACCESS_TOKEN && {
        Authorization: `Bearer ${process.env.MERCADOLIVRE_ACCESS_TOKEN}`
      })
    };

    if (process.env.MERCADOLIVRE_ACCESS_TOKEN) {
      console.log('🔑 Usando token de acesso do MercadoLivre');
    }

    const response = await axios.get('https://api.mercadolibre.com/sites/MLB/search', {
      params,
      headers
    });

    console.log(`✅ Resposta MercadoLivre recebida:`, {
      status: response.status,
      totalResults: response.data.results.length,
      totalAvailable: response.data.paging.total,
      primaryResults: response.data.paging.primary_results,
      query: query
    });

    if (response.data.results.length > 0) {
      const priceRange = {
        min: Math.min(...response.data.results.map((item: MercadoLivreSearchResult) => item.price)),
        max: Math.max(...response.data.results.map((item: MercadoLivreSearchResult) => item.price))
      };
      console.log(`💰 Faixa de preços encontrada: R$ ${priceRange.min} - R$ ${priceRange.max}`);
    }

    return response.data;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const errorData = error.response?.data;
      
      console.error('❌ Erro na API do MercadoLivre:', {
        status,
        statusText,
        message: errorData?.message || error.message,
        query: query,
        url: error.config?.url
      });

      if (status === 401) {
        console.log('🔐 Token não autorizado - verifique se a autenticação foi configurada corretamente');
      } else if (status === 403) {
        console.log('🚫 Acesso negado - verifique as permissões da aplicação');
      } else if (status === 429) {
        console.log('⏰ Rate limit atingido - muitas requisições');
      } else if (status && status >= 500) {
        console.log('🛠️ Erro no servidor do MercadoLivre - tente novamente mais tarde');
      }
      
      return {
        error: 'search_error',
        message: `Erro na busca MercadoLivre (${status}): ${errorData?.message || error.message}`
      };
    }

    console.error('❌ Erro de conexão com MercadoLivre:', error);
    return {
      error: 'unknown_error',
      message: 'Erro desconhecido ao buscar produtos no MercadoLivre'
    };
  }
}

/**
 * Analisa preços de produtos encontrados e calcula estatísticas
 */
export function analyzePrices(searchResults: MercadoLivreSearchResult[]): PriceAnalysis {
  if (searchResults.length === 0) {
    return {
      min_price: 0,
      max_price: 0,
      suggested_price: 0,
      average_price: 0,
      total_results: 0,
      condition_breakdown: {
        new: 0,
        used: 0,
      }
    };
  }

  const prices = searchResults.map(item => item.price);
  const conditions = searchResults.map(item => item.condition);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;

  // Preço sugerido: mediana para ser mais representativo
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const medianPrice = sortedPrices.length % 2 === 0
    ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
    : sortedPrices[Math.floor(sortedPrices.length / 2)];

  const newCount = conditions.filter(condition => condition === 'new').length;
  const usedCount = conditions.filter(condition => condition === 'used').length;

  return {
    min_price: Math.round(minPrice * 100) / 100,
    max_price: Math.round(maxPrice * 100) / 100,
    suggested_price: Math.round(medianPrice * 100) / 100,
    average_price: Math.round(averagePrice * 100) / 100,
    total_results: searchResults.length,
    condition_breakdown: {
      new: newCount,
      used: usedCount,
    }
  };
}

/**
 * Busca preços para uma peça específica
 */
export async function getPartPrices(
  partName: string,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number
): Promise<PriceAnalysis | ServiceError> {
  try {
    console.log(`💰 Buscando preços para: ${partName} ${vehicleBrand} ${vehicleModel} ${vehicleYear}`);

    // Constrói diferentes queries para busca mais efetiva
    const searchQueries = [
      `${partName} ${vehicleBrand} ${vehicleModel} ${vehicleYear}`,
      `${partName} ${vehicleBrand} ${vehicleModel}`,
      `${partName} ${vehicleBrand}`,
      partName
    ];

    let bestResults: MercadoLivreSearchResult[] = [];
    
    // Tenta buscar com diferentes níveis de especificidade
    for (const query of searchQueries) {
      const searchResult = await searchProducts(query, 'MLB1744', 20); // Categoria Autopeças
      
      if ('error' in searchResult) {
        console.log(`📝 Busca "${query}" sem sucesso (normal) - tentando próxima variação`);
        continue;
      }

      if (searchResult.results.length > 0) {
        bestResults = searchResult.results;
        console.log(`✅ Encontrados ${bestResults.length} resultados com query: "${query}"`);
        break;
      }
    }

    if (bestResults.length === 0) {
      // Se não encontrou nada específico, tenta busca genérica pela peça
      console.log('📝 Nenhum resultado específico encontrado - tentando busca genérica...');
      const genericSearch = await searchProducts(partName);
      
      if ('error' in genericSearch) {
        return genericSearch;
      }

      bestResults = genericSearch.results.slice(0, 10); // Pega apenas os 10 primeiros
    }

    if (bestResults.length === 0) {
      return {
        error: 'no_results',
        message: 'Nenhum produto encontrado no Mercado Livre para análise de preços'
      };
    }

    const priceAnalysis = analyzePrices(bestResults);
    
    console.log('📊 Análise de preços concluída:', {
      totalResults: priceAnalysis.total_results,
      minPrice: priceAnalysis.min_price,
      maxPrice: priceAnalysis.max_price,
      suggestedPrice: priceAnalysis.suggested_price
    });

    return priceAnalysis;

  } catch (error) {
    console.error('❌ Erro ao buscar preços da peça:', error);
    return {
      error: 'price_search_error',
      message: 'Erro ao buscar preços no Mercado Livre'
    };
  }
}

/**
 * Obtém sugestões de preços baseadas no mercado - APENAS API REAL DO MERCADOLIVRE
 * Se não conseguir acessar o MercadoLivre, retorna erro
 */
export async function getPriceSuggestions(
  partName: string,
  vehicleBrand: string,
  vehicleModel: string,
  vehicleYear: number,
  condition: 'new' | 'used' = 'used'
): Promise<{ min_price: number; suggested_price: number; max_price: number } | ServiceError> {
  try {
    console.log(`💰 Obtendo preços do MercadoLivre para: ${partName} ${vehicleBrand} ${vehicleModel} ${vehicleYear}`);
    
    // Busca preços reais no Mercado Livre - OBRIGATÓRIO
    const priceAnalysis = await getPartPrices(partName, vehicleBrand, vehicleModel, vehicleYear);
    
    if ('error' in priceAnalysis) {
      // Se não conseguir acessar o Mercado Livre, retorna erro
      console.error('❌ Falha ao acessar API do MercadoLivre - sistema configurado para usar apenas API real');
      return {
        error: 'mercadolivre_required',
        message: 'Não foi possível acessar a API do MercadoLivre. Verifique as credenciais e autenticação.'
      };
    }

    // Ajusta preços baseado na condição
    let adjustment = 1.0;
    if (condition === 'used') {
      adjustment = 0.7; // Peças usadas valem cerca de 70% do preço de novas
    }

    const adjustedMin = Math.round(priceAnalysis.min_price * adjustment * 100) / 100;
    const adjustedSuggested = Math.round(priceAnalysis.suggested_price * adjustment * 100) / 100;
    const adjustedMax = Math.round(priceAnalysis.max_price * adjustment * 100) / 100;

    console.log('✅ Preços obtidos com sucesso da API do MercadoLivre:', {
      min: adjustedMin,
      suggested: adjustedSuggested,
      max: adjustedMax
    });

    return {
      min_price: adjustedMin,
      suggested_price: adjustedSuggested,
      max_price: adjustedMax,
    };

  } catch (error) {
    console.error('❌ Erro ao obter preços do MercadoLivre:', error);
    
    return {
      error: 'mercadolivre_error',
      message: 'Erro ao acessar API do MercadoLivre. Sistema configurado para usar apenas preços reais.'
    };
  }
}

/**
 * Inicializa automaticamente a autenticação com MercadoLivre
 * Deve ser chamada na inicialização do servidor
 */
export async function initializeMercadoLivre(): Promise<void> {
  try {
    console.log('🔧 Inicializando autenticação MercadoLivre...');
    
    const credentials = getCredentials();
    
    // Verifica se as credenciais básicas estão configuradas
    if (!credentials.clientId || !credentials.secretKey) {
      console.log('⚠️ Credenciais MercadoLivre não configuradas - sistema usará apenas funcionalidades básicas');
      return;
    }
    
    console.log('✅ Credenciais MercadoLivre encontradas');
    
    // Se já tem um token salvo, verifica se ainda é válido
    if (process.env.MERCADOLIVRE_ACCESS_TOKEN) {
      console.log('🔑 Token existente encontrado - testando validade...');
      
      // Testa fazendo uma busca simples
      const testResult = await searchProducts('teste', undefined, 1);
      
      if (!('error' in testResult)) {
        console.log('✅ Token existente é válido - MercadoLivre configurado e pronto!');
        return;
      } else {
        console.log('🔄 Token existente expirado - obtendo novo token...');
      }
    }
    
    // Se tem o código de autorização, obtém um novo token
    if (credentials.code) {
      console.log('🔑 Código de autorização encontrado - obtendo token de acesso...');
      
      const tokenResult = await getAccessToken();
      
      if ('error' in tokenResult) {
        console.error('❌ Falha ao obter token:', tokenResult.message);
        console.log('📝 Sistema continuará funcionando, mas sem preços do MercadoLivre');
        return;
      }
      
      // Salva os tokens nas variáveis de ambiente (em produção, salve em banco)
      process.env.MERCADOLIVRE_ACCESS_TOKEN = tokenResult.access_token;
      process.env.MERCADOLIVRE_REFRESH_TOKEN = tokenResult.refresh_token;
      
      console.log('🎉 Autenticação MercadoLivre concluída com sucesso!');
      console.log('✅ API do MercadoLivre configurada e pronta para uso');
      
    }
    
    console.log('⚠️ Código de autorização não encontrado');
    console.log('📖 Para configurar, acesse: /auth/mercadolivre');
    
  } catch (error) {
    console.error('❌ Erro na inicialização do MercadoLivre:', error);
    console.log('📝 Sistema continuará funcionando, mas sem preços do MercadoLivre');
  }
}

// Função de fallback removida - sistema agora usa apenas API real do MercadoLivre 