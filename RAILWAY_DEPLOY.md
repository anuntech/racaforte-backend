# 🚀 Deploy no Railway - Guia Completo

## 📋 Variáveis de Ambiente Necessárias

Configure as seguintes variáveis no Railway:

### 🗄️ Banco de Dados
```
DATABASE_URL=mysql://usuario:senha@host:porta/database_name
```
**Dica:** O Railway pode fornecer um banco MySQL automaticamente.

### 🤖 Google Gemini AI
```
GEMINI_API_KEY=sua_chave_gemini_aqui
```
**Como obter:** https://aistudio.google.com/app/apikey

### 🖼️ Remove.bg (Remoção de fundo)
```
REMOVEBG_API_KEY=sua_chave_removebg_aqui
```
**Como obter:** https://www.remove.bg/api

### ☁️ Hetzner S3 (Armazenamento)
```
HETZNER_S3_ENDPOINT=https://seu-endpoint.hetzner.cloud
HETZNER_ACCESS_KEY=sua_access_key_aqui
HETZNER_SECRET_KEY=sua_secret_key_aqui
HETZNER_S3_BUCKET=nome-do-seu-bucket
```

### 🌐 Servidor (opcionais)
```
HOST=0.0.0.0
PORT=3333
```
**Nota:** O Railway define PORT automaticamente.

## 🛠️ Passos para Deploy

### 1. **Conectar Repositório**
- Acesse [Railway](https://railway.app)
- Clique em "Deploy from GitHub repo"
- Selecione seu repositório

### 2. **Configurar Banco de Dados**
- No dashboard do Railway, clique em "+ New"
- Selecione "Database" → "MySQL"
- Copie a `DATABASE_URL` gerada

### 3. **Configurar Variáveis de Ambiente**
- No seu serviço, vá em "Variables"
- Adicione todas as variáveis listadas acima

### 4. **Deploy Automático**
O Railway vai:
- Instalar dependências (`npm install`)
- Executar build (`npm run railway:build`)
- Gerar Prisma client
- Compilar TypeScript
- Executar migrations (`prisma migrate deploy`)
- Iniciar servidor (`npm run railway:start`)

## 🔧 Configurações Importantes

### ✅ Arquivos Criados/Modificados:
- `package.json`: Adicionado `"type": "module"` e scripts Railway
- `railway.json`: Configuração de build e deploy
- `RAILWAY_DEPLOY.md`: Este guia

### ✅ Scripts Customizados:
- `railway:build`: Gera Prisma client + compila TypeScript
- `railway:start`: Executa migrations + inicia servidor

## 🐛 Troubleshooting

### **Erro: "Cannot use import statement"**
✅ **Resolvido:** Adicionado `"type": "module"` no `package.json`

### **Erro: "Prisma Client not found"**
✅ **Resolvido:** Script `railway:build` gera o client automaticamente

### **Erro: "Database connection failed"**
- Verifique se `DATABASE_URL` está configurada corretamente
- Certifique-se de que o banco MySQL está ativo no Railway

### **Erro: "Port already in use"**
✅ **Resolvido:** Railway define `PORT` automaticamente

## 📝 Notas Importantes

1. **Migrations:** Executadas automaticamente no deploy
2. **ES Modules:** Projeto configurado para usar import/export
3. **Build Otimizado:** TypeScript compilado para produção
4. **Health Check:** Servidor responde em `http://0.0.0.0:PORT`

## 🔗 URLs Importantes

- [Railway Dashboard](https://railway.app/dashboard)
- [Google AI Studio](https://aistudio.google.com/app/apikey)
- [Remove.bg API](https://www.remove.bg/api)
- [Hetzner Cloud](https://console.hetzner.cloud/)