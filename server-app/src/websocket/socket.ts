import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

interface UserPayload {
  userId: string;
  username: string;
}

export function setupWebSocket(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token as string | undefined;
    if (!token) return next(new Error('Authentication error'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret') as UserPayload;
      socket.data.user = decoded;
      return next();
    } catch (err) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as UserPayload;
    console.log('socket connected user=', user?.username);

    socket.on('join-document', async (documentId: string) => {
      const hasAccess = await prisma.document.findFirst({
        where: {
          id: documentId,
          isDeleted: false,
          OR: [
            { createdById: user.userId },
            { collaborators: { some: { userId: user.userId } } }
          ]
        }
      });

      if (!hasAccess) {
        socket.emit('forbidden', { documentId });
        return;
      }

      socket.join(documentId);
      socket.to(documentId).emit('user-joined', { userId: user.userId, username: user.username });

      // 发送当前在线用户列表
      const clients = await io.in(documentId).fetchSockets();
      const users = clients.map(c => c.data.user);
      socket.emit('current-users', users);
    });

    socket.on('leave-document', (documentId: string) => {
      socket.leave(documentId);
      socket.to(documentId).emit('user-left', { userId: user.userId, username: user.username });
    });

    socket.on('disconnect', () => {
      console.log('socket disconnected', user?.username);
    });
  });
}
