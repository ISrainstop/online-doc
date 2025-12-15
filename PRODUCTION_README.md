# Production setup (local) - Online Doc System

This directory provides a production-ready skeleton with:
- TypeScript Express backend (`server-app`) using Prisma for PostgreSQL
- Redis for Yjs persistence
- Separate `y-websocket` service (already present under `server`)
- Docker Compose to run Postgres, Redis, server, y-websocket, client and nginx

Quick steps (local/dev):

1. Build and generate Prisma client

```powershell
Set-Location -Path 'D:\aaaaa\server-app'
npm install
npx prisma generate
# If first time, you may need to run migrations or `prisma db push`
npx prisma db push --accept-data-loss
```

2. Start dependencies with Docker Compose

```powershell
Set-Location -Path 'D:\aaaaa'
docker-compose up -d postgres redis
```

3. Start server-app (dev)

```powershell
Set-Location -Path 'D:\aaaaa\server-app'
npm run dev
```

4. Start y-websocket (already exists in `d:\aaaaa\server`):

```powershell
Set-Location -Path 'D:\aaaaa\server'
node y-websocket-server.js
```

5. Start/Build client and nginx per docker-compose (or run client locally)

Notes:
- Ensure `DATABASE_URL` and `REDIS_URL` environment variables are set (see `.env.example`).
- For production, secret management, TLS, monitoring and scaling considerations are required.
