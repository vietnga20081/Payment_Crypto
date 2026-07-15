import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import { verifyAccessToken } from '../utils/jwt';
import { logger } from '../utils/logger';

let io: SocketServer;

export const initSocket = (server: Server): SocketServer => {
  io = new SocketServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    try {
      const payload = verifyAccessToken(token);
      (socket as unknown as { user: typeof payload }).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as unknown as { user: { userId: string; role: string; merchantId?: string } }).user;
    logger.info(`Socket connected: ${user.userId}`);

    // Join room per user
    socket.join(`user:${user.userId}`);
    if (user.merchantId) socket.join(`merchant:${user.merchantId}`);
    if (user.role === 'ADMIN') socket.join('admin');

    socket.on('subscribe:transaction', (txId: string) => {
      socket.join(`tx:${txId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${user.userId}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) throw new Error('Socket not initialized');
  return io;
};

export const emitTransactionUpdate = (txId: string, merchantId: string, data: object): void => {
  const socket = getIO();
  socket.to(`tx:${txId}`).emit('transaction:updated', data);
  socket.to(`merchant:${merchantId}`).emit('transaction:updated', data);
  socket.to('admin').emit('transaction:updated', data);
};

export const emitWithdrawalUpdate = (merchantId: string, data: object): void => {
  const socket = getIO();
  socket.to(`merchant:${merchantId}`).emit('withdrawal:updated', data);
  socket.to('admin').emit('withdrawal:updated', data);
};
