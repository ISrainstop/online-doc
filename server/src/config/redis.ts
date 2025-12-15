import Redis from 'ioredis';

const url = process.env.REDIS_URL || '';

// 如果有 REDIS_URL，优先用真实 Redis；否则使用内存存储作为降级。
let redisClient: {
	get: (key: string) => Promise<string | Buffer | null>;
	set: (key: string, value: string) => Promise<string>;
	setBuffer?: (key: string, buf: Buffer) => Promise<string>;
	incr: (key: string) => Promise<number>;
	quit: () => Promise<void>;
};

if (url) {
	const client = new Redis(url);
	client.on('error', (err: any) => {
		console.warn('[redis] error:', err && err.message ? err.message : err);
	});
	redisClient = client as any;
} else {
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
		async quit() {
			return;
		}
	};
}

export { redisClient };
export default redisClient;

