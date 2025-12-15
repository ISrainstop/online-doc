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
      await redis.setBuffer(`ydoc:${docId}`, Buffer.from(update));
    } catch (e) {
      // redis client may not support setBuffer; fall back to base64
      await redis.set(`ydoc:${docId}`, Buffer.from(update).toString('base64'));
    }
  }

  private async loadDocumentFromRedis(docId: string): Promise<Y.Doc> {
    const cached = await redis.get(`ydoc:${docId}`);
    const ydoc = new Y.Doc();
    if (cached) {
      let buf: Buffer;
      if (typeof cached === 'string') {
        // assume base64
        buf = Buffer.from(cached, 'base64');
      } else if (Buffer.isBuffer(cached)) {
        buf = cached as Buffer;
      } else {
        buf = Buffer.from(String(cached), 'base64');
      }
      try {
        Y.applyUpdate(ydoc, buf);
      } catch (err) {
        console.error('Failed to apply update', err);
      }
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
          ytext.delete(0, ytext.length);
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
