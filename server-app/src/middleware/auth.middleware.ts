import { NextFunction, Response, Request } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

export interface AuthPayload {
  userId: string;
  username: string;
}

// 导出这个接口，方便其他地方复用
export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

// 🔥 关键修改：函数名改为 authenticateToken，以匹配 routes 中的引用
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // 获取 header
  const authHeader = req.headers['authorization'] || '';
  // 解析 Bearer token
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    // 将用户信息挂载到 req 上
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(403).json({ error: 'invalid_token' });
  }
}