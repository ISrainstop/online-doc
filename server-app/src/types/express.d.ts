import { AuthPayload } from '../middleware/auth.middleware.ts';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export {};

