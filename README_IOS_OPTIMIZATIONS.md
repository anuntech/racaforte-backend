# Otimizações para iOS - Endpoint `/part/process`

## Problema Identificado

O endpoint `POST /part/process` estava apresentando timeouts no iOS devido ao erro `ECONNRESET`, onde o cliente iOS fecha a conexão antes da requisição terminar. Este é um comportamento comum no iOS que tem timeouts mais agressivos para requisições HTTP.

## Otimizações Implementadas

### 1. Controller (`src/controllers/part.controller.ts`)

#### Timeout Específico para iOS
- Implementado timeout de **2 minutos (120s)** para todo o processamento
- Verificação de timeout a cada etapa do processamento
- Função `checkIOSTimeout()` monitora o tempo decorrido

#### Headers Keep-Alive
```typescript
reply.raw.setHeader('Connection', 'keep-alive');
reply.raw.setHeader('Keep-Alive', 'timeout=65, max=1000');
```

#### Timeouts por Operação
- **Multipart processing**: Verificação a cada parte processada
- **Database query**: 10s timeout para consulta de veículo
- **File buffer**: 20s timeout por arquivo
- **AI processing**: 45s timeout para OpenAI
- **Background removal**: 25s timeout por imagem

#### Tratamento de Erros Específico
- Status code **408** para timeouts relacionados ao iOS
- Mensagens de erro específicas para timeout
- Fallback para imagem original em caso de timeout na remoção de fundo

### 2. Servidor (`src/server.ts`)

#### Configurações Fastify
```typescript
{
  requestTimeout: 300000, // 5 minutos
  bodyLimit: 104857600,   // 100MB
  keepAliveTimeout: 65000, // 65 segundos
  connectionTimeout: 60000, // 60 segundos
  trustProxy: true,        // Para ngrok/proxy
}
```

#### CORS Otimizado para iOS
```typescript
{
  optionsSuccessStatus: 200, // iOS precisa de 200 ao invés de 204
  preflightContinue: false,
  maxAge: 86400,           // Cache preflight por 24h
}
```

### 3. Storage Service (`src/services/storage.service.ts`)

#### Remove.bg API com Timeout
- Timeout de **20 segundos** para remoção de background
- Tratamento específico para timeouts (`ECONNABORTED`)
- Fallback automático para imagem original

```typescript
timeout: 20000, // 20 segundos
maxRedirects: 3,
validateStatus: (status: number) => status < 500
```

### 4. Image Service (`src/services/image.service.ts`)

#### OpenAI API com Timeout Dinâmico
- **30s** para requisições normais
- **40s** para requisições com imagens grandes (>10MB)
- Análise do tamanho total das imagens

```typescript
const isLargeRequest = totalImageSize > 10000000;
const timeoutMs = isLargeRequest ? 40000 : 30000;
```

### 5. Multipart Configuration (`src/routes/part.routes.ts`)

#### Configurações Busboy para iOS
```typescript
{
  addToBody: false,        // Melhor para streaming
  preservePath: false,
  defCharset: 'utf8',
  defParamCharset: 'utf8',
}
```

## Benefícios das Otimizações

### ✅ Prevenção de Timeout
- Timeouts específicos para cada operação
- Verificação contínua do tempo decorrido
- Fallbacks automáticos em caso de demora

### ✅ Melhor Experiência no iOS
- Headers keep-alive para manter conexão
- Configurações CORS específicas para iOS
- Tratamento de erros com mensagens úteis

### ✅ Robustez
- Graceful degradation (imagem original se remoção de fundo falhar)
- Retry logic otimizado
- Logs detalhados para debugging

### ✅ Compatibilidade
- Mantém funcionalidade completa para outros clientes
- Não quebra implementação existente
- Melhora performance geral

## Monitoramento

### Logs Específicos para iOS
```
📱 iOS: Arquivo grande detectado: X bytes
⏱️ Usando timeout de Xs para esta requisição
⏰ Timeout na remoção de fundo para arquivo.jpg - usando imagem original
```

### Status Codes
- **408**: Timeout específico do iOS
- **400**: Erro de validação/formato
- **200**: Sucesso com todas otimizações

## Testes Recomendados

1. **Imagens pequenas (< 5MB)**: Deve processar em ~30-60s
2. **Imagens grandes (10-50MB)**: Deve processar em ~60-120s
3. **Múltiplas imagens**: Processamento paralelo otimizado
4. **Conexão lenta**: Fallbacks ativados automaticamente

## Próximos Passos

Se ainda houver timeouts, considerar:
1. Implementar endpoint de upload separado
2. Processamento completamente assíncrono
3. WebSocket para updates em tempo real
4. Compressão de imagens antes do processamento 