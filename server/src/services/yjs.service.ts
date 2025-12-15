import * as Y from 'yjs';
import { redisClient } from '../config/redis';
import fs from 'fs';
import path from 'path';

// 注意：如果没有可用的 Redis（例如本地开发环境），
// 本服务会回退到基于文件的持久化（存放在项目的 `data/ydoc-*` 目录）。

export class YjsService {
    private documents = new Map<string, Y.Doc>();
    private storageDir: string;

    constructor() {
        // 把本地数据放在项目根的 data 目录
        this.storageDir = path.resolve(process.cwd(), 'data');
        try {
            fs.mkdirSync(this.storageDir, { recursive: true });
        } catch (e) {
            // ignore
        }
    }

    // 初始化文档并持久化快照
    async initDocument(docId: string, initialContent: any): Promise<void> {
        const ydoc = new Y.Doc();

        const ytext = ydoc.getText('content');

        if (initialContent) {
            // 如果初始是 ProseMirror JSON，尽量提取文本；这里简单处理
            if (typeof initialContent === 'string') {
                ytext.insert(0, initialContent);
            } else if (initialContent.text) {
                ytext.insert(0, initialContent.text);
            }
        }

        this.documents.set(docId, ydoc);

        // 保存为二进制（Buffer -> base64 也可，但直接存 Buffer 更好）
        const update = Y.encodeStateAsUpdate(ydoc);
        await this.saveUpdateToStore(docId, update);
        await this.setVersion(docId, 1);
    }

    // 加载文档（从 Redis），若不存在则新建
    private async loadDocumentFromRedis(docId: string): Promise<Y.Doc> {
        const cached = await this.loadUpdateFromStore(docId);
        const ydoc = new Y.Doc();

        if (cached) {
            let updateBuffer: Buffer | null = null;
            if (typeof cached === 'string') {
                updateBuffer = Buffer.from(cached, 'base64');
            } else if (Buffer.isBuffer(cached)) {
                updateBuffer = cached as Buffer;
            }

            if (updateBuffer) {
                try {
                    Y.applyUpdate(ydoc, updateBuffer);
                } catch (err) {
                    console.error('Failed to apply Yjs update from store for', docId, err);
                }
            }
        }

        this.documents.set(docId, ydoc);
        return ydoc;
    }

    // 获取文档状态（用于发送给客户端）
    async getDocumentState(docId: string): Promise<any> {
        let ydoc = this.documents.get(docId);
        if (!ydoc) {
            ydoc = await this.loadDocumentFromRedis(docId);
        }

        const ytext = ydoc.getText('content');
        const text = ytext.toString();

        return {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: text.split('').map((char) => ({ type: 'text', text: char }))
                }
            ]
        };
    }

    // 应用操作（应用到 Y.Doc 并返回新的 serverVersion）
    async applyOperations(
        docId: string,
        operations: any[],
        userId: string,
        clientVersion: number
    ): Promise<{
        documentState: any;
        serverVersion: number;
        transformedOperations: any[];
    }> {
        let ydoc = this.documents.get(docId);
        if (!ydoc) {
            ydoc = await this.loadDocumentFromRedis(docId);
        }

        // 在单独的 trans 中应用所有操作，确保原子性
        ydoc.transact(() => {
            for (const op of operations) {
                this.applyOperationToYDoc(ydoc!, op);
            }
        });

        // 生成更新并保存到可用存储（Redis 或本地文件）
        const update = Y.encodeStateAsUpdate(ydoc);
        await this.saveUpdateToStore(docId, update);
        const serverVersion = await this.incrVersion(docId);

        const ytext = ydoc.getText('content');
        const documentState = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: ytext.toString().split('').map((char) => ({ type: 'text', text: char }))
                }
            ]
        };

        return {
            documentState,
            serverVersion: Number(serverVersion),
            transformedOperations: []
        };
    }

    // Helper: save update to Redis if available, otherwise to local file
    private async saveUpdateToStore(docId: string, update: Uint8Array | Buffer): Promise<void> {
        const key = `ydoc:${docId}`;
        try {
            if (redisClient && typeof (redisClient as any).set === 'function') {
                // try set as buffer; some clients accept Buffer
                try {
                    await (redisClient as any).set(key, Buffer.from(update));
                    return;
                } catch (e) {
                    // fallback to base64 string
                    await (redisClient as any).set(key, Buffer.from(update).toString('base64'));
                    return;
                }
            }
        } catch (err) {
            console.warn('Redis unavailable, falling back to file store for', docId);
        }

        // file fallback
        const filePath = path.join(this.storageDir, `${docId}.b64`);
        const b64 = Buffer.from(update).toString('base64');
        await fs.promises.writeFile(filePath, b64, 'utf8');
    }

    private async loadUpdateFromStore(docId: string): Promise<Buffer | string | null> {
        const key = `ydoc:${docId}`;
        try {
            if (redisClient && typeof (redisClient as any).get === 'function') {
                const val = await (redisClient as any).get(key);
                if (val == null) return null;
                return val;
            }
        } catch (err) {
            console.warn('Redis unavailable when loading', docId);
        }

        // file fallback
        const filePath = path.join(this.storageDir, `${docId}.b64`);
        try {
            const b64 = await fs.promises.readFile(filePath, 'utf8');
            return b64;
        } catch (e) {
            return null;
        }
    }

    private async setVersion(docId: string, v: number) {
        const key = `ydoc_version:${docId}`;
        try {
            if (redisClient && typeof (redisClient as any).set === 'function') {
                await (redisClient as any).set(key, String(v));
                return;
            }
        } catch (e) {
            // ignore
        }
        // file fallback
        const filePath = path.join(this.storageDir, `${docId}.ver`);
        await fs.promises.writeFile(filePath, String(v), 'utf8');
    }

    private async incrVersion(docId: string): Promise<number> {
        const key = `ydoc_version:${docId}`;
        try {
            if (redisClient && typeof (redisClient as any).incr === 'function') {
                const v = await (redisClient as any).incr(key);
                return Number(v);
            }
        } catch (e) {
            // ignore, fallback to file
        }

        const filePath = path.join(this.storageDir, `${docId}.ver`);
        try {
            const cur = await fs.promises.readFile(filePath, 'utf8');
            const next = Number(cur || '0') + 1;
            await fs.promises.writeFile(filePath, String(next), 'utf8');
            return next;
        } catch (e) {
            // file not exists
            await fs.promises.writeFile(filePath, '1', 'utf8');
            return 1;
        }
    }

    private applyOperationToYDoc(ydoc: Y.Doc, operation: any): void {
        const ytext = ydoc.getText('content');

        switch (operation.op) {
            case 'add':
                ytext.insert(operation.position, operation.text);
                break;
            case 'delete':
                ytext.delete(operation.position, operation.length);
                break;
            case 'update':
                ytext.delete(operation.position, operation.length);
                ytext.insert(operation.position, operation.text);
                break;
            default:
                break;
        }
    }
}
