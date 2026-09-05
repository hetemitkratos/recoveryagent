import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../../infrastructure/db/connection.js';
import { recovery_actions, ai_recommendations, policy_decisions, promises_to_pay } from '../../infrastructure/db/schema.js';
import { eq } from 'drizzle-orm';
import { buildAppContext } from '../../composition-root.js';
import { config } from '../../config.js';
import { isValidTransition } from '../../domain/state-machine/transitions.js';
import { executeActionBodySchema, paginationSchema } from '../schemas.js';

const ptpReplySchema = z.object({
  text: z.string().min(1).max(5000),
  source: z.enum(['TEXT', 'VOICE', 'MANUAL']).default('TEXT'),
});

const recoveryRoutes: FastifyPluginAsync = async (app) => {
  const { orchestrator, sessionRepo, auditRepo, outcomeRepo, paymentRepo, paymentProvider, aiAdapter, ptpRepo, customerRepo } = buildAppContext();

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

  // POST /api/recovery/:id/ptp-reply — receive a customer reply and extract PTP via AI
  app.post('/:id/ptp-reply', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ptpReplySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ data: null, error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message } });
    }

    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ data: null, error: { code: 'NOT_FOUND', message: 'Session not found' } });

    // Terminal state protection — no PTP processing on closed sessions
    if (session.state === 'RECOVERED' || session.state === 'STOPPED') {
      return reply.code(409).send({ data: null, error: { code: 'SESSION_CLOSED', message: `Session is in terminal state ${session.state}` } });
    }

    // Re-check payment status before processing — payment state always wins
    if (session.payment_id) {
      try {
        const status = await paymentProvider.getPaymentStatus(session.payment_id);
        if (status === 'CAPTURED' || status === 'AUTHORIZED') {
          await orchestrator.handlePaymentSuccess({
            event_type: 'PAYMENT_CAPTURED',
            source: 'ptp_reply_check',
            source_event_id: `ptp_reply_${Date.now()}`,
            payment_id: session.payment_id,
            customer_id: session.customer_id,
            occurred_at: new Date(),
            raw_payload: { ptp_reply: true },
          } as any);
          return reply.code(409).send({ data: null, error: { code: 'PAYMENT_ALREADY_RECOVERED', message: 'Payment is already captured — session closed' } });
        }
      } catch {
        // If provider check fails, continue with PTP processing (safe fallback)
      }
    }

    const { text, source } = parsed.data;

    // Call AI to extract PTP from the reply text
    let ptpResult;
    try {
      ptpResult = await aiAdapter.extractPTP(text, {
        customer_id: session.customer_id,
        payment_id: session.payment_id || '',
      });
    } catch (err: any) {
      // AI failure — audit and safe fallback to HUMAN_REVIEW
      await auditRepo.append({
        id: `aud_${crypto.randomUUID()}`,
        event_type: 'PTP_AI_FAILURE',
        recovery_session_id: id,
        customer_id: session.customer_id,
        payment_id: session.payment_id || '',
        actor: 'SYSTEM',
        payload: { error: err.message, source_text: text.slice(0, 200) },
        is_demo: session.is_demo,
      });

      // Route to HUMAN_REVIEW if AI is unavailable
      if (isValidTransition(session.state, 'HUMAN_REVIEW')) {
        await sessionRepo.updateState(id, 'HUMAN_REVIEW');
      }

      return { data: { ptp_detected: false, status: 'AI_UNAVAILABLE', message: 'PTP extraction failed — routed to human review' } };
    }

    // Determine PTP status based on confidence threshold
    const isHighConfidence = ptpResult.confidence >= config.PTP_CONFIDENCE_THRESHOLD;
    const hasDate = ptpResult.is_ptp && ptpResult.promised_date;

    if (!hasDate || !isHighConfidence) {
      // Ambiguous or no PTP — audit and route to HUMAN_REVIEW if confidence is low
      await auditRepo.append({
        id: `aud_${crypto.randomUUID()}`,
        event_type: 'PTP_AMBIGUOUS',
        recovery_session_id: id,
        customer_id: session.customer_id,
        payment_id: session.payment_id || '',
        actor: 'SYSTEM',
        payload: {
          source_text: text.slice(0, 200),
          is_ptp: ptpResult.is_ptp,
          promised_date: ptpResult.promised_date,
          confidence: ptpResult.confidence,
          threshold: config.PTP_CONFIDENCE_THRESHOLD,
        },
        is_demo: session.is_demo,
      });

      // If low confidence and PTP was detected, route to HUMAN_REVIEW
      if (ptpResult.is_ptp && isValidTransition(session.state, 'HUMAN_REVIEW')) {
        await sessionRepo.updateState(id, 'HUMAN_REVIEW');
      }

      return {
        data: {
          ptp_detected: ptpResult.is_ptp,
          status: 'AMBIGUOUS',
          confidence: ptpResult.confidence,
          promised_date: ptpResult.promised_date,
          message: ptpResult.is_ptp
            ? 'PTP detected but low confidence — routed to human review'
            : 'No PTP detected in reply',
        },
      };
    }

    // High-confidence PTP detected — create PTP record and transition to PTP_WAIT
    const promisedDate = new Date(ptpResult.promised_date!);
    const ptp = await ptpRepo.create({
      id: `ptp_${crypto.randomUUID()}`,
      recovery_session_id: id,
      customer_id: session.customer_id,
      promised_date: promisedDate,
      promised_amount: ptpResult.promised_amount ?? null,
      source: source,
      source_text: text,
      confidence: ptpResult.confidence,
      status: 'ACTIVE',
    });

    // Transition to PTP_WAIT if valid from current state
    if (isValidTransition(session.state, 'PTP_WAIT')) {
      await sessionRepo.updateState(id, 'PTP_WAIT', {
        next_action_at: promisedDate,
      });
    }

    // Audit the PTP detection
    await auditRepo.append({
      id: `aud_${crypto.randomUUID()}`,
      event_type: 'PTP_DETECTED',
      recovery_session_id: id,
      customer_id: session.customer_id,
      payment_id: session.payment_id || '',
      actor: 'SYSTEM',
      payload: {
        ptp_id: ptp.id,
        promised_date: promisedDate.toISOString(),
        promised_amount: ptpResult.promised_amount,
        confidence: ptpResult.confidence,
        source: source,
        source_text: text.slice(0, 200),
      },
      is_demo: session.is_demo,
    });

    return {
      data: {
        ptp_detected: true,
        status: 'ACTIVE',
        ptp_id: ptp.id,
        promised_date: promisedDate.toISOString(),
        promised_amount: ptpResult.promised_amount,
        confidence: ptpResult.confidence,
        session_state: 'PTP_WAIT',
        message: 'Promise to pay recorded — outreach paused until promised date',
      },
    };
  });

  // GET /api/recovery/:id/ptp — list PTP records for a session
  app.get('/:id/ptp', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await sessionRepo.findById(id);
    if (!session) return reply.code(404).send({ data: null, error: { code: 'NOT_FOUND', message: 'Session not found' } });

    const ptpRecords = await db.select().from(promises_to_pay).where(eq(promises_to_pay.recovery_session_id, id));
    return { data: ptpRecords };
  });
};
export default recoveryRoutes;
