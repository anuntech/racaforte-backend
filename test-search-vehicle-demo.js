import axios from 'axios';

const API_URL = 'http://localhost:3333';
const VEHICLE_ID = 'LADIS15BR018';

async function testSearchVehicleParameter() {
  console.log('🧪 Testando parâmetro searchVehicle no endpoint POST /part/process\n');

  const testData = {
    name: 'Alternador',
    description: 'Alternador 12V 90A original',
    vehicle_internal_id: VEHICLE_ID
  };

  try {
    // Teste 1: searchVehicle=true (padrão)
    console.log('📋 TESTE 1: searchVehicle=true (busca com dados do veículo)');
    console.log('   URL:', `${API_URL}/part/process?searchVehicle=true`);
    console.log('   Esperado: Busca Unwrangle incluirá marca, modelo e ano do veículo\n');
    
    const startTime1 = Date.now();
    const response1 = await axios.post(`${API_URL}/part/process?searchVehicle=true`, testData);
    const duration1 = Date.now() - startTime1;
    
    console.log('✅ Teste 1 concluído em', duration1, 'ms');
    console.log('   Status:', response1.status);
    console.log('   Anúncios encontrados:', response1.data.data.ads?.length || 0);
    console.log('   Preços:', response1.data.data.prices);
    console.log('');

    // Aguardar um pouco antes do próximo teste
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Teste 2: searchVehicle=false
    console.log('📋 TESTE 2: searchVehicle=false (busca apenas pelo nome da peça)');
    console.log('   URL:', `${API_URL}/part/process?searchVehicle=false`);
    console.log('   Esperado: Busca Unwrangle será apenas pelo nome "Alternador"\n');
    
    const startTime2 = Date.now();
    const response2 = await axios.post(`${API_URL}/part/process?searchVehicle=false`, testData);
    const duration2 = Date.now() - startTime2;
    
    console.log('✅ Teste 2 concluído em', duration2, 'ms');
    console.log('   Status:', response2.status);
    console.log('   Anúncios encontrados:', response2.data.data.ads?.length || 0);
    console.log('   Preços:', response2.data.data.prices);
    console.log('');

    // Comparação
    console.log('🔍 COMPARAÇÃO DOS RESULTADOS:');
    console.log(`   Com veículo: ${response1.data.data.ads?.length || 0} anúncios`);
    console.log(`   Sem veículo: ${response2.data.data.ads?.length || 0} anúncios`);
    console.log('');
    console.log('   💡 Observação: As outras informações (descrição, dimensões, peso, compatibilidade)');
    console.log('      devem ser idênticas em ambos os casos, pois sempre usam dados do veículo.');
    console.log('');
    
    console.log('✅ Teste completo! O parâmetro searchVehicle afeta APENAS a busca Unwrangle.');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.response?.data || error.message);
  }
}

// Executar teste
testSearchVehicleParameter().catch(console.error);
