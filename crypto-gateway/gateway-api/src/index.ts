import 'dotenv/config';
import http from 'http';
import app from './app';
import { initSocket } from './websocket/socket';
import { startWebhookWorker } from './jobs/webhook.job';
import { startWebhookBridge } from './jobs/webhook-bridge.job';
import { startWatchdog } from './jobs/watchdog.job';
import { startExpireUnselectedJob } from './jobs/expire-unselected.job';
import { logger } from './utils/logger';
import { prisma } from './prisma/client';

const PORT = Number(process.env.PORT) || 3007;

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    const server = http.createServer(app);
    initSocket(server);
    startWebhookWorker();
    startWebhookBridge();
    startWatchdog();
    startExpireUnselectedJob();

    server.listen(PORT, () => {
      logger.info(`Gateway API running on port ${PORT}`);
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down...');
      await prisma.$disconnect();
      server.close(() => process.exit(0));
    });
  } catch (err) {
    logger.error('Bootstrap failed', { error: (err as Error).message });
    process.exit(1);
  }
}

bootstrap();
