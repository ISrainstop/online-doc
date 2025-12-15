const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const Y = require('yjs');

const secret = process.env.JWT_SECRET || 'dev_secret';
const token = jwt.sign({ userId: 'test-user', username: 'tester' }, secret, { expiresIn: '1h' });
const url = `ws://localhost:1234?token=${token}`;

console.log('Connecting to', url);

const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('Connected. Waiting for messages...');
});

ws.on('message', (data, isBinary) => {
  const buf = Buffer.from(data);
  console.log('---- MESSAGE RECEIVED ----');
  console.log('Length:', buf.length);
  console.log('Hex (full):', buf.toString('hex'));
  console.log('Hex (first 64 chars):', buf.slice(0, 32).toString('hex'));
  console.log('Base64:', buf.toString('base64'));

  // 尝试当作 Yjs update 解码并应用
  try {
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, buf);
    const ytext = ydoc.getText('content').toString();
    console.log('Applied as Y update. content:', JSON.stringify(ytext));
  } catch (err) {
    console.log('Y.applyUpdate failed:', err && err.message ? err.message : err);
  }

  // 还可以打印前几个字节的类型判断
  console.log('First bytes (decimal):', Array.from(buf.slice(0, Math.min(8, buf.length))));
});

ws.on('error', (err) => {
  console.error('WS error:', err && err.message ? err.message : err);
});

ws.on('close', (code, reason) => {
  console.log('WS closed', code, reason && reason.toString());
  process.exit(0);
});

process.stdin.resume();
