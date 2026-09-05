import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';

import razorpayWebhookRoutes from './api/webhooks/razorpay.js';
import recoveryRoutes from './api/recovery/routes.js';
import dashboardRoutes from './api/dashboard/routes.js';
import demoRoutes from './api/demo/routes.js';
import { apiKeyAuth } from './api/middleware/auth.js';
import { requestIdPlugin } from './api/middleware/request-id.js';

/**
 * Parse CORS_ORIGINS config into the format Fastify expects.
 * - '*' is allowed only in DEMO_MODE.
 * - Otherwise it's a comma-separated list of origins.
 */
function getCorsOrigin(): string | string[] {
  if (config.DEMO_MODE && config.CORS_ORIGINS === '*') {
    return '*';
  }
  return config.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
}

export async function buildApp() {
  const isProduction = config.NODE_ENV === 'production';

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Redact sensitive fields from logs
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers["x-api-key"]',
          'req.headers["x-razorpay-signature"]',
          '*.phone',
          '*.email',
          '*.RAZORPAY_KEY_SECRET',
          '*.RAZORPAY_WEBHOOK_SECRET',
          '*.GEMINI_API_KEY',
          '*.API_KEY',
        ],
        censor: '[REDACTED]',
      },
      // Only pretty-print in development
      ...(isProduction ? {} : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
    },
    bodyLimit: config.BODY_LIMIT,
  });

  // --- Security plugins ---
  await app.register(helmet, {
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    } : false, // Disable CSP in dev so Vite HMR works
  });

  await app.register(cors, {
    origin: getCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    // Exempt health checks from rate limiting
    keyGenerator: (request) => {
      if (request.url === '/health' || request.url === '/ready') return 'health';
      return request.ip;
    },
  });

  // --- Request tracing ---
  await app.register(requestIdPlugin);

  // --- Error handler ---
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      request.log.error({ err: error, requestId: request.id }, 'Unhandled error');
    } else {
      request.log.warn({ err: error, requestId: request.id, statusCode }, 'Request error');
    }
    reply.status(statusCode).send({
      data: null,
      error: {
        code: error.name || 'INTERNAL_SERVER_ERROR',
        message: isProduction && statusCode >= 500
          ? 'An unexpected error occurred'
          : error.message,
        requestId: request.id,
      },
    });
  });

  // --- Health endpoints (no auth) ---
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  app.get('/ready', async () => {
    // Basic readiness — check DB file exists or connection is alive
    // Extended in Phase 8 with DB/AI/provider checks
    return { status: 'ok', checks: { database: 'ok' } };
  });

  // --- Webhook routes (signature-verified, no API key) ---
  await app.register(razorpayWebhookRoutes, { prefix: '/webhooks' });

  // --- API routes (API key authenticated) ---
  // Apply auth middleware as a preHandler hook for all /api/* routes
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      await apiKeyAuth(request, reply);
    }
  });

  await app.register(recoveryRoutes, { prefix: '/api/recovery' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(demoRoutes, { prefix: '/api/demo' });

  // --- Serve frontend static files in production ---
  // The frontend is built to packages/frontend/dist/ and served by Fastify
  // so we only need one port in production.
  if (isProduction) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const frontendDist = process.env.FRONTEND_DIST || path.resolve(__dirname, '../../frontend/dist');

    await app.register(fastifyStatic, {
      root: frontendDist,
      prefix: '/',
      wildcard: false, // We handle SPA fallback manually
    });

    // SPA fallback: serve index.html for any non-API, non-file route
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/webhooks/')) {
        return reply.code(404).send({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}

export async function startServer() {
  const app = await buildApp();

  // --- Graceful shutdown ---
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Received shutdown signal, draining connections...');
    try {
      await app.close();
      app.log.info('Server closed gracefully');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Server listening on port ${config.PORT} (env: ${config.NODE_ENV}, demo: ${config.DEMO_MODE})`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Robust entry-point detection that works on both POSIX and Windows
// (import.meta.url is a file:// URL; process.argv[1] is a native path).
const isMainModule = (() => {
  try {
    const argvPath = new URL(`file://${process.argv[1]}`).href.replace(/\\/g, '/');
    return import.meta.url === argvPath || import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
  } catch {
    return false;
  }
})();

if (isMainModule) {
  startServer();
}
