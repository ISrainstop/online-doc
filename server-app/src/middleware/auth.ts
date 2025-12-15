import { NextFunction, Response, Request } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export interface AuthPayload {
  userId: string;
  username: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Fix: Use req.headers['authorization'] to access the header in a type-safe way
  const authHeader = req.headers['authorization'] || '';
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

