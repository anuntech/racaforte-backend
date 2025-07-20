# 🛠️ Correções para Expo/React Native - ECONNRESET Fix

## 🔍 Problema Identificado

Com os logs detalhados descobrimos que:

- **Cliente**: Expo/React Native (`Expo/1017699 CFNetwork/3826.500.131 Darwin/24.5.0`)
- **Erro**: `ECONNRESET` durante **ETAPA 1/6** (processamento multipart)
- **Tamanho**: Apenas 157KB - **NÃO é problema de tamanho**
- **Local**: Logo após detectar arquivo `image_0.jpg`, antes de ler o buffer

## ✅ Correções Implementadas

### 1. **Detecção Melhorada de Clientes Mobile**

```typescript
const isIOS = userAgent.toLowerCase().includes('ios') || 
              userAgent.toLowerCase().includes('iphone') || 
              userAgent.toLowerCase().includes('ipad');
const isExpo = userAgent.includes('Expo/') || userAgent.includes('CFNetwork');
const isReactNative = userAgent.includes('React Native') || isExpo;
const isDarwin = userAgent.includes('Darwin/');

const isMobileClient = isIOS || isExpo || isReactNative || isDarwin;
```

**Agora detecta:**
- ✅ iOS nativo
- ✅ **Expo** 
- ✅ React Native
- ✅ CFNetwork (iOS networking)
- ✅ Darwin (macOS/iOS)

### 2. **Processamento Otimizado para Mobile**

#### **Timeouts Específicos:**
```typescript
const MOBILE_PART_TIMEOUT = isMobileClient ? 10000 : 20000;    // 10s vs 20s
const MOBILE_BUFFER_TIMEOUT = isMobileClient ? 15000 : 20000;  // 15s vs 20s
const multipartTimeout = isMobileClient ? 30000 : 60000;       // 30s vs 60s
```

#### **Buffer Pré-carregado:**
Para clientes mobile, o buffer é carregado **imediatamente** durante o multipart:

```typescript
if (isMobileClient) {
  // Lê buffer imediatamente com timeout reduzido
  const buffer = await Promise.race([
    part.toBuffer(), 
    timeoutPromise(MOBILE_BUFFER_TIMEOUT)
  ]);
  
  // Cria objeto compatível com buffer pré-carregado
  const processedFile = { ...part, _buffer: buffer };
  files.push(processedFile);
}
```

### 3. **Tratamento de Erros Específico**

#### **ECONNRESET Detection:**
```typescript
if (error.message.includes('aborted') || error.code === 'ECONNRESET') {
  return reply.status(408).send({
    success: false,
    error: {
      type: 'connection_aborted',
      message: 'Conexão interrompida durante upload. Verifique sua conexão e tente novamente.'
    }
  });
}
```

#### **Mobile Timeout Detection:**
```typescript
if (error.message.includes('Mobile buffer timeout')) {
  return reply.status(408).send({
    success: false,
    error: {
      type: 'mobile_timeout_error', 
      message: 'Timeout de upload para cliente mobile. Tente novamente com imagens menores.'
    }
  });
}
```

### 4. **Logs Específicos para Debug**

```
📱 DEBUG - Informações da requisição:
   iOS nativo detectado: false
   Expo detectado: true ✅
   React Native detectado: true ✅
   Darwin detectado: true ✅
   Cliente mobile detectado: true ✅

⚙️ DEBUG - Timeouts configurados para cliente mobile: true
   Part timeout: 10000ms
   Buffer timeout: 15000ms

📱 DEBUG - Cliente mobile detectado: processamento otimizado para image_0.jpg
💾 DEBUG - Iniciando leitura buffer otimizada para mobile...
✅ DEBUG - Buffer mobile lido em 234ms, tamanho: 161180 bytes
```

### 5. **Reuso de Buffer**

Na ETAPA 3, para clientes mobile:

```typescript
if (isMobileClient && file._buffer) {
  console.log(`📱 DEBUG - Usando buffer pré-carregado para cliente mobile`);
  buffer = file._buffer; // Reutiliza buffer já carregado
} else {
  buffer = await file.toBuffer(); // Carrega normalmente para outros
}
```

## 🎯 **Resultado Esperado**

### **Antes:**
```
📁 Arquivo encontrado: image_0.jpg
❌ Error: aborted (ECONNRESET)
```

### **Depois:**
```
📁 Arquivo encontrado: image_0.jpg
📱 DEBUG - Cliente mobile detectado: processamento otimizado para image_0.jpg
💾 DEBUG - Iniciando leitura buffer otimizada para mobile...
✅ DEBUG - Buffer mobile lido em 234ms, tamanho: 161180 bytes
✅ DEBUG - ETAPA 1/6 COMPLETA: Multipart processado
🔄 DEBUG - ETAPA 2/6: Validando dados...
```

## 📋 **Para Testar**

1. **Execute novamente** no Expo/React Native
2. **Monitore os logs** para confirmar:
   - `Cliente mobile detectado: true`
   - `Buffer mobile lido em Xms`
   - `ETAPA 1/6 COMPLETA`

3. **Se ainda der erro**, os logs mostrarão **exatamente onde**:
   - `📱 DEBUG - Timeout específico de cliente mobile detectado`
   - `🔌 DEBUG - Conexão abortada pelo cliente (ECONNRESET)`
   - `📦 DEBUG - Timeout geral do multipart detectado`

## 🔧 **Próximos Passos se Ainda Falhar**

Se ainda houver timeout, considerar:
1. **Reduzir ainda mais os timeouts** (5s, 10s)
2. **Streaming em chunks menores**
3. **Endpoint separado** só para upload
4. **WebSocket** para uploads grandes

Mas com essas correções específicas para Expo, o problema de ECONNRESET deve estar resolvido! ✨ 