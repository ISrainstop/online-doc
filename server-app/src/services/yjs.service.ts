import * as Y from 'yjs';
import redis from '../config/redis';

export class YjsService {
  private documents = new Map<string, Y.Doc>();

  async initDocument(docId: string, initialText?: string): Promise<void> {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('content');
    if (initialText) ytext.insert(0, initialText);
    this.documents.set(docId, ydoc);
    const update = Y.encodeStateAsUpdate(ydoc);
    await this.saveUpdate(docId, update);
    await redis.set(`ydoc_version:${docId}`, '1');
  }

  private async saveUpdate(docId: string, update: Uint8Array) {
    try {
      // 优先使用 setBuffer (我们在 config/redis.ts 里为真实 Redis 打了补丁)
      await redis.setBuffer(`ydoc:${docId}`, Buffer.from(update));
    } catch (e) {
      console.error('Save update failed', e);
    }
  }

  private async loadDocumentFromRedis(docId: string): Promise<Y.Doc> {
    const ydoc = new Y.Doc();
    try {
      // 🔥【关键修改】使用 getBuffer 获取原始二进制数据
      const cached = await redis.getBuffer(`ydoc:${docId}`);
      
      if (cached && Buffer.isBuffer(cached) && cached.length > 0) {
        Y.applyUpdate(ydoc, cached);
      }
    } catch (err) {
      // 捕获所有解码错误，不要让服务器崩溃
      console.error(`[YjsService] Failed to load corrupted doc ${docId}, starting fresh. Error:`, err);
      // 如果数据损坏，当作新文档处理，不抛出异常
    }
    
    this.documents.set(docId, ydoc);
    return ydoc;
  }

  async getDocumentState(docId: string): Promise<any> {
    let ydoc = this.documents.get(docId);
    if (!ydoc) ydoc = await this.loadDocumentFromRedis(docId);
    const ytext = ydoc.getText('content');
    return ytext.toString();
  }

  async applyOperations(docId: string, ops: any[]): Promise<{ serverVersion: number; content: string }> {
    let ydoc = this.documents.get(docId);
    if (!ydoc) ydoc = await this.loadDocumentFromRedis(docId);

    ydoc.transact(() => {
      const ytext = ydoc.getText('content');
      for (const op of ops) {
        if (op.op === 'set') {
          if (ytext.length > 0) ytext.delete(0, ytext.length);
          ytext.insert(0, op.text || '');
        } else if (op.op === 'insert') {
          ytext.insert(op.index, op.text);
        } else if (op.op === 'delete') {
          ytext.delete(op.index, op.length);
        }
      }
    });

    const update = Y.encodeStateAsUpdate(ydoc);
    await this.saveUpdate(docId, update);
    const serverVersion = Number((await redis.incr(`ydoc_version:${docId}`)) || 1);
    return { serverVersion, content: ydoc.getText('content').toString() };
  }
}