import Redis from 'ioredis';

const url = process.env.REDIS_URL || '';

// 定义内存存储（用于无 Redis 时降级）
class InMemoryRedis {
  private store = new Map<string, any>();
  private counters = new Map<string, number>();

  constructor() {
    console.log('[redis-config] Using In-Memory Store (Redis disabled or not configured)');
  }

  async get(key: string) {
    return this.store.get(key) || null;
  }

  // 模拟 ioredis 的 getBuffer
  async getBuffer(key: string) {
    const val = this.store.get(key);
    return val ? Buffer.from(val) : null;
  }

  async set(key: string, value: string | Buffer) {
    this.store.set(key, value);
    return 'OK';
  }

  // 兼容层：手动提供 setBuffer
  async setBuffer(key: string, buf: Buffer) {
    this.store.set(key, buf);
    return 'OK';
  }

  async incr(key: string) {
    const v = (this.counters.get(key) || 0) + 1;
    this.counters.set(key, v);
    return v;
  }

  async quit() { return 'OK'; }
  on(event: string, callback: any) { return this; }
}

let redisClient: any;

if (url) {
  console.log(`[redis-config] Connecting to Redis at ${url}...`);
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 100, 2000)
  });

  client.on('error', (err: any) => {
    if (err.code !== 'ECONNREFUSED' && err.code !== 'ECONNRESET') {
       console.warn('[redis-client] error:', err.message);
    }
  });

  client.on('connect', () => {
    console.log('[redis-config] Redis connected successfully');
  });

  // 🔥【关键修复】给真实 Redis 实例挂载 setBuffer 方法
  // 因为 ioredis 原生没有 setBuffer，但 set 支持 Buffer
  (client as any).setBuffer = (key: string, value: Buffer) => {
    return client.set(key, value);
  };

  redisClient = client;
} else {
  redisClient = new InMemoryRedis();
}

export { redisClient };
export default redisClient;