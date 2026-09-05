import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config.js';

/**
 * API key authentication middleware.
 *
 * - In DEMO_MODE with no API_KEY set: auth is skipped (open for local dev).
 * - In production or when API_KEY is set: all requests must include
 *   `x-api-key` header matching the configured key.
 *
 * Webhook routes are exempt — they use Razorpay signature verification instead.
 */
export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
  // Skip auth in demo mode if no API key is configured
  if (config.DEMO_MODE && !config.API_KEY) {
    return;
  }

  // If API_KEY is set, enforce it
  if (config.API_KEY) {
    const provided = request.headers['x-api-key'];
    if (!provided || provided !== config.API_KEY) {
      return reply.status(401).send({
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API key' },
      });
    }
  }
}
