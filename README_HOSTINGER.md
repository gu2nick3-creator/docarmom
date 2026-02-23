# Deploy na Hostinger (Business / Web app Node.js)

Este repositório contém **Frontend (Vite)** na raiz e **Backend (Express + Prisma + Mercado Pago)** em `server/`.

Como o painel da Hostinger às vezes trava o campo **Diretório raiz**, este projeto inclui um `server.js` na raiz.
Ele muda o diretório de execução para `./server` e inicia o backend.

## Configuração recomendada na Hostinger

### App Node.js (Backend)
- Framework: **Express**
- Versão do Node: **20.x** (ou 18.x)
- Diretório raiz: **./**
- Arquivo de entrada: **server.js**
- Gerenciador de pacotes: **npm**

### Variáveis de ambiente (exemplo)
- `DATABASE_URL` = `mysql://USUARIO:SENHA@HOST:3306/NOME_DO_BANCO`
- `JWT_SECRET` = `uma-chave-grande`
- `ADMIN_EMAIL` e `ADMIN_PASSWORD`
- `MP_ACCESS_TOKEN`
- `PUBLIC_BASE_URL` = `https://SEU_DOMINIO`
- `CORS_ORIGIN` = `https://SEU_DOMINIO`

## Banco (Prisma)
Após o deploy, rode (via SSH/Terminal do hPanel):

```bash
cd ~/domains/SEU_DOMINIO/public_html/server
npx prisma db push
npm run seed
```

## Frontend
Você pode:
- Hospedar o frontend como site estático (build Vite) no próprio `public_html`, **ou**
- Manter o frontend dentro do mesmo domínio, desde que o build `dist/` exista na raiz.

