import axios from 'axios';

// Types for Unwrangle API response
export interface UnwrangleResult {
  name: string;
  url: string;
  thumbnail: string;
  brand: string | null;
  rating: number | null;
  total_ratings: number | null;
  price: number;
  listing_price: number | null;
  currency_symbol: string;
  currency: string;
}

export interface UnwrangleResponse {
  success: boolean;
  platform: string;
  search: string;
  page: number;
  total_results: number;
  no_of_pages: number;
  result_count: number;
  results: UnwrangleResult[];
  meta_data: Record<string, unknown>;
  credits_used: number;
  remaining_credits: number;
}

export interface UnwrangleError {
  success: false;
  error: string;
  message: string;
}

/**
 * Service for interacting with Unwrangle API to scrape Mercado Livre search results
 */
class UnwrangleService {
  private readonly baseUrl = 'https://data.unwrangle.com/api/getter/';
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.UNWRANGLE_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ UNWRANGLE_API_KEY not found in environment variables');
    }
  }

  /**
   * Search for parts on Mercado Livre using Unwrangle API
   * @param searchTerm - The search term (e.g., "Alternador Corolla")
   * @param page - Page number (default: 1)
   * @returns Promise with search results or error
   */
  async searchMercadoLivre(
    searchTerm: string, 
    page = 1
  ): Promise<UnwrangleResponse | UnwrangleError> {
    const requestId = Math.random().toString(36).substring(2, 8);
    
    console.log(`🔍 [${requestId}] Unwrangle API - Searching for: "${searchTerm}" (page ${page})`);
    
    if (!this.apiKey) {
      console.error(`❌ [${requestId}] UNWRANGLE_API_KEY not configured`);
      return {
        success: false,
        error: 'configuration_error',
        message: 'API key not configured for Unwrangle service'
      };
    }

    try {
      const startTime = Date.now();
      
      const params = new URLSearchParams({
        platform: 'mercado_search',
        search: searchTerm,
        page: page.toString(),
        api_key: this.apiKey
      });

      const url = `${this.baseUrl}?${params.toString()}`;
      console.log(`📤 [${requestId}] Making request to Unwrangle API...`);
      
      const response = await axios.get<UnwrangleResponse>(url, {
        timeout: 0, // Sem timeout - espera indefinidamente
        headers: {
          'User-Agent': 'RacaForte-Backend/1.0'
        }
      });

      const responseTime = Date.now() - startTime;
      console.log(`✅ [${requestId}] Unwrangle API response received in ${responseTime}ms`);
      
      if (!response.data.success) {
        console.error(`❌ [${requestId}] Unwrangle API returned error:`, response.data);
        return {
          success: false,
          error: 'api_error',
          message: 'Unwrangle API returned an error response'
        };
      }

      console.log(`📊 [${requestId}] Search results:`, {
        total_results: response.data.total_results,
        result_count: response.data.result_count,
        credits_used: response.data.credits_used,
        remaining_credits: response.data.remaining_credits
      });

      return response.data;

    } catch (error) {
      console.error(`❌ [${requestId}] Error calling Unwrangle API:`, error);
      
      if (axios.isAxiosError(error)) {
        // Removido tratamento de timeout já que configuramos timeout: 0
        
        if (error.response?.status === 401) {
          return {
            success: false,
            error: 'authentication_error',
            message: 'Invalid API key for Unwrangle service'
          };
        }
        
        if (error.response?.status === 403) {
          return {
            success: false,
            error: 'quota_exceeded',
            message: 'Your credits quota has been consumed, please buy more credits to continue.'
          };
        }
        
        if (error.response?.status === 429) {
          return {
            success: false,
            error: 'rate_limit_error',
            message: 'Rate limit exceeded for Unwrangle API'
          };
        }
      }

      return {
        success: false,
        error: 'network_error',
        message: 'Failed to connect to Unwrangle API'
      };
    }
  }

  /**
   * Format search term for better results
   * Combines part name with vehicle information including year
   */
  formatSearchTerm(partName: string, vehicleBrand?: string, vehicleModel?: string, vehicleYear?: number): string {
    let searchTerm = partName.trim();
    
    if (vehicleBrand && vehicleModel && vehicleYear) {
      searchTerm = `${partName} ${vehicleBrand} ${vehicleModel} ${vehicleYear}`;
    } else if (vehicleBrand && vehicleModel) {
      searchTerm = `${partName} ${vehicleBrand} ${vehicleModel}`;
    } else if (vehicleBrand) {
      searchTerm = `${partName} ${vehicleBrand}`;
    }
    
    return searchTerm;
  }

  /**
   * Test the API connection and configuration
   */
  async testConnection(): Promise<{ success: boolean; message: string; credits?: number }> {
    console.log('🧪 Testing Unwrangle API connection...');
    
    const result = await this.searchMercadoLivre('teste', 1);
    
    if ('error' in result) {
      return {
        success: false,
        message: `Connection test failed: ${result.message}`
      };
    }
    
    return {
      success: true,
      message: 'Connection successful',
      credits: result.remaining_credits
    };
  }
}

// Export singleton instance
export const unwrangleService = new UnwrangleService();
