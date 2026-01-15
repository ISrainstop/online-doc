import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 确保上传目录存在
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置存储引擎
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名: timestamp-random.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

export const uploadMiddleware = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 限制 5MB
}).single('file'); // 前端表单字段名为 'file'

export const uploadFile = (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // 返回可访问的 URL
  // 注意：这里假设 Nginx 会把 /uploads 转发给后端
  // 或者后端直接通过 /api/uploads 提供访问
  // 这里我们采用简单策略：让后端在 /uploads 路径提供静态服务
  const fileUrl = `/uploads/${req.file.filename}`;
  
  return res.json({ url: fileUrl });
};