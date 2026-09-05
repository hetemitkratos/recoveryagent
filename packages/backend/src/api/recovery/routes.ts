import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/db/connection.js';
import { recovery_actions, ai_recommendations, policy_decisions } from '../../infrastructure/db/schema.js';
import { eq } from 'drizzle-orm';
import { buildAppContext } from '../../composition-root.js';
import { executeActionBodySchema, paginationSchema } from '../schemas.js';

const recoveryRoutes: FastifyPluginAsync = async (app) => {
  const { orchestrator, sessionRepo, auditRepo, outcomeRepo, paymentRepo, paymentProvider } = buildAppContext();

  // GET /api/recovery — list sessions with pagination
  app.get('/', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ data: null, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message } });
    }
    const { limit, offset } = parsed.data;
    const sessions = await sessionRepo.findAll();
    const paginated = sessions.slice(offset, offset + limit);
    return { data: paginated, meta: { total: sessions.length, limit, offset } };
  });

  // GET /api/recovery/:id — get single session
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ data: null, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    return { data: session };
  });

  // GET /api/recovery/:id/trace — get full decision trace with AI recs + policy decisions
  app.get('/:id/trace', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ data: null, error: { code: 'NOT_FOUND', message: 'Session not found' } });

    const [actions, outcomes, auditEvents, aiRecs, policyDecs] = await Promise.all([
      db.select().from(recovery_actions).where(eq(recovery_actions.recovery_session_id, id)),
      outcomeRepo.findBySession(id),
      auditRepo.findBySession(id),
      db.select().from(ai_recommendations).where(eq(ai_recommendations.recovery_session_id, id)),
      db.select().from(policy_decisions).where(eq(policy_decisions.recovery_session_id, id)),
    ]);

    return {
      data: {
        session,
        actions,
        outcomes,
        audit_events: auditEvents,
        ai_recommendations: aiRecs,
        policy_decisions: policyDecs,
      },
    };
  });

  // POST /api/recovery/:id/actions — execute a manual action
  app.post('/:id/actions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = executeActionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ data: null, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message } });
    }
    try {
      await orchestrator.executeManualAction(id, parsed.data.action_type, 'MANUAL');
      return { data: { success: true } };
    } catch (err: any) {
      return reply.code(400).send({ data: null, error: { code: 'ACTION_FAILED', message: err.message } });
    }
  });

  // POST /api/recovery/:id/sync-payment — manually re-check payment status from provider
  app.post('/:id/sync-payment', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ data: null, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    if (!session.payment_id) return reply.code(400).send({ data: null, error: { code: 'NO_PAYMENT', message: 'Session has no linked payment' } });

    try {
      const status = await paymentProvider.getPaymentStatus(session.payment_id);

      // If payment is captured/authorized, trigger the success handler
      if (status === 'CAPTURED' || status === 'AUTHORIZED') {
        const payment = await paymentRepo.findById(session.payment_id);
        await orchestrator.handlePaymentSuccess({
          event_type: status === 'CAPTURED' ? 'PAYMENT_CAPTURED' : 'PAYMENT_AUTHORIZED',
          source: 'razorpay',
          source_event_id: `manual_sync_${Date.now()}`,
          payment_id: session.payment_id,
          customer_id: session.customer_id,
          amount: payment?.amount,
          currency: payment?.currency,
          occurred_at: new Date(),
          raw_payload: { manual_sync: true, status },
        } as any);

        return { data: { synced: true, status, session_closed: true } };
      }

      return { data: { synced: true, status, session_closed: false } };
    } catch (err: any) {
      return reply.code(502).send({ data: null, error: { code: 'PROVIDER_ERROR', message: err.message } });
    }
  });
};
export default recoveryRoutes;
