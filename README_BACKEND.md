# Backend Node.js (Express + Prisma + Mercado Pago)

Este projeto agora tem um backend em **Node.js** dentro da pasta `server/` com:

- CRUD de **produtos / categorias / subcategorias**
- **Upload de imagem** (salva em `server/uploads/`)
- **Pedidos** salvos no banco
- Checkout via **Mercado Pago** (cria preferência e recebe webhook)
- **Login admin** via JWT

## 1) Instalar

### Frontend

```bash
cd do-carmo-modashop-main
npm install
```

### Backend

```bash
cd server
npm install
cp .env.example .env
```

## 2) Banco de dados

Recomendado em produção: **MySQL** (perfeito para Hostinger Business).

1) Crie um banco MySQL no hPanel e ajuste o `DATABASE_URL` no `server/.env`.
   Exemplo:
   `mysql://USUARIO:SENHA@HOST:3306/NOME_DO_BANCO`
2) Rode as migrations e gere o client:

```bash
cd server
npx prisma generate
npx prisma db push
```

> Dica: se você estiver no seu PC e quiser migrations, pode usar `npx prisma migrate dev --name init`.


## 3) Criar admin + dados iniciais

No `server/.env` você pode definir:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Depois rode:

```bash
cd server
npm run seed
```

Isso cria o admin e popula categorias/produtos de exemplo.

## 4) Mercado Pago

No `server/.env`, coloque seu **Access Token**:

- `MP_ACCESS_TOKEN=...`

E ajuste:

- `PUBLIC_BASE_URL` (URL pública do backend — se você for servir o frontend pelo backend, pode ser a mesma)

## 5) Rodar

### Dev (front + back ao mesmo tempo)

Na raiz:

```bash
npm run dev
```

- Front: http://localhost:8080
- Back: http://localhost:4000

## 6) Painel admin

Acesse:

- http://localhost:8080/admin/login

Use o email/senha do admin criado no seed.

---

### Endpoints principais

- `GET /api/products`
- `GET /api/categories`
- `POST /api/checkout`
- `POST /api/auth/login`
- `GET /api/admin/products` (JWT)
- `POST /api/admin/upload` (JWT)
