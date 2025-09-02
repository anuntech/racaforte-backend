#!/usr/bin/env node

/**
 * Test script for full POST /part/process integration with webscraping
 * Run with: node test-integration.js
 */

const axios = require('axios');

async function testPartProcessIntegration() {
  console.log('🚀 Testing full POST /part/process integration with webscraping...\n');
  
  try {
    // Test data - using a real vehicle_internal_id from the database
    const testData = {
      name: "Alternador",
      description: "Alternador em bom estado de conservação",
      vehicle_internal_id: "JEGRA11BR015"
    };
    
    console.log('📤 Sending test request to /part/process');
    console.log('📋 Test data:', JSON.stringify(testData, null, 2));
    console.log('⏳ This may take 1-2 minutes due to AI processing...\n');
    
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:3333/part/process', testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 3 minutes timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log('✅ Success! Response received in', responseTime, 'ms');
    console.log('🔍 Status:', response.status);
    console.log('📊 Full Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data) {
      const { data } = response.data;
      console.log('\n📋 Processing Summary:');
      console.log(`   📝 Title: ${data.ad_title}`);
      console.log(`   📄 Description: ${data.ad_description?.substring(0, 100)}...`);
      console.log(`   📏 Dimensions: ${data.dimensions?.width}x${data.dimensions?.height}x${data.dimensions?.depth} ${data.dimensions?.unit}`);
      console.log(`   ⚖️  Weight: ${data.weight} kg`);
      console.log(`   🚗 Compatibility: ${data.compatibility?.length} vehicles`);
      
      if (data.prices) {
        console.log('\n💰 Pricing Information:');
        console.log(`   💵 Min Price: R$${data.prices.min_price}`);
        console.log(`   💡 Suggested Price: R$${data.prices.suggested_price}`);
        console.log(`   💰 Max Price: R$${data.prices.max_price}`);
      }
      
      if (data.ads && data.ads.length > 0) {
        console.log('\n🛒 Filtered Ads from Webscraping:');
        data.ads.slice(0, 3).forEach((ad, index) => {
          console.log(`   ${index + 1}. ${ad.title}`);
          console.log(`      💰 Price: R$${ad.price}`);
          console.log(`      🔗 URL: ${ad.url}`);
          console.log('');
        });
        console.log(`   ... and ${Math.max(0, data.ads.length - 3)} more ads`);
      } else {
        console.log('\n🛒 No relevant ads found in webscraping data');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed!');
    
    if (error.response) {
      console.error('🔍 Status:', error.response.status);
      console.error('📋 Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 404) {
        console.error('\n💡 Note: You need to use a valid vehicle_internal_id from your database');
      }
    } else if (error.request) {
      console.error('📡 No response received - is the server running on http://localhost:3333?');
    } else {
      console.error('⚠️  Error:', error.message);
    }
  }
}

// Instructions for the user
console.log('🧪 POST /part/process Integration Test');
console.log('=====================================');
console.log('📍 Make sure the server is running on http://localhost:3333');
console.log('🔑 Make sure UNWRANGLE_API_KEY is set in .env file');
console.log('🔑 Make sure GROK_API_KEY is set in .env file');
console.log('🗄️  Make sure you have a valid vehicle in your database');
console.log('⚠️  You may need to update the vehicle_internal_id in the test data\n');

testPartProcessIntegration();
