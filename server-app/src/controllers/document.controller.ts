import { Response } from 'express';
import prisma from '../config/prisma';
import { YjsService } from '../services/yjs.service';
import { AuthenticatedRequest } from '../middleware/auth';

const yjsService = new YjsService();

async function findDocumentForUser(id: string, userId: string) {
  return prisma.document.findFirst({
    where: {
      id,
      isDeleted: false,
      OR: [
        { createdById: userId },
        { collaborators: { some: { userId } } }
      ]
    },
    include: { collaborators: true }
  });
}

function hasWritePermission(doc: Awaited<ReturnType<typeof findDocumentForUser>>, userId: string) {
  if (!doc) return false;
  if (doc.createdById === userId) return true;
  return doc.collaborators.some(c => c.userId === userId && c.permission === 'EDIT');
}

export async function listDocuments(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  try {
    const docs = await prisma.document.findMany({
      where: {
        isDeleted: false,
        OR: [
          { createdById: req.user.userId },
          { collaborators: { some: { userId: req.user.userId } } }
        ]
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        createdById: true
      }
    });
    return res.json(docs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'list failed' });
  }
}

export async function createDocument(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const { title, content } = (req as any).body;
  try {
    const initialContent = content ? (typeof content === 'string' ? content : JSON.stringify(content)) : undefined;

    const doc = await prisma.document.create({
      data: {
        title: title || 'Untitled',
        content: initialContent,
        contentText: typeof content === 'string' ? content : null,
        createdById: req.user.userId
      }
    });

    await yjsService.initDocument(doc.id, initialContent);

    return res.json(doc);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'create failed' });
  }
}

export async function getDocument(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const id = (req as any).params?.id;
  try {
    const doc = await findDocumentForUser(id, req.user.userId);
    if (!doc) return res.status(404).json({ error: 'not found or no access' });

    const content = await yjsService.getDocumentState(id);
    return res.json({ ...doc, content });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'get failed' });
  }
}

export async function updateDocument(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const id = (req as any).params?.id;
  const { title, contentText } = (req as any).body;

  try {
    const doc = await findDocumentForUser(id, req.user.userId);
    if (!doc) return res.status(404).json({ error: 'not found or no access' });
    if (!hasWritePermission(doc, req.user.userId)) return res.status(403).json({ error: 'forbidden' });

    const updated = await prisma.document.update({
      where: { id },
      data: {
        title: title ?? undefined,
        contentText: typeof contentText === 'string' ? contentText : undefined,
        content: typeof contentText === 'string' ? contentText : undefined
      }
    });

    if (typeof contentText === 'string') {
      await yjsService.applyOperations(id, [{ op: 'set', text: contentText }]);
    }

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'update failed' });
  }
}

export async function deleteDocument(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const id = (req as any).params?.id;

  try {
    const doc = await findDocumentForUser(id, req.user.userId);
    if (!doc) return res.status(404).json({ error: 'not found or no access' });
    if (!hasWritePermission(doc, req.user.userId)) return res.status(403).json({ error: 'forbidden' });

    await prisma.document.update({
      where: { id },
      data: { isDeleted: true }
    });

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'delete failed' });
  }
}
