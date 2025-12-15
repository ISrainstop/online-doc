const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'dev_secret';
const token = jwt.sign({ userId: 'test-user', username: 'tester' }, secret, { expiresIn: '1h' });

const url = `ws://localhost:1234?token=${token}`;
console.log('Connecting to', url);

const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('Connected to y-websocket server');
  console.log('Waiting for messages (will keep connection open)');
});

ws.on('message', (data, isBinary) => {
  try {
    if (isBinary || Buffer.isBuffer(data)) {
      const buf = Buffer.from(data);
      console.log('Received binary message; length =', buf.length);
      console.log('Hex prefix (first 32 bytes):', buf.slice(0, 32).toString('hex'));
    } else {
      console.log('Received text message:', data.toString());
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
});

ws.on('error', (err) => {
  console.error('Connection error:', err && err.message ? err.message : err);
});

ws.on('close', (code, reason) => {
  console.log('Connection closed', code, reason && reason.toString());
  // 不自动退出，便于调试；如果你想退出，取消注释下一行
  // process.exit(0);
});

// 保持进程运行以便观察后续消息
process.stdin.resume();
