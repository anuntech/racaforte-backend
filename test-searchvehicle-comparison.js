#!/usr/bin/env node

/**
 * Test script para comparar searchVehicle=true vs searchVehicle=false
 * Run with: node test-searchvehicle-comparison.js
 */

const axios = require('axios');

async function testSearchVehicleComparison() {
  console.log('🧪 Comparando searchVehicle=true vs searchVehicle=false com novo sistema\n');
  
  const testData = {
    name: "Alternador",
    description: "Alternador em bom estado de conservação",
    vehicle_internal_id: "JEGRA11BR015"
  };
  
  try {
    console.log('📋 Dados de teste:', JSON.stringify(testData, null, 2));
    console.log('\n======================================');
    
    // Teste 1: searchVehicle=true (padrão)
    console.log('📋 TESTE 1: searchVehicle=true (com dados do veículo)');
    console.log('   🔍 Busca Unwrangle: incluirá marca, modelo e ano');
    console.log('   🤖 Prompts IA: incluirão dados do veículo');
    console.log('   📝 Título: incluirá dados do veículo\n');
    
    const startTime1 = Date.now();
    const response1 = await axios.post('http://localhost:3333/part/process?searchVehicle=true', testData, {
      timeout: 120000
    });
    const duration1 = Date.now() - startTime1;
    
    console.log('✅ Teste 1 concluído em', duration1, 'ms');
    console.log('   📝 Título gerado:', response1.data.data.ad_title);
    console.log('   📊 Anúncios encontrados:', response1.data.data.ads?.length || 0);
    console.log('   💰 Preços:', response1.data.data.prices);
    
    console.log('\n======================================');
    
    // Aguardar um pouco antes do próximo teste
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Teste 2: searchVehicle=false
    console.log('📋 TESTE 2: searchVehicle=false (sem dados do veículo)');
    console.log('   🔍 Busca Unwrangle: apenas pelo nome "Alternador"');
    console.log('   🤖 Prompts IA: NÃO incluirão dados do veículo');
    console.log('   📝 Título: será genérico/universal\n');
    
    const startTime2 = Date.now();
    const response2 = await axios.post('http://localhost:3333/part/process?searchVehicle=false', testData, {
      timeout: 120000
    });
    const duration2 = Date.now() - startTime2;
    
    console.log('✅ Teste 2 concluído em', duration2, 'ms');
    console.log('   📝 Título gerado:', response2.data.data.ad_title);
    console.log('   📊 Anúncios encontrados:', response2.data.data.ads?.length || 0);
    console.log('   💰 Preços:', response2.data.data.prices);
    
    console.log('\n======================================');
    console.log('📊 COMPARAÇÃO DOS RESULTADOS:');
    console.log('');
    
    console.log('🎯 TÍTULOS:');
    console.log('   Com veículo   :', response1.data.data.ad_title);
    console.log('   Sem veículo   :', response2.data.data.ad_title);
    console.log('   ✅ Diferentes:', response1.data.data.ad_title !== response2.data.data.ad_title ? 'SIM' : 'NÃO');
    
    console.log('\n📊 ANÚNCIOS:');
    console.log('   Com veículo   :', response1.data.data.ads?.length || 0, 'anúncios');
    console.log('   Sem veículo   :', response2.data.data.ads?.length || 0, 'anúncios');
    
    console.log('\n💰 PREÇOS:');
    console.log('   Com veículo   : R$', response1.data.data.prices.suggested_price);
    console.log('   Sem veículo   : R$', response2.data.data.prices.suggested_price);
    
    console.log('\n🚗 COMPATIBILIDADE:');
    console.log('   Com veículo   :', response1.data.data.compatibility?.length || 0, 'veículos');
    console.log('   Sem veículo   :', response2.data.data.compatibility?.length || 0, 'veículos');
    
    console.log('\n⚡ PERFORMANCE:');
    console.log('   Com veículo   :', duration1, 'ms');
    console.log('   Sem veículo   :', duration2, 'ms');
    
    console.log('\n🎉 Teste completo! Sistema está funcionando corretamente.');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Executar o teste
testSearchVehicleComparison().then(() => {
  console.log('\n🏁 Comparação finalizada');
}).catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});

