# Novo Endpoint: Buscar Peça por Critérios

## Endpoint
`POST /part/find`

## Descrição
Este endpoint permite buscar uma peça específica no banco de dados usando critérios como ID interno do veículo, nome da peça e opcionalmente a descrição da peça. Retorna todas as informações da peça incluindo as URLs das imagens.

## Parâmetros da Requisição

### Body (JSON)
```json
{
  "vehicle_internal_id": "string",  // Obrigatório - ID interno do veículo
  "partName": "string",             // Obrigatório - Nome da peça
  "partDescription": "string"       // Opcional - Descrição da peça
}
```

## Exemplo de Uso

### Requisição
```bash
curl -X POST "http://localhost:3000/part/find" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_internal_id": "VHC001",
    "partName": "para-choque",
    "partDescription": "dianteiro"
  }'
```

### Resposta de Sucesso (200)
```json
{
  "success": true,
  "data": {
    "id": "part_123456",
    "name": "Para-choque Dianteiro",
    "description": "Para-choque dianteiro original em bom estado",
    "condition": "BOA",
    "stock_address": "Setor A - Prateleira 15",
    "dimensions": {
      "width": "120",
      "height": "30",
      "depth": "40",
      "unit": "cm"
    },
    "weight": 5.5,
    "compatibility": [
      {
        "brand": "Toyota",
        "model": "Corolla",
        "year": "2018"
      }
    ],
    "min_price": 150.00,
    "suggested_price": 200.00,
    "max_price": 250.00,
    "ad_title": "Para-choque Dianteiro Toyota Corolla 2018",
    "ad_description": "Para-choque dianteiro original em excelente estado...",
    "images": [
      "https://s3.amazonaws.com/racaforte/parts/part_123456/image1.jpg",
      "https://s3.amazonaws.com/racaforte/parts/part_123456/image2.jpg"
    ],
    "created_at": "2025-01-01T10:00:00.000Z",
    "updated_at": "2025-01-01T12:00:00.000Z",
    "car_id": "car_789",
    "car": {
      "id": "car_789",
      "internal_id": "VHC001",
      "brand": "Toyota",
      "model": "Corolla",
      "year": 2018,
      "color": "Prata"
    }
  }
}
```

### Resposta de Erro - Veículo não encontrado (404)
```json
{
  "success": false,
  "error": {
    "type": "car_not_found",
    "message": "Veículo não encontrado."
  }
}
```

### Resposta de Erro - Peça não encontrada (404)
```json
{
  "success": false,
  "error": {
    "type": "part_not_found",
    "message": "Peça não encontrada com os critérios especificados."
  }
}
```

### Resposta de Erro - Dados inválidos (400)
```json
{
  "success": false,
  "error": {
    "type": "validation_error",
    "message": "Nome da peça é obrigatório"
  }
}
```

## Funcionalidades

- ✅ Busca case-insensitive (ignora maiúsculas/minúsculas)
- ✅ Busca parcial no nome da peça (usa LIKE)
- ✅ Busca opcional na descrição (se fornecida)
- ✅ Retorna todas as informações da peça incluindo URLs das imagens
- ✅ Validação de dados com Zod
- ✅ Logs detalhados para debugging
- ✅ Documentação OpenAPI/Swagger automática

## Casos de Uso

Este endpoint é ideal para:
1. **Criação de peças idênticas**: Encontrar uma peça existente para usar como modelo
2. **Verificação de duplicatas**: Verificar se uma peça já existe antes de criar
3. **Busca específica**: Quando você conhece o veículo e o nome/tipo da peça
4. **Integração com frontend**: Obter dados completos de uma peça para exibição

## Integração com Frontend

```javascript
async function findPart(vehicleId, partName, partDescription = null) {
  try {
    const response = await fetch('/part/find', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        vehicle_internal_id: vehicleId,
        partName: partName,
        partDescription: partDescription
      })
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data; // Dados completos da peça
    } else {
      throw new Error(result.error.message);
    }
  } catch (error) {
    console.error('Erro ao buscar peça:', error);
    throw error;
  }
}

// Uso
try {
  const part = await findPart('VHC001', 'para-choque', 'dianteiro');
  console.log('Peça encontrada:', part);
  // Usar os dados da peça para criar uma idêntica
} catch (error) {
  console.log('Peça não encontrada, criar nova');
}
```