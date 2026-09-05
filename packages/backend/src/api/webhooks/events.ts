import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/db/connection.js';
import { webhook_events } from '../../infrastructure/db/schema.js';
import { desc } from 'drizzle-orm';

const webhookEventRoutes: FastifyPluginAsync = async (app) => {
  app.get('/events', async (request) => {
    const { limit } = request.query as any;
    const events = await db.select().from(webhook_events)
      .orderBy(desc(webhook_events.created_at))
      .limit(Number(limit) || 50);
    return { data: events };
  });
};
export default webhookEventRoutes;
