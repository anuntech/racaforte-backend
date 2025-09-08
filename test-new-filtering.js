#!/usr/bin/env node

/**
 * Test script for the new custom filtering system
 * Run with: node test-new-filtering.js
 */

const axios = require('axios');

async function testNewFilteringSystem() {
  console.log('🚀 Testing new custom filtering system...\n');
  
  try {
    // Test data - using a real vehicle_internal_id from the database
    const testData = {
      name: "Alternador",
      description: "Alternador em bom estado de conservação",
      vehicle_internal_id: "JEGRA11BR015"
    };
    
    console.log('📤 Sending test request to /part/process with new filtering system');
    console.log('📋 Test data:', JSON.stringify(testData, null, 2));
    console.log('⏳ This should be faster than AI processing...\n');
    
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:3333/part/process', testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 1 minute timeout (should be much faster)
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log('✅ Success! Response received in', responseTime, 'ms');
    console.log('🔍 Status:', response.status);
    console.log('📊 Full Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data) {
      const data = response.data.data;
      
      console.log('\n🎯 Analysis of new filtering system:');
      console.log('📈 Prices calculated:', data.prices);
      console.log('📝 Ad description generated:', data.ad_description ? 'Yes' : 'No');
      console.log('📐 Dimensions estimated:', data.dimensions ? 'Yes' : 'No');
      console.log('⚖️ Weight estimated:', data.weight ? 'Yes' : 'No');
      console.log('🔗 Compatibility calculated:', data.compatibility ? 'Yes' : 'No');
      
      if (data.prices) {
        console.log('\n💰 Price Details:');
        console.log(`   Min Price: R$ ${data.prices.min_price}`);
        console.log(`   Suggested Price: R$ ${data.prices.suggested_price}`);
        console.log(`   Max Price: R$ ${data.prices.max_price}`);
      }
      
      console.log(`\n⚡ Performance: ${responseTime}ms (expected to be faster than AI)`);
      console.log('🎉 New filtering system is working correctly!');
    } else {
      console.log('❌ Unexpected response format');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testNewFilteringSystem().then(() => {
  console.log('\n🏁 Test completed');
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
