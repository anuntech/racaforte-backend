# 🚀 Raca Forte Backend

Backend da aplicação **Raca Forte**, construído com **Fastify**, **TypeScript**, **Prisma ORM** e **MySQL**, projetado para alta performance, escalabilidade e produtividade no desenvolvimento.

---

## 📦 Tecnologias Utilizadas

- ⚡️ [Fastify](https://fastify.dev/) — Framework Node.js rápido e de baixo overhead
- 🔥 [TypeScript](https://www.typescriptlang.org/) — Tipagem estática
- 💾 [Prisma ORM](https://www.prisma.io/) — ORM de próxima geração para Node.js e TypeScript
- 🐬 [MySQL 8.0](https://www.mysql.com/) — Banco de dados relacional
- 🗂️ [Zod](https://zod.dev/) — Validação de schemas tipada
- 🤖 [Google Gemini AI](https://ai.google.dev/) — Identificação de peças automotivas e sugestão de preços por IA
- ☁️ [AWS SDK S3](https://docs.aws.amazon.com/sdk-for-javascript/) — Armazenamento de arquivos
- 🐳 Docker — Banco em container isolado
- 🚀 [Biome](https://biomejs.dev/) — Formatter + Linter + Organizador de imports (feito em Rust)

---

## 🚀 Primeiros Passos

### 🔥 Instalar dependências:
```bash
npm install
```

### 🔧 Variáveis de ambiente:
Crie um arquivo `.env` na raiz do projeto:

```env
# Database
DATABASE_URL="mysql://racaforte_user:racaforte_password@localhost:3306/racaforte_db"

# Google Gemini AI
GEMINI_API_KEY=sua-chave-do-gemini

# Server Configuration
HOST=0.0.0.0
PORT=3333
NODE_ENV=development

# Outras APIs
HETZNER_ACCESS_KEY=
HETZNER_SECRET_KEY=
REMOVEBG_API_KEY=
```

### 📱 Acessando do Celular:
Para tornar o backend acessível do seu celular:

1. **HOST**: Defina como `0.0.0.0` (permite conexões externas)
2. **PORT**: Defina a porta desejada (padrão: 3333)
3. **IP do seu computador**: Descubra o IP local da sua máquina:
   ```bash
   # Linux/Mac:
   ip route get 1 | awk '{print $7}' | head -1
   # ou
   hostname -I | awk '{print $1}'
   
   # Windows:
   ipconfig | findstr IPv4
   ```
4. **Acesse do celular**: `http://[SEU_IP]:3333`

**Exemplo**: Se seu IP for `192.168.1.100`, acesse `http://192.168.1.100:3333`

---

## 🐳 Rodando o MySQL com Docker

### 📄 Iniciar banco de dados:
```bash
# Método 1: Docker Compose manual
docker-compose up -d

# Método 2: Script automatizado
npm run db:up
```

Isso irá subir um container MySQL 8.0 com:

- Porta: `3306`
- Database: `racaforte_db`
- Usuário: `racaforte_user`
- Senha: `racaforte_password`
- Volume: `racaforte_mysql_data` para persistência dos dados

### ✅ Testar conexão:
```bash
docker exec -it raca_forte_db_container mysql -u racaforte_user -p
```

---

## 🗄️ Schema do Banco de Dados

### 📊 Modelo Principal:

#### **Part**
- `id`: UUID único
- `name`: Nome da peça
- `brand`: Marca
- `year`: Ano
- `condition`: Condição (BOA, MEDIA, RUIM)
- `stock_address`: Endereço no estoque
- `dimensions`: JSON com dimensões
- `weight`: Peso (opcional)
- `compatibility`: JSON com compatibilidade
- `min_price`, `suggested_price`, `max_price`: Preços
- `part_description`: Descrição (opcional)
- `images`: JSON com URLs das imagens
- `created_at`: Data de criação

---

## 🔗 Configuração do Prisma ORM

### 🚀 Setup completo (recomendado):
```bash
npm run db:setup
```
*Inicia banco + migração + geração do cliente + seeding*

### Scripts individuais:

| Comando | Descrição |
|---------|-----------|
| `npm run db:up` | Iniciar apenas o banco MySQL |
| `npm run db:down` | Parar o banco |
| `npm run db:logs` | Ver logs do banco |
| `npm run db:reset` | Reset completo + seeding |
| `npm run prisma:migrate` | Aplicar migrações |
| `npm run prisma:generate` | Gerar cliente Prisma |
| `npm run prisma:studio` | Abrir Prisma Studio (GUI) |
| `npm run prisma:seed` | Popular banco com dados de teste |

---

## 🚀 Scripts de Desenvolvimento

### 🎯 Scripts Principais:

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Rodar apenas o servidor |
| `npm run dev:full` | **Setup completo + servidor** |
| `npm run build` | Compilar TypeScript |
| `npm run start` | Rodar versão de produção |

### 🗄️ Scripts de Banco:

| Comando | Descrição |
|---------|-----------|
| `npm run db:up` | Iniciar banco MySQL |
| `npm run db:down` | Parar banco |
| `npm run db:logs` | Ver logs do banco |
| `npm run db:setup` | Setup completo (banco + migração + seed) |
| `npm run db:reset` | Reset + seeding |

### 🔧 Scripts Prisma:

| Comando | Descrição |
|---------|-----------|
| `npm run prisma:migrate` | Aplicar migrações |
| `npm run prisma:generate` | Gerar cliente |
| `npm run prisma:studio` | Interface web do banco |
| `npm run prisma:seed` | Popular com dados de teste |

### 🎨 Scripts de Qualidade:

| Comando | Descrição |
|---------|-----------|
| `npm run lint` | Verificar problemas |
| `npm run lint:fix` | Corrigir automaticamente |
| `npm run format` | Formatar código |

---

## 📸 API Endpoints

### 🏥 Health Check
```http
GET /health
```

**Resposta:**
```json
{
  "message": "Ok"
}
```



### 🎨 Remoção de Fundo de Imagens

```http
POST /images/remove-background
Content-Type: multipart/form-data
```

**Especificações:**
- ✅ Máximo: 10 imagens por requisição
- ✅ Formatos: JPEG, JPG, PNG, WEBP
- ✅ Tamanho máximo: 50MB por arquivo
- ✅ API: Remove.bg
- ✅ Fallback para imagem original em caso de erro

**Exemplo com cURL:**
```bash
curl -X POST http://localhost:3333/images/remove-background \
  -F "imagem1=@./para-choque-frente.jpg" \
  -F "imagem2=@./para-choque-lado.png"
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "data": {
    "processed_images": ["data:image/png;base64,..."],
    "processing_info": {
      "total_images": 2,
      "successful_removals": 2,
      "failed_removals": 0,
      "processing_time_ms": 3500
    }
  }
}
```

### 🧠 Processamento Completo de Peças com IA

```http
POST /part/process
Content-Type: application/json
```

**Especificações:**
- ✅ Apenas dados textuais (SEM imagens para máxima performance)
- ✅ Gera: título, descrição, dimensões, peso, compatibilidade e **preços**
- ✅ IA: Google Gemini 2.5 Flash especializada em precificação
- ✅ Super rápido (baseado apenas em nome, descrição e veículo)

**Campos obrigatórios:**
```json
{
  "name": "Nome da peça",
  "description": "Descrição da peça", 
  "vehicle_internal_id": "ID do veículo"
}
```

**Exemplo com cURL:**
```bash
curl -X POST http://localhost:3333/part/process \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alternador",
    "description": "Alternador 70A 12V em bom estado",
    "vehicle_internal_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "data": {
    "ad_title": "Alternador Toyota Corolla 2020 - Excelente Estado",
    "ad_description": "Alternador original em perfeito estado...",
    "dimensions": {
      "width": "15cm",
      "height": "8cm", 
      "depth": "25cm",
      "unit": "cm"
    },
    "weight": 12,
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

**Nota:** Este endpoint foca apenas em dados. Para processamento de imagens, use `/images/remove-background` separadamente.

**Erros Comuns:**
```json
{
  "success": false,
  "error": {
    "type": "too_many_files",
    "message": "Máximo de 10 imagens permitidas."
  }
}
```

---

## 🌱 Dados de Teste (Seeding)

O projeto inclui um script de seeding com 5 peças de exemplo:

1. **Para-choque Toyota** (Condição: BOA)
2. **Farol Honda** (Condição: MÉDIA)  
3. **Espelho Volkswagen** (Condição: RUIM)
4. **Capô Ford** (Condição: BOA)
5. **Porta Hyundai** (Condição: MÉDIA)

```bash
# Popular banco com dados de teste
npm run prisma:seed

# Reset completo + seeding
npm run db:reset
```

---

## 🏗️ Estrutura do Projeto

```
/src
  ├── lib/           # Serviços externos (Prisma, S3, etc.)
  ├── routes/        # Rotas da API
  ├── controllers/   # Controllers
  ├── services/      # Serviços (Gemini AI, Storage, Background removal)
  ├── prompts/       # Templates de prompts para IA
  ├── schemas/       # Schemas de validação (Zod)
  ├── server.ts      # Ponto de entrada da aplicação
/prisma
  ├── schema.prisma  # Schema do Prisma
  ├── seed.ts        # Script de seeding
  ├── migrations/    # Histórico de migrações
.docker-compose.yml  # Configuração MySQL
.env                 # Variáveis de ambiente
```

---

## 🚀 Como Executar o Projeto

### 🎯 Modo Rápido (Recomendado):
```bash
# 1. Clone e instale
git clone <repo>
cd racaforte-backend
npm install

# 2. Configure .env (veja seção de variáveis)

# 3. Execute tudo de uma vez
npm run dev:full
```

### 🔧 Modo Manual:
```bash
# 1. Iniciar banco
npm run db:up

# 2. Aplicar migrações
npm run prisma:migrate

# 3. Popular com dados de teste
npm run prisma:seed

# 4. Iniciar servidor
npm run dev
```

### 🌐 Endpoints disponíveis:
- **Health Check**: http://localhost:3333/health
- **Processar Peças**: http://localhost:3333/part/process
- **Remover Fundo**: http://localhost:3333/images/remove-background
- **Prisma Studio**: http://localhost:5555 (com `npm run prisma:studio`)

---

## 🔥 Qualidade de Código com Biome

- 🧠 Lint, Format e Organizador de Imports com Biome.
- Rodar:
```bash
npm run lint
npm run lint:fix
npm run format
```

👉 Instale a extensão **[Biome VSCode Extension](https://marketplace.visualstudio.com/items?itemName=Biomejs.biome)** para linting automático ao salvar arquivos.

---

## 🐛 Debug e Logs

Os logs estão em português e são bem detalhados:

```
✅ Chave Gemini encontrada, inicializando...
📁 Processando 3 arquivos:
  Arquivo 1: para-choque.jpg (image/jpeg)
📏 Arquivo para-choque.jpg: 245760 bytes
🔄 Convertido para base64 (327680 caracteres)
🚀 Enviando para o serviço de IA...
Iniciando análise de 3 imagens
📡 Enviando requisição para Gemini...
📥 Resposta Gemini recebida
✅ Identificação bem-sucedida
```

---

## 💡 Recursos Úteis

- 🌐 [Documentação do Fastify](https://www.fastify.dev/docs/latest/)
- 📚 [Documentação do Prisma](https://www.prisma.io/docs/)
- 🤖 [Google AI Studio](https://aistudio.google.com/)
- 🐳 [Documentação do Docker](https://docs.docker.com/)
- 🔧 [Documentação do Biome](https://biomejs.dev/)
- ☁️ [Documentação AWS S3](https://docs.aws.amazon.com/AmazonS3/)