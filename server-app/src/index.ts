import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import prisma from './config/prisma';
import redis from './config/redis';
import { setupWebSocket } from './websocket/socket';
import authRoutes from './routes/auth.routes';
import documentRoutes from './routes/document.routes';
import path from 'path'; // 新增
import uploadRoutes from './routes/upload.routes'; // 新增

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 简单健康检查
app.get('/health', async (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/upload', uploadRoutes); // 新增上传接口

const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true } });

// WebSocket (Socket.IO) - 主要用于 presence / app events
setupWebSocket(io);

const PORT = Number(process.env.PORT || 5000);
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});
