import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';

/**
 * Request ID plugin.
 * Adds a unique `x-request-id` header to every request if not already present.
 * The ID is available on `request.id` and in all log entries.
 */
export async function requestIdPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    const existing = request.headers['x-request-id'];
    const id = (Array.isArray(existing) ? existing[0] : existing) || crypto.randomUUID();
    request.id = id;
    reply.header('x-request-id', id);
  });
}
