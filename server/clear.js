const Redis = require('ioredis');
const redis = new Redis('redis://localhost:6379'); // 确保端口正确

redis.flushall().then(() => {
    console.log('Redis cleared!');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});