import { Router } from 'express';
import { uploadMiddleware, uploadFile } from '../controllers/upload.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// 上传需要登录权限
router.post('/', authenticateToken, uploadMiddleware, uploadFile);

export default router;