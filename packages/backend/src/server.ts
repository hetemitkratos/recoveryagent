import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';

import razorpayWebhookRoutes from './api/webhooks/razorpay.js';
import webhookEventRoutes from './api/webhooks/events.js';
import recoveryRoutes from './api/recovery/routes.js';
import dashboardRoutes from './api/dashboard/routes.js';
import demoRoutes from './api/demo/routes.js';
import systemRoutes from './api/system/routes.js';
import ptpRoutes from './api/ptp/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });

  await app.register(cors, {
    origin: '*',
  });

  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    reply.status(error.statusCode || 500).send({
      data: null,
      error: {
        code: error.name || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred',
      },
    });
  });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await app.register(razorpayWebhookRoutes, { prefix: '/webhooks' });
  await app.register(webhookEventRoutes, { prefix: '/api/webhooks' });
  await app.register(recoveryRoutes, { prefix: '/api/recovery' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(demoRoutes, { prefix: '/api/demo' });
  await app.register(systemRoutes, { prefix: '/api/system' });
  await app.register(ptpRoutes, { prefix: '/api/ptp' });

  return app;
}

export async function startServer() {
  const app = await buildApp();
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Server listening on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
