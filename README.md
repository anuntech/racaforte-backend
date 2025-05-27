
# 🚀 Raca Forte Backend

Backend da aplicação **Raca Forte**, construído com **Fastify**, **TypeScript**, **Prisma ORM** e **MySQL**, projetado para alta performance, escalabilidade e produtividade no desenvolvimento.

---

## 📦 Tecnologias Utilizadas

- ⚡️ [Fastify](https://fastify.dev/) — Framework Node.js rápido e de baixo overhead
- 🔥 [TypeScript](https://www.typescriptlang.org/) — Tipagem estática
- 💾 [Prisma ORM](https://www.prisma.io/) — ORM de próxima geração para Node.js e TypeScript
- 🐬 [MySQL 8.0](https://www.mysql.com/) — Banco de dados relacional
- 🗂️ [Zod](https://zod.dev/) — Validação de schemas tipada
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
DATABASE_URL=
OPENAI_API_KEY=
HETZNER_ACCESS_KEY=
HETZNER_SECRET_KEY=
MERCADOLIVRE_API_KEY=
REMOVEBG_API_KEY=
```

---

## 🐳 Rodando o MySQL com Docker

### 📄 `docker-compose.yml`
```bash
docker-compose up -d
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

## 🔗 Configuração do Prisma ORM

### Rodar migração do DB:
```bash
npx prisma migrate dev --name init
```

### Abrir Prisma Studio (GUI):
```bash
npx prisma studio
```

### Fazer introspecção (se o DB já existir):
```bash
npx prisma db pull
```

### Gerar o Prisma Client:
```bash
npx prisma generate
```

---

## 🚀 Scripts de Desenvolvimento

| Comando                | Descrição                                 |
|------------------------|-------------------------------------------|
| `npm run dev`          | Rodar com **TSX + Hot Reload**           |
| `npm run build`        | Compilar TypeScript para `dist/`         |
| `npm run start`        | Rodar o código compilado em JavaScript   |
| `npm run lint`         | Verificar problemas com **Biome**        |
| `npm run lint:fix`     | Corrigir automaticamente os problemas    |
| `npm run format`       | Formatar o código com **Biome**          |
| `npx prisma studio`    | Abrir o Prisma Studio (GUI)              |
| `npx prisma migrate dev` | Criar e aplicar migrações no DB        |

---

## 🌐 Verificar API (Health Check)

```http
GET /health
```

### ✅ Resposta esperada:
```json
{
  "message": "Ok"
}
```

---

## 🏗️ Estrutura do Projeto

```
/src
  ├── lib/          # Serviços externos (Prisma, S3, etc.)
  ├── routes/       # Rotas da API
  ├── controllers/  # Controllers
  ├── services/     # Serviços
  ├── schemas/      # Schemas de validação (Zod)
  ├── server.ts     # Ponto de entrada da aplicação
/prisma
  ├── schema.prisma # Schema do Prisma
.docker-compose.yml
.env
```

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

## 💡 Recursos Úteis

- 🌐 [Documentação do Fastify](https://www.fastify.dev/docs/latest/)
- 📚 [Documentação do Prisma](https://www.prisma.io/docs/)
- 🐳 [Documentação do Docker](https://docs.docker.com/)
- 🔧 [Documentação do Biome](https://biomejs.dev/)
- ☁️ [Documentação AWS S3](https://docs.aws.amazon.com/AmazonS3/)