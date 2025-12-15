# online-doc-system - y-websocket 支持 (示例)

本改动在原有架构基础上加入了一个 `y-websocket` 同步服务，适配 Tiptap/Yjs 的 `WebsocketProvider`。主要文件：

- `server/y-websocket-server.js` - 基于 `y-websocket` 的 WebSocket 服务，支持使用 `?token=JWT` 做简单鉴权。
- `server/Dockerfile.y-websocket` - y-websocket 服务的 Dockerfile。
- `server/package.json` - y-websocket 服务依赖（`y-websocket`, `ws`, `jsonwebtoken`）。
- `docker-compose.yml` - 在根目录加入了 `y-websocket` 服务，端口 `1234`。
- `nginx.conf` - 增加了 `map $http_upgrade $connection_upgrade` 并代理 `/y-websocket/` 到 `y-websocket:1234`。
- `server/src/services/yjs.service.ts` - 更新为使用 Redis 二进制（或 base64 回退）持久化 Yjs 状态，并维护 `ydoc_version:${docId}` 自增版本。

快速启动（开发）示例：

1) 在根目录启动 Redis/Postgres（如果使用 docker-compose）：

```powershell
# 在 PowerShell 中
docker-compose up -d postgres redis
```

2) 在 `server` 目录安装依赖并启动 y-websocket 服务（仅示例）：

```powershell
cd server
npm install
npm run start
```

3) 前端连接示例（Tiptap 的 WebsocketProvider）：

在前端 `REACT_APP_WS_URL` 指向 `ws://localhost:1234`，连接时在 URL 加上 `?token=<JWT>`，例如：

```
const provider = new WebsocketProvider(process.env.REACT_APP_WS_URL || 'ws://localhost:1234', documentId, ydoc, { params: { token } });
```

注意：这是一个基础可运行示例。为生产环境请：
- 使用安全的 JWT secret 注入机制（不要把密钥写入代码或版本库）。
- 在 nginx 中配置正确的 TLS 证书与域名，并使用 `wss://`。
- 在 y-websocket 中根据需求实现更为严格的授权、持久化与监控。
