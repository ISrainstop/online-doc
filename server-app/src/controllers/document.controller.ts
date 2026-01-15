import { Request, Response } from 'express';
// 使用默认导入
import prisma from '../config/prisma';

// 定义带 User 信息的 Request 接口
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

// 1. 创建文档
export async function createDocument(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });

  const { title, content } = req.body;
  try {
    const doc = await prisma.document.create({
      data: {
        title: title || '无标题文档',
        content: content || {}, 
        createdById: req.user.userId,
        collaborators: {
          create: {
            userId: req.user.userId,
            permission: 'OWNER'
          }
        }
      }
    });
    return res.json(doc);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'create failed' });
  }
}

// 2. 获取文档列表 (我的文档)
export async function getDocuments(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });

  try {
    const docs = await prisma.document.findMany({
      where: {
        isDeleted: false,
        collaborators: {
          some: { userId: req.user.userId }
        }
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        // 🔥 修复点 1: 嵌套查询 user 信息，否则前端 c.user 为 undefined
        collaborators: {
          include: {
            user: {
              select: { id: true, username: true, email: true }
            }
          }
        }
      }
    });
    return res.json(docs);
  } catch (err) {
    return res.status(500).json({ error: 'fetch failed' });
  }
}

// 3. 获取单个文档详情
export async function getDocument(req: AuthenticatedRequest, res: Response) {
  const docId = req.params.id;
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });

  try {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      include: { 
        // 🔥 修复点 2: 这里也必须嵌套查询 user，否则进入编辑页就崩
        collaborators: {
          include: {
            user: {
              select: { id: true, username: true, email: true }
            }
          }
        }
      }
    });

    if (!doc || doc.isDeleted) return res.status(404).json({ error: 'not found' });

    // 检查权限
    const collaborator = doc.collaborators.find((c: any) => c.userId === req.user?.userId);
    
    if (!collaborator) {
        return res.status(403).json({ error: 'forbidden' });
    }

    return res.json({
        ...doc,
        permission: collaborator.permission
    });

  } catch (err) {
    return res.status(500).json({ error: 'fetch doc failed' });
  }
}

// 4. 更新文档 (纯文本)
export async function updateDocument(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const docId = req.params.id;
  const { contentText } = req.body; 

  try {
    const collaborator = await prisma.documentCollaborator.findUnique({
      where: {
        documentId_userId: {
          documentId: docId,
          userId: req.user.userId
        }
      }
    });

    if (!collaborator || collaborator.permission === 'VIEW') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.document.update({
      where: { id: docId },
      data: { 
        contentText: contentText, 
        updatedAt: new Date() 
      }
    });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'update failed' });
  }
}

// 5. 删除文档
export async function deleteDocument(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const docId = req.params.id;

  try {
    const collaborator = await prisma.documentCollaborator.findUnique({
      where: {
        documentId_userId: {
          documentId: docId,
          userId: req.user.userId
        }
      }
    });

    if (!collaborator || collaborator.permission !== 'OWNER') {
      return res.status(403).json({ error: 'Only owner can delete' });
    }

    await prisma.document.update({
      where: { id: docId },
      data: { isDeleted: true }
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'delete failed' });
  }
}

// 6. 版本历史 - 创建
export async function createVersion(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const docId = req.params.id;
  const { content, versionName } = req.body; 

  try {
    const version = await prisma.documentVersion.create({
      data: {
        documentId: docId,
        content: content, 
        createdById: req.user.userId,
        versionName: versionName || '自动保存'
      }
    });
    return res.json(version);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create version' });
  }
}

// 7. 版本历史 - 获取
export async function getVersions(req: AuthenticatedRequest, res: Response) {
  const docId = req.params.id;
  try {
    const versions = await prisma.documentVersion.findMany({
      where: { documentId: docId },
      orderBy: { createdAt: 'desc' }, 
      take: 20 
    });
    
    // 手动填充用户信息
    const enrichedVersions = await Promise.all(versions.map(async (v: any) => {
      let creatorName = '未知用户';
      if (v.createdById) {
        const u = await prisma.user.findUnique({ where: { id: v.createdById } });
        if (u) creatorName = u.username;
      }
      return { ...v, creatorName };
    }));

    return res.json(enrichedVersions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch versions' });
  }
}

// 8. 添加协作者
export async function addCollaborator(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const docId = req.params.id;
  const { targetUsername, permission } = req.body; 

  try {
    const current = await prisma.documentCollaborator.findUnique({
      where: { documentId_userId: { documentId: docId, userId: req.user.userId } }
    });
    if (current?.permission !== 'OWNER') {
      return res.status(403).json({ error: 'Only owner can add collaborators' });
    }

    const targetUser = await prisma.user.findUnique({ where: { username: targetUsername } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // 检查是否已经是协作者
    const existing = await prisma.documentCollaborator.findUnique({
        where: { documentId_userId: { documentId: docId, userId: targetUser.id } }
    });
    if (existing) {
        return res.status(400).json({ error: 'User is already a collaborator' });
    }

    const collab = await prisma.documentCollaborator.create({
      data: {
        documentId: docId,
        userId: targetUser.id,
        permission: permission || 'VIEW'
      },
      // 🔥 修复点 3: 创建时也顺便返回 user 信息，方便前端直接展示
      include: {
        user: { select: { id: true, username: true, email: true } }
      }
    });
    return res.json(collab);
  } catch (e) {
    return res.status(500).json({ error: 'Add failed' });
  }
}

// 9. 移除协作者
export async function removeCollaborator(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const docId = req.params.id;
  const { userId: targetUserId } = req.body;

  try {
    const current = await prisma.documentCollaborator.findUnique({
      where: { documentId_userId: { documentId: docId, userId: req.user.userId } }
    });
    if (current?.permission !== 'OWNER') {
      return res.status(403).json({ error: 'Only owner can remove collaborators' });
    }

    // 不能移除自己 (Owner)
    if (targetUserId === req.user.userId) {
        return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    await prisma.documentCollaborator.delete({
      where: { documentId_userId: { documentId: docId, userId: targetUserId } }
    });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Remove failed' });
  }
}