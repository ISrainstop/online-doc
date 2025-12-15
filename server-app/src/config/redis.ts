import Redis from 'ioredis';

const url = process.env.REDIS_URL || '';

// Create either a real Redis client or an in-memory stub depending on REDIS_URL.
let redisClient: any;

if (url) {
	const client = new Redis(url);
	client.on('error', (err: any) => {
		console.warn('[redis] error:', err && err.message ? err.message : err);
	});
	redisClient = client;
} else {
	// Simple in-memory store for local development to avoid connection errors.
	const store = new Map<string, string | Buffer>();
	const counters = new Map<string, number>();

	redisClient = {
		async get(key: string) {
			const v = store.get(key);
			if (v === undefined) return null;
			return Buffer.isBuffer(v) ? (v as Buffer) : String(v);
		},
		async set(key: string, value: string) {
			store.set(key, value);
			return 'OK';
		},
		// Compatibility helper used by yjs service
		async setBuffer(key: string, buf: Buffer) {
			store.set(key, Buffer.from(buf));
			return 'OK';
		},
		async incr(key: string) {
			const v = counters.get(key) || 0;
			const nv = v + 1;
			counters.set(key, nv);
			return nv;
		},
		// minimal quit to satisfy graceful shutdown
		async quit() {
			return;
		}
	};
}

export default redisClient;
