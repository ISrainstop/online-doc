const http = require('http');
const url = require('url');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 1234;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('y-websocket server running');
});

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const { query } = url.parse(request.url, true);
    const token = query && query.token;
    // Allow skipping auth in local development by setting SKIP_WS_AUTH=true
    const skipAuth = process.env.SKIP_WS_AUTH === 'true' || process.env.NODE_ENV !== 'production';

    if (!token && !skipAuth) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    if (token && !skipAuth) {
      try {
        jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
      } catch (e) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } catch (err) {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  // setupWSConnection handles Yjs websocket protocol
  setupWSConnection(ws, req, { gc: true });
});

server.listen(PORT, () => {
  console.log(`y-websocket server listening on port ${PORT}`);
});
