#!/usr/bin/env node

/**
 * Script de teste para validar a API do Grok
 * Execute: node test-grok-api.js
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

const GROK_API_KEY = process.env.GROK_API_KEY;

if (!GROK_API_KEY) {
  console.error('❌ GROK_API_KEY não encontrada no .env');
  console.log('📝 Adicione sua chave no arquivo .env:');
  console.log('   GROK_API_KEY=sua_chave_aqui');
  process.exit(1);
}

async function testGrokAPI() {
  console.log('🧪 Testando API do Grok...');
  console.log(`🔑 Usando API Key: ${GROK_API_KEY.substring(0, 10)}...`);
  
  const models = ['grok-4-0709', 'grok-4', 'grok-beta', 'grok-2-1212'];
  
  for (const model of models) {
    try {
      console.log(`\n📡 Testando modelo: ${model}`);
      
      const response = await axios.post('https://api.x.ai/v1/chat/completions', {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente útil. Responda de forma concisa.'
          },
          {
            role: 'user',
            content: 'Diga "Olá" em português brasileiro.'
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      }, {
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      if (response.data && response.data.choices && response.data.choices[0]) {
        const content = response.data.choices[0].message?.content;
        console.log(`✅ ${model}: FUNCIONANDO`);
        console.log(`📝 Resposta: ${content}`);
        
        // Se chegou aqui, o modelo funciona - pode testar Live Search
        await testLiveSearch(model);
        break; // Para no primeiro modelo que funciona
        
      } else {
        console.log(`❌ ${model}: Resposta inválida`);
      }
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`❌ ${model}: Modelo não encontrado (404)`);
      } else if (error.response?.status === 401) {
        console.log(`❌ ${model}: API Key inválida (401)`);
      } else if (error.response?.status === 429) {
        console.log(`❌ ${model}: Limite de requisições (429)`);
      } else {
        console.log(`❌ ${model}: Erro - ${error.message}`);
      }
    }
  }
}

async function testLiveSearch(workingModel) {
  console.log(`\n🔍 Testando Live Search com ${workingModel}...`);
  
  try {
    const response = await axios.post('https://api.x.ai/v1/chat/completions', {
      model: workingModel,
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em preços de autopeças brasileiras.'
        },
        {
          role: 'user',
          content: 'Busque no Mercado Livre brasileiro os preços ATUAIS de faróis usados para Volkswagen Gol 2010. Preciso de dados de 2024/2025. Retorne preços encontrados em sites brasileiros.'
        }
      ],
      temperature: 0.3,
      max_tokens: 100,
      search_parameters: {
        mode: 'on', // FORÇAR Live Search sempre ativo (não 'auto')
        sources: [{ type: 'web' }],
        max_search_results: 5,
        return_citations: true
      }
    }, {
      headers: {
        'Authorization': `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    
    if (response.data && response.data.choices && response.data.choices[0]) {
      const content = response.data.choices[0].message?.content;
      
      console.log(`✅ Live Search: FUNCIONANDO`);
      console.log(`📝 Resposta: ${content}`);
      
      // Log detalhado do uso do Live Search
      console.log('\n🔍 === VERIFICAÇÃO DETALHADA DO LIVE SEARCH ===');
      console.log('📋 Dados de usage completos:', JSON.stringify(response.data.usage, null, 2));
      
      if (response.data.usage) {
        const sourcesUsed = response.data.usage.num_sources_used || 0;
        const cost = sourcesUsed * 0.025;
        
        console.log(`🔍 Fontes utilizadas: ${sourcesUsed}`);
        console.log(`💰 Custo: $${cost.toFixed(4)}`);
        
        if (sourcesUsed > 0) {
          console.log('✅ LIVE SEARCH CONFIRMADO: Fontes externas foram utilizadas!');
        } else {
          console.log('⚠️  Live Search configurado (mode: on), mas 0 fontes utilizadas');
          console.log('   Isso pode acontecer se o modelo decidir que não precisa de busca externa');
        }
      } else {
        console.log('❌ Nenhuma informação de usage encontrada na resposta');
      }
      
      // Verifica citações
      if (response.data.citations && response.data.citations.length > 0) {
        console.log(`📚 Citações encontradas: ${response.data.citations.length}`);
        response.data.citations.forEach((citation, index) => {
          console.log(`   ${index + 1}. ${citation.url || citation.title || 'Fonte'}`);
        });
      } else {
        console.log('📚 Nenhuma citação retornada');
      }
      
      console.log('🔍 === FIM VERIFICAÇÃO ===\n');
    }
    
  } catch (error) {
    console.log(`❌ Live Search: Erro - ${error.message}`);
    if (error.response?.data) {
      console.log(`📋 Detalhes:`, error.response.data);
    }
  }
}

// Executa o teste
testGrokAPI()
  .then(() => {
    console.log('\n✅ Teste concluído!');
  })
  .catch((error) => {
    console.error('\n❌ Erro no teste:', error.message);
    process.exit(1);
  });
