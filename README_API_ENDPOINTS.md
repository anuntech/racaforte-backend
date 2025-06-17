# API Endpoints - Racaforte Backend

## Veículos (Car Management)

### 1. Gerar Internal ID
```
POST /car/generate-internal-id
```
**Body:**
```json
{
    "brand": "Toyota",
    "model": "Corolla",
    "year": 2023,
    "color": "Prata"
}
```
**Resposta (200):**
```json
{
    "success": true,
    "data": {
        "internal_id": "TOYCOR2023PT001"
    }
}
```

### 2. Criar Veículo
```
POST /car
```
**Body:**
```json
{
    "brand": "Toyota",
    "model": "Corolla",
    "year": 2023,
    "color": "Prata",
    "internal_id": "TOYCOR2023PT001"
}
```
**Resposta (201):**
```json
{
    "success": true,
    "data": {
        "id": "cm4nq3x8k0000pv8wg2z6yutg",
        "internal_id": "TOYCOR2023PT001"
    }
}
```

### 3. Buscar Veículo por ID
```
GET /car/:identifier
```
**Exemplo:** `GET /car/TOYCOR2023PT001`

**Resposta (200):**
```json
{
    "success": true,
    "data": {
        "id": "cm4nq3x8k0000pv8wg2z6yutg",
        "internal_id": "TOYCOR2023PT001",
        "brand": "Toyota",
        "model": "Corolla",
        "year": 2023,
        "color": "Prata",
        "created_at": "2024-03-21T10:00:00.000Z",
        "updated_at": "2024-03-21T10:00:00.000Z"
    }
}
```

### 4. Atualizar Veículo
```
PATCH /car/:identifier
```
**Exemplo:** `PATCH /car/TOYCOR2023PT001`

**Body:**
```json
{
    "color": "Preto"
}
```
**Resposta (200):**
```json
{
    "success": true,
    "data": {
        "id": "cm4nq3x8k0000pv8wg2z6yutg",
        "internal_id": "TOYCOR2023PR001",
        "brand": "Toyota",
        "model": "Corolla",
        "year": 2023,
        "color": "Preto",
        "created_at": "2024-03-21T10:00:00.000Z",
        "updated_at": "2024-03-21T10:01:00.000Z"
    }
}
```

### 5. Deletar Veículo
```
DELETE /car/:identifier
```
**Exemplo:** `DELETE /car/TOYCOR2023PT001`

**Resposta (200):**
```json
{
    "success": true
}
```

### 6. Buscar Todos Internal IDs
```
GET /cars/internal-ids
```
**Resposta (200):**
```json
{
    "success": true,
    "data": [
        "TOYCOR2023PT001",
        "HONCIV2022AZ001",
        "FORCOC2021VM002"
    ]
}
```

### 7. Buscar Todos os Veículos
```
GET /cars
```
**Resposta (200):**
```json
{
    "success": true,
    "data": [
        {
            "id": "cm4nq3x8k0000pv8wg2z6yutg",
            "internal_id": "TOYCOR2023PT001",
            "brand": "Toyota",
            "model": "Corolla",
            "year": 2023,
            "color": "Prata",
            "created_at": "2024-03-21T10:00:00.000Z",
            "updated_at": "2024-03-21T10:00:00.000Z"
        },
        {
            "id": "cm4nq3x8k0001pv8wg2z6yuth",
            "internal_id": "HONCIV2022AZ001",
            "brand": "Honda",
            "model": "Civic",
            "year": 2022,
            "color": "Azul",
            "created_at": "2024-03-21T09:30:00.000Z",
            "updated_at": "2024-03-21T09:30:00.000Z"
        }
    ]
}
```

## Processamento de Imagens

### 8. Upload de Imagens para Identificação de Peças
```
POST /upload-images
```
**Content-Type:** `multipart/form-data`

**Body:** Até 5 arquivos de imagem (máximo 50MB cada)

**Resposta (200):**
```json
{
    "success": true,
    "data": {
        "name": "Pastilha de Freio",
        "description": "Pastilha de freio dianteira para veículos compactos"
    }
}
```

## Health Check

### 9. Verificar Status da API
```
GET /health
```
**Resposta (200):**
```json
{
    "message": "Ok"
}
```

## Códigos de Erro Comuns

**400 - Bad Request:**
```json
{
    "success": false,
    "error": {
        "type": "validation_error",
        "message": "Marca é obrigatória"
    }
}
```

**404 - Not Found:**
```json
{
    "success": false,
    "error": {
        "type": "car_not_found",
        "message": "Veículo não encontrado."
    }
}
```

**500 - Internal Server Error:**
```json
{
    "success": false,
    "error": {
        "type": "server_error",
        "message": "Erro interno do servidor. Tente novamente."
    }
}
```

## Workflow Recomendado

Para criar um novo veículo, siga estes passos:

1. **Gerar Internal ID**: Use `POST /car/generate-internal-id` com as informações do veículo
2. **Criar Veículo**: Use `POST /car` incluindo o `internal_id` gerado no passo anterior

**Exemplo de Workflow:**

**Passo 1 - Gerar Internal ID:**
```bash
POST /car/generate-internal-id
{
    "brand": "Toyota",
    "model": "Corolla", 
    "year": 2023,
    "color": "Prata"
}
```

**Passo 2 - Criar Veículo:**
```bash
POST /car
{
    "brand": "Toyota",
    "model": "Corolla",
    "year": 2023, 
    "color": "Prata",
    "internal_id": "TOYCOR2023PT001"
}
```

## Notas Importantes

- Todos os endpoints retornam JSON
- O `identifier` pode ser tanto o `id` UUID quanto o `internal_id` 
- O `internal_id` é gerado automaticamente no formato: `[MARCA][MODELO][ANO][COR][SEQUÊNCIA]`
- Exemplo: `TOYCOR2023PT001` = Toyota Corolla 2023 Prata #001
- Campos obrigatórios para criação: `brand`, `model`, `year`, `color`, `internal_id`
- Para atualização, pelo menos um campo deve ser fornecido (exceto internal_id)
- O ano deve estar entre 1900 e o próximo ano
- O endpoint de atualização regenera automaticamente o internal_id quando algum campo é alterado 