import type { FastifyPluginAsync } from 'fastify';
import { buildAppContext } from '../../composition-root.js';
import { config } from '../../config.js';
import { nanoid } from 'nanoid';

const razorpayWebhookRoutes: FastifyPluginAsync = async (app) => {
  // Capture raw body as Buffer for HMAC signature verification
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body);
  });

  const { webhookProcessor: processor } = buildAppContext();

  app.post('/razorpay', async (request, reply) => {
    const rawBody = request.body as Buffer;
    const signature = request.headers['x-razorpay-signature'] as string;

    if (!signature) {
      return reply.code(401).send({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing x-razorpay-signature header' } });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return reply.code(400).send({ data: null, error: { code: 'INVALID_REQUEST', message: 'Malformed JSON payload' } });
    }

    const eventId = (request.headers['x-razorpay-event-id'] as string) || payload.id || `evt_unk_${nanoid()}`;

    // Event freshness check: reject events older than WEBHOOK_MAX_AGE_SECONDS
    if (payload.created_at && typeof payload.created_at === 'number') {
      const eventAge = Math.floor(Date.now() / 1000) - payload.created_at;
      if (eventAge > config.WEBHOOK_MAX_AGE_SECONDS) {
        request.log.warn({ eventId, eventAge, maxAge: config.WEBHOOK_MAX_AGE_SECONDS }, 'Rejecting stale webhook event');
        return reply.code(400).send({
          data: null,
          error: { code: 'STALE_EVENT', message: `Event is ${eventAge}s old (max ${config.WEBHOOK_MAX_AGE_SECONDS}s)` },
        });
      }
    }

    try {
      await processor.process(rawBody, signature, eventId);
      return reply.code(200).send({ status: 'ok' });
    } catch (err: any) {
      if (err.message === 'Invalid signature') {
        request.log.warn({ eventId }, 'Webhook signature verification failed');
        return reply.code(401).send({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid signature' } });
      }
      request.log.error({ err, eventId }, 'Webhook processing error');
      return reply.code(400).send({ data: null, error: { code: 'WEBHOOK_ERROR', message: err.message } });
    }
  });
};

export default razorpayWebhookRoutes;
