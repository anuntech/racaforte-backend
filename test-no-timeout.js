import axios from 'axios';

const API_URL = 'http://localhost:3333';
const VEHICLE_ID = 'LADIS15BR018';

async function testNoTimeout() {
  console.log('⏱️ Testando timeout indefinido - Simulando Postman\n');

  const testData = {
    name: 'Comando Vidro Dianteiro Esquerdo L200 Triton',
    description: '',
    vehicle_internal_id: VEHICLE_ID
  };

  // Configuração do axios similar ao Postman
  const axiosConfig = {
    timeout: 0, // Sem timeout no cliente
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'TestClient/1.0'
    },
    // Configurações adicionais para evitar hang up
    maxRedirects: 5,
    validateStatus: function (status) {
      return status < 500; // Resolve apenas para status < 500
    }
  };

  try {
    console.log('📋 Testando: searchVehicle=false com timeout indefinido');
    console.log('   Dados:', testData);
    console.log('   Configuração axios: timeout=0 (indefinido)');
    console.log('   ⏰ Aguardando resposta...\n');
    
    const startTime = Date.now();
    
    const response = await axios.post(
      `${API_URL}/part/process?searchVehicle=false`, 
      testData,
      axiosConfig
    );
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Teste concluído com SUCESSO em ${duration}ms (${(duration/1000).toFixed(1)}s)`);
    console.log('   Status:', response.status);
    console.log('   Anúncios encontrados:', response.data.data?.ads?.length || 0);
    console.log('   Preços:', response.data.data?.prices);
    console.log('');
    console.log('🎉 SEM SOCKET HANG UP! O timeout indefinido funcionou.');
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('❌ Timeout na requisição (não deveria acontecer com timeout=0)');
    } else if (error.message === 'socket hang up' || error.code === 'ECONNRESET') {
      console.error('❌ Socket hang up ainda ocorrendo - problema no servidor');
      console.error('   Verifique se o servidor foi reiniciado com as novas configurações');
    } else if (error.response) {
      console.log(`✅ Resposta recebida com status ${error.response.status}`);
      console.log('   Dados:', error.response.data);
    } else {
      console.error('❌ Erro não relacionado a timeout:', error.message);
    }
  }
}

console.log('🚀 INSTRUÇÕES PARA O POSTMAN:');
console.log('   1. Vá em Settings > General');
console.log('   2. Configure "Request timeout in ms" para 0 (zero)');
console.log('   3. Ou configure um valor alto como 600000 (10 minutos)');
console.log('   4. Certifique-se que o servidor foi reiniciado\n');

// Executar teste
testNoTimeout().catch(console.error);
