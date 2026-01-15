require('dotenv').config();
const http = require('http');
const url = require('url');
const WebSocket = require('ws');
const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const Y = require('yjs');
const { Client } = require('pg'); // 确保安装了 pg: npm install pg

const PORT = process.env.PORT || 1234;
const REDIS_URL = process.env.REDIS_URL; 
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const DATABASE_URL = process.env.DATABASE_URL;

console.log('[Startup] Config check:');
console.log(`- PORT: ${PORT}`);
console.log(`- REDIS_URL: ${REDIS_URL ? 'Set' : 'Not Set'}`);
console.log(`- JWT_SECRET: ${JWT_SECRET.substring(0, 3)}*** (Ensure this matches server-app)`);
console.log(`- DATABASE_URL: ${DATABASE_URL ? 'Set' : 'Not Set'}`);

// --- Redis 初始化 ---
let redis;
if (REDIS_URL) {
  console.log(`[Startup] Connecting to Redis at ${REDIS_URL}...`);
  redis = new Redis(REDIS_URL, {
    retryStrategy: (times) => Math.min(times * 100, 3000),
    maxRetriesPerRequest: null
  });
  redis.on('connect', () => console.log('[Redis] Connected successfully'));
  redis.on('error', err => console.error('[Redis] Error:', err.message));
} else {
  // 内存兜底
  const store = new Map();
  redis = {
    getBuffer: async (key) => store.get(key),
    set: async (key, val) => store.set(key, val),
  };
}

// --- Postgres 初始化 (用于权限校验) ---
let dbClient = null;
if (DATABASE_URL) {
  dbClient = new Client({ connectionString: DATABASE_URL });
  dbClient.connect()
    .then(() => console.log('[DB] Connected successfully (for permission checks)'))
    .catch(e => console.error('[DB] Failed to connect', e));
} else {
  console.warn('[DB] ⚠️ DATABASE_URL not set. Permission checks will be SKIPPED!');
}

// --- 持久化配置 ---
setPersistence({
  bindState: async (docName, ydoc) => {
    const key = `ydoc:${docName}`;
    try {
      const data = await redis.getBuffer(key);
      if (data) {
        Y.applyUpdate(ydoc, data);
      }
    } catch (err) {
      console.error(`[BindState] Error loading "${docName}":`, err.message);
    }

    ydoc.on('update', async (update, origin) => {
      try {
        const fullState = Y.encodeStateAsUpdate(ydoc);
        await redis.set(key, Buffer.from(fullState));
      } catch (err) {
        console.error(`[Update] Error saving "${docName}":`, err.message);
      }
    });
  },
  writeState: async (docName, ydoc) => {
    try {
      const key = `ydoc:${docName}`;
      const fullState = Y.encodeStateAsUpdate(ydoc);
      await redis.set(key, Buffer.from(fullState));
    } catch (err) {
      console.error(`[WriteState] Error saving "${docName}":`, err.message);
    }
  }
});

// --- Server ---
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('y-websocket server running');
});

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', async (request, socket, head) => {
  // 辅助函数：拒绝连接并打印日志
  const reject = (code, message) => {
    console.log(`[Auth] ❌ Rejected: ${message}`);
    socket.write(`HTTP/1.1 ${code} ${message}\r\n\r\n`);
    socket.destroy();
  };

  try {
    const parsed = url.parse(request.url, true);
    // Nginx 转发过来的 URL 可能是 "/doc-id?token=..."
    // 我们取路径的第一部分作为 docId
    const docId = parsed.pathname.split('/')[1] || parsed.pathname.slice(1);
    const token = parsed.query.token;
    
    console.log(`[Upgrade] Request for Doc: "${docId}"`);

    // 1. JWT 基础校验
    if (!token) {
      return reject(401, 'Unauthorized (Missing Token)');
    }

    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId;
      console.log(`[Auth] Token verified. User: ${decoded.username} (${userId})`);
    } catch (e) {
      return reject(401, `Unauthorized (Invalid Token: ${e.message})`);
    }

    // 2. 数据库权限校验 (Room Check)
    if (dbClient) {
      try {
        // 检查用户是否是 Owner 或 Collaborator
        const query = `
          SELECT 1 FROM "Document" d
          LEFT JOIN "DocumentCollaborator" c ON d.id = c."documentId"
          WHERE d.id = $1 
            AND d."isDeleted" = false
            AND (d."createdById" = $2 OR c."userId" = $2)
          LIMIT 1;
        `;
        const res = await dbClient.query(query, [docId, userId]);
        
        if (res.rowCount === 0) {
          // 再次检查文档是否存在，区分 404 和 403
          const docCheck = await dbClient.query('SELECT 1 FROM "Document" WHERE id = $1', [docId]);
          if (docCheck.rowCount === 0) {
             return reject(404, 'Document Not Found');
          } else {
             return reject(403, 'Forbidden (No Access)');
          }
        }
        console.log(`[Auth] ✅ Permission granted for user ${userId} on doc ${docId}`);
      } catch (dbErr) {
        console.error('[DB] Auth check error', dbErr);
        // 数据库错误时，为了安全通常拒绝，或者根据策略放行
        return reject(500, 'Internal Server Error');
      }
    } else {
      console.warn('[Auth] Skipping DB permission check (DB not connected)');
    }

    // 3. 校验通过，升级连接
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, docId); // 传递解析好的 docId
    });

  } catch (err) {
    console.error('[Upgrade] Critical Error:', err);
    socket.destroy();
  }
});

wss.on('connection', (ws, req, docId) => {
  // 如果 handleUpgrade 没传 docId (比如直接连接)，尝试自己解析
  if (!docId) {
    const urlParts = req.url.split('?');
    docId = urlParts[0].slice(1);
  }
  if (!docId) docId = 'default';

  console.log(`[Connection] Client connected to room: "${docId}"`);

  setupWSConnection(ws, req, { 
    docName: docId, 
    gc: true 
  });
});

server.listen(PORT, () => {
  console.log(`[Startup] y-websocket listening on port ${PORT}`);
});