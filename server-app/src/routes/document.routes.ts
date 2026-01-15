import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { 
  createDocument, 
  getDocuments,      // 修正：之前写的是 listDocuments
  getDocument, 
  updateDocument, 
  deleteDocument,
  addCollaborator,   // 确认导入
  removeCollaborator,// 确认导入
  createVersion,     // 确认导入
  getVersions        // 确认导入
} from '../controllers/document.controller';

const router = Router();

// 必须登录才能访问以下接口
router.use(authenticateToken);

// 文档 CRUD
router.post('/', createDocument);
router.get('/', getDocuments);      // 修正：对应 Controller 里的名字
router.get('/:id', getDocument);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);

// 协作者管理
router.post('/:id/collaborators', addCollaborator);
router.delete('/:id/collaborators', removeCollaborator);

// 历史版本
router.post('/:id/versions', createVersion);
router.get('/:id/versions', getVersions);

export default router;