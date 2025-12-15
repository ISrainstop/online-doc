import { Request, Response } from 'express';
import prisma from '../config/prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export async function login(req: Request, res: Response) {
  const { username, email, password } = req.body;
  const identifier = (username || email || '').trim();
  if (!identifier || !password) return res.status(400).json({ error: 'username or email and password required' });

  try {
    let user = null;
    if (username) user = await prisma.user.findUnique({ where: { username: identifier } });
    if (!user && email) user = await prisma.user.findUnique({ where: { email: identifier } });

    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await prisma.user.create({ data: { username: identifier, passwordHash, email: email || undefined } });
    } else {
      // 如果已有密码，校验；如果没有密码则补充设置（兼容老数据）
      if (user.passwordHash) {
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return res.status(401).json({ error: 'invalid credentials' });
      } else {
        const passwordHash = await bcrypt.hash(password, 10);
        user = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      }
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
}
