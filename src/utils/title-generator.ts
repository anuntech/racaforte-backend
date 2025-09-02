interface CompatibilityItem {
  brand: string;
  model: string;
  year: string;
}

/**
 * Gera título padronizado para anúncio seguindo o padrão do site:
 * "nome da peça nome do carro anos compatíveis"
 */
export function generateStandardAdTitle(
  partName: string,
  vehicleBrand: string,
  vehicleModel: string,
  compatibility: CompatibilityItem[]
): string {
  
  // 1. Nome da peça (limpo e capitalizado)
  const cleanPartName = partName.trim();
  
  // 2. Nome do carro (marca + modelo)
  const carName = `${vehicleBrand} ${vehicleModel}`;
  
  // 3. Anos compatíveis (pega dos veículos compatíveis e limpa)
  let years = '';
  if (compatibility && compatibility.length > 0) {
    // Pega os anos do primeiro veículo compatível (geralmente é o principal)
    const primaryVehicle = compatibility.find(c => 
      c && c.brand && c.model && 
      c.brand.toLowerCase() === vehicleBrand.toLowerCase() && 
      c.model.toLowerCase() === vehicleModel.toLowerCase()
    ) || compatibility[0];
    
    // Verifica se encontrou um veículo válido e tem o campo year
    if (primaryVehicle && primaryVehicle.year) {
      // Limpa os anos - remove qualquer texto entre parênteses e extra
      const cleanYears = primaryVehicle.year
        .replace(/\([^)]*\)/g, '') // Remove tudo entre parênteses
        .replace(/\s+/g, ' ')      // Remove espaços extras
        .trim();                   // Remove espaços no início/fim
      
      years = cleanYears;
    }
  }
  
  // 4. Monta o título no padrão (sem os símbolos >)
  const title = years 
    ? `${cleanPartName} ${carName} ${years}`
    : `${cleanPartName} ${carName}`;
  
  // 5. Garante que não passe de 60 caracteres (limite do marketplace)
  if (title.length <= 60) {
    return title;
  }
  
  // Se muito longo, tenta abreviar
  const shortTitle = years
    ? `${cleanPartName} ${vehicleBrand} ${vehicleModel} ${years}`
    : `${cleanPartName} ${vehicleBrand} ${vehicleModel}`;
    
  if (shortTitle.length <= 60) {
    return shortTitle;
  }
  
  // Última tentativa: trunca se necessário
  return shortTitle.substring(0, 57) + '...';
}

/**
 * Exemplos de títulos gerados:
 * - "Alternador Toyota Corolla 2018-2022"
 * - "Para-choque Dianteiro BMW 320i 2015-2020" 
 * - "Farol Esquerdo Honda Civic 2016-2021"
 * 
 * Limpeza automática:
 * - "2002-2023 (Motores 1.6 e 1.8)" → "2002-2023"
 * - "2015-2020 (Todas as versões)" → "2015-2020"
 */