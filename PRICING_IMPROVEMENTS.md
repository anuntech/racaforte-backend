# 💰 Melhorias na Precificação - Mercado Livre Brasil 2024

## 🔍 Problema Identificado

Os preços gerados pela IA estavam muito fora da realidade do mercado brasileiro de autopeças usadas.

## ✅ Melhorias Implementadas

### 1. **Prompt Específico para Mercado Livre**

#### **Contexto Melhorado:**
```
Você é um especialista em peças automotivas e VENDEDOR EXPERIENTE no Mercado Livre Brasil. 
Você conhece EXATAMENTE os preços atuais de 2024 de peças usadas no Mercado Livre.

CONTEXTO MERCADO LIVRE BRASIL 2024:
- Você tem acesso mental ao Mercado Livre Brasil em tempo real
- Conhece os preços de peças similares USADAS vendidas HOJE
- Sabe diferenciar preços por marca, modelo e ano do veículo
- Entende o mercado brasileiro de autopeças usadas
```

### 2. **Instruções Específicas de Pesquisa**

```
- IMAGINE que você está consultando o Mercado Livre Brasil AGORA em 2024
- Pesquise mentalmente por "${partName} ${vehicleBrand} ${vehicleModel} ${vehicleYear}" no Mercado Livre
- Considere o estado da peça: USADA mas em BOA CONDIÇÃO
- Analise preços similares de peças USADAS no Mercado Livre Brasil
- IMPORTANTE: Use valores REALISTAS do mercado brasileiro atual (2024)
```

### 3. **Exemplos de Preços Reais**

Adicionei faixas de preços baseadas no Mercado Livre real:

```
EXEMPLOS DE PREÇOS REAIS MERCADO LIVRE BRASIL 2024:
- Alternador usado: R$ 180-600 (depende do carro)
- Motor de partida usado: R$ 150-450
- Farol usado: R$ 80-300
- Para-choque usado: R$ 200-800
- Radiador usado: R$ 150-500
- Volante usado: R$ 100-350
- Espelho retrovisor usado: R$ 60-200
- Peças raras/importadas: +50-100% dos valores acima
```

### 4. **Fórmula de Precificação Baseada no Mercado**

```
FÓRMULA DE PRECIFICAÇÃO:
- min_price: 25-35% MENOR que preços similares no Mercado Livre (venda rápida)
- suggested_price: PREÇO MÉDIO de peças similares usadas no Mercado Livre
- max_price: 15-25% MAIOR que a média (preço premium/negociação)
```

### 5. **Considerações de Mercado**

```
- Considere marca do veículo (Toyota/Honda = mais caro, Fiat/Ford = mais barato)
- Peças de carros populares = mais baratas, carros premium = mais caras
- Verifique se a peça é comum ou rara no mercado brasileiro
```

### 6. **Títulos e Descrições Realistas**

```
- O título do anúncio deve ser IGUAL aos títulos do Mercado Livre Brasil
- A descrição deve ser como descrições REAIS de vendedores experientes do Mercado Livre
```

## 🔍 **Sistema de Validação de Preços**

Implementei logs de validação automática:

### **Logs de Análise:**
```
🔍 DEBUG - Análise de preços para Alternador:
   Peça: Alternador
   Veículo: Honda Civic 2004
   Preço mínimo: R$ 220
   Preço sugerido: R$ 320
   Preço máximo: R$ 380
   Diferença min-sugerido: 45.5%
   Diferença sugerido-max: 18.8%
✅ DEBUG - Preço dentro do range esperado: R$ 150-700
```

### **Alertas Automáticos:**

#### **Preços Suspeitos:**
```
⚠️ DEBUG - PREÇO SUSPEITO: Muito baixo (R$ 15) para Alternador
⚠️ DEBUG - PREÇO SUSPEITO: Muito alto (R$ 3500) para Farol
```

#### **Range por Categoria:**
```
⚠️ DEBUG - PREÇO FORA DO RANGE ESPERADO:
   Esperado para Alternador: R$ 150-700
   Gerado: R$ 950
```

### **Ranges de Validação por Peça:**

- **Alternador**: R$ 150-700
- **Motor de partida**: R$ 120-500  
- **Farol/Lanterna**: R$ 70-350
- **Para-choque**: R$ 180-900
- **Radiador**: R$ 120-600
- **Volante**: R$ 80-400
- **Espelho**: R$ 50-250

## 🎯 **Configurações Técnicas**

### **Temperature Reduzida:**
```typescript
temperature: 0.2 // Mais consistente com preços reais (era 0.3)
```

### **Tokens Ajustados:**
```typescript
max_tokens: 1000 // Permite mais detalhes na análise de preços
```

## 📋 **Como Monitorar**

### **Logs a Observar:**
1. `💰 DEBUG - Preços gerados:` - Valores básicos
2. `🔍 DEBUG - Análise de preços:` - Análise detalhada
3. `✅ DEBUG - Preço dentro do range esperado` - Validação OK
4. `⚠️ DEBUG - PREÇO SUSPEITO/FORA DO RANGE` - Requer atenção

### **Exemplo de Teste:**
```bash
# Teste um alternador
curl -X POST /part/process \
  -F "name=Alternador" \
  -F "description=Alternador usado em bom estado" \
  -F "vehicle_internal_id=HONCIV2004BR002" \
  -F "images=@alternador.jpg"

# Monitore os logs para ver:
💰 DEBUG - Preços gerados: min R$220, sugerido R$320, max R$380
✅ DEBUG - Preço dentro do range esperado: R$ 150-700
```

## 🎯 **Resultado Esperado**

### **Antes:**
```json
{
  "prices": {
    "min_price": 50,
    "suggested_price": 120,
    "max_price": 180
  }
}
```

### **Depois (Mais Realista):**
```json
{
  "prices": {
    "min_price": 220,
    "suggested_price": 320,
    "max_price": 380
  }
}
```

Agora os preços devem estar muito mais alinhados com o **Mercado Livre Brasil real** de 2024! 🎯 