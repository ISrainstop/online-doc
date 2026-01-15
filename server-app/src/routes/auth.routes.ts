import { Router } from 'express';
import { login, register } from '../controllers/auth.controller';

const router = Router();

router.post('/login', login);
router.post('/register', register); // 新增注册路由

export default router;