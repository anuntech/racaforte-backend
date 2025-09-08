import axios from 'axios';

const API_URL = 'http://localhost:3333';
const VEHICLE_ID = 'LADIS15BR018';

async function testSearchVehicleFix() {
  console.log('🔧 Testando correção do erro socket hang up com searchVehicle=false\n');

  const testData = {
    name: 'Comando Vidro Dianteiro Esquerdo L200 Triton',
    description: '',
    vehicle_internal_id: VEHICLE_ID
  };

  try {
    console.log('📋 Testando: searchVehicle=false');
    console.log('   Dados:', testData);
    console.log('   Esperado: Resposta com ads=[] se não encontrar compatíveis\n');
    
    const startTime = Date.now();
    const response = await axios.post(`${API_URL}/part/process?searchVehicle=false`, testData, {
      timeout: 120000 // 2 minutos
    });
    const duration = Date.now() - startTime;
    
    console.log('✅ Teste concluído com sucesso em', duration, 'ms');
    console.log('   Status:', response.status);
    console.log('   Anúncios encontrados:', response.data.data.ads?.length || 0);
    console.log('   Preços:', response.data.data.prices);
    console.log('');
    
    if (response.data.data.ads?.length === 0) {
      console.log('✅ Funcionando corretamente: array vazio retornado quando não há compatibilidade');
    } else {
      console.log('ℹ️ Anúncios encontrados:', response.data.data.ads);
    }

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('❌ Timeout na requisição');
    } else if (error.message === 'socket hang up') {
      console.error('❌ Socket hang up - o servidor ainda está com problema');
    } else {
      console.error('❌ Erro durante o teste:', error.response?.data || error.message);
    }
  }
}

// Executar teste
testSearchVehicleFix().catch(console.error);
