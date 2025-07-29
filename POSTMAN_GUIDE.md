# 🚀 Guia de Testes - Postman

Este guia mostra como testar os dois principais endpoints da API usando o Postman.

---

## 🔧 Configuração Inicial

### 1. Configurar Variáveis de Ambiente
Crie uma **Environment** no Postman com:
```
base_url: http://localhost:3333
```

### 2. Headers Globais (opcional)
```
User-Agent: PostmanRuntime/7.0.0
```

---

## 🧠 Endpoint 1: POST /part/process

**Função:** Processar dados da peça usando IA (Gemini) - apenas dados textuais, sem imagens.

### ⚙️ Configuração

**URL:** `{{base_url}}/part/process`  
**Method:** `POST`  
**Content-Type:** `application/json`

### 📝 Body (raw JSON)
```json
{
  "name": "Alternador",
  "description": "Alternador 70A 12V em bom estado de funcionamento",
  "vehicle_internal_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### 🎯 Exemplos de Teste

#### Teste 1: Alternador Toyota
```json
{
  "name": "Alternador",
  "description": "Alternador original 90A 12V, testado e funcionando perfeitamente",
  "vehicle_internal_id": "toyota-corolla-2020"
}
```

#### Teste 2: Para-choque BMW
```json
{
  "name": "Para-choque Dianteiro",
  "description": "Para-choque dianteiro original com pequeno risco, cor preta",
  "vehicle_internal_id": "bmw-320i-2018"
}
```

#### Teste 3: Farol Honda
```json
{
  "name": "Farol",
  "description": "Farol esquerdo original com lente cristalina, sem trincas",
  "vehicle_internal_id": "honda-civic-2019"
}
```

### ✅ Resposta Esperada (200 OK)
```json
{
  "success": true,
  "data": {
    "ad_title": "Alternador Toyota Corolla 2020 - 90A Original",
    "ad_description": "Alternador original em excelente estado...",
    "dimensions": {
      "width": "15cm",
      "height": "8cm",
      "depth": "25cm",
      "unit": "cm"
    },
    "weight": 5.2,
    "compatibility": [
      {
        "brand": "Toyota",
        "model": "Corolla",
        "year": "2018-2022"
      }
    ],
    "prices": {
      "min_price": 180.00,
      "suggested_price": 250.00,
      "max_price": 320.00
    }
  }
}
```

### ❌ Erros Comuns

#### Erro de Validação (400)
```json
{
  "success": false,
  "error": {
    "type": "validation_error",
    "message": "Required"
  }
}
```

#### Veículo Não Encontrado (404)
```json
{
  "success": false,
  "error": {
    "type": "vehicle_not_found",
    "message": "Veículo não encontrado com o ID fornecido."
  }
}
```

---

## 🎨 Endpoint 2: POST /images/remove-background

**Função:** Remover fundo de até 10 imagens usando remove.bg

### ⚙️ Configuração

**URL:** `{{base_url}}/images/remove-background`  
**Method:** `POST`  
**Content-Type:** `multipart/form-data`

### 📁 Body (form-data)
| Key | Type | Value |
|-----|------|-------|
| `image1` | `File` | Selecionar arquivo de imagem |
| `image2` | `File` | Selecionar arquivo de imagem (opcional) |
| `image3` | `File` | Selecionar arquivo de imagem (opcional) |
| ... | ... | Até 10 imagens |

### 🖼️ Formatos Aceitos
- ✅ JPEG (.jpg, .jpeg)
- ✅ PNG (.png)
- ✅ WEBP (.webp)
- ❌ GIF, BMP, TIFF (não aceitos)

### 📏 Limites
- **Máximo:** 10 imagens por requisição
- **Tamanho:** 50MB por arquivo
- **Total:** Sem limite de tamanho total

### ✅ Resposta Esperada (200 OK)
```json
{
  "success": true,
  "data": {
    "processed_images": [
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    ],
    "processing_info": {
      "total_images": 2,
      "successful_removals": 2,
      "failed_removals": 0,
      "processing_time_ms": 3500
    }
  }
}
```

### ❌ Erros Comuns

#### Nenhum Arquivo (400)
```json
{
  "success": false,
  "error": {
    "type": "no_file",
    "message": "Nenhum arquivo foi enviado."
  }
}
```

#### Muitos Arquivos (400)
```json
{
  "success": false,
  "error": {
    "type": "too_many_files",
    "message": "Máximo de 10 imagens permitidas."
  }
}
```

#### Formato Inválido (400)
```json
{
  "success": false,
  "error": {
    "type": "invalid_format",
    "message": "Formato de arquivo inválido. Apenas JPEG, PNG e WEBP são aceitos."
  }
}
```

#### Arquivo Muito Grande (400)
```json
{
  "success": false,
  "error": {
    "type": "file_too_large",
    "message": "Arquivo muito grande. Tamanho máximo: 50MB."
  }
}
```

---

## 🎯 Fluxo Completo de Teste

### Cenário: Processar Alternador Toyota

#### 1️⃣ Primeiro: Obter dados da peça
```http
POST {{base_url}}/part/process
Content-Type: application/json

{
  "name": "Alternador",
  "description": "Alternador 90A 12V Toyota original",
  "vehicle_internal_id": "toyota-corolla-2020"
}
```

#### 2️⃣ Depois: Processar imagens (opcional)
```http
POST {{base_url}}/images/remove-background
Content-Type: multipart/form-data

[Anexar 1-10 imagens do alternador]
```

#### 3️⃣ Resultado: 
- **Dados:** Título, descrição, preços, compatibilidade
- **Imagens:** Base64 com fundo removido

---

## 🔍 Dicas de Teste

### Performance
- **`/part/process`:** ~5-15 segundos
- **`/images/remove-background`:** ~3-8 segundos por imagem

### Debugging
- Monitore os logs do servidor para ver o processamento
- Use `Console` do Postman para debugging
- Teste com diferentes tipos de peças

### Melhores Práticas
1. **Sempre teste `/part/process` primeiro** (mais rápido)
2. **Use imagens de boa qualidade** para melhor remoção de fundo
3. **Teste com diferentes veículos** (Toyota, BMW, Honda, etc.)
4. **Monitore tempos de resposta** para otimização

---

## 📊 Collection do Postman

### Criar Collection
1. **New Collection:** "Raca Forte API"
2. **Add Request:** "Process Part Data"
3. **Add Request:** "Remove Background"
4. **Environment:** Criar com `base_url`

### Variáveis Úteis
```json
{
  "base_url": "http://localhost:3333",
  "sample_vehicle_id": "toyota-corolla-2020",
  "sample_part_name": "Alternador",
  "sample_description": "Alternador 90A 12V original"
}
```

Agora você pode testar facilmente ambos os endpoints! 🚀 