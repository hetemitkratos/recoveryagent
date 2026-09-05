import crypto from 'crypto';
import type { RecoveryOrchestrator } from '../recovery/recovery-orchestrator.js';
import { normalizeRazorpayEvent, isFailureEvent, isSuccessEvent, type NormalizedPaymentEvent } from './event-normalizer.js';
import { razorpayWebhookSchema } from './webhook-schema.js';
import { db } from '../../infrastructure/db/connection.js';
import { webhook_events } from '../../infrastructure/db/schema.js';
import { eq } from 'drizzle-orm';

export class WebhookProcessor {
  constructor(private orchestrator: RecoveryOrchestrator, private config: any) {}

  verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
    if (!signature || !secret) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false; // Length mismatch
    }
  }

  async process(rawBody: Buffer, signature: string, eventId: string): Promise<void> {
    // 1. Verify signature
    if (!this.verifySignature(rawBody, signature, this.config.RAZORPAY_WEBHOOK_SECRET)) {
      throw new Error('Invalid signature');
    }

    // 2. Parse JSON
    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new Error('Malformed JSON payload');
    }

    // 3. Idempotency check — reject duplicate events
    const existing = await db.select().from(webhook_events).where(eq(webhook_events.source_event_id, eventId));
    if (existing.length > 0) {
      // Duplicate event — already processed, return silently
      return;
    }

    // 4. Validate payload structure with Zod (loose validation — payload shape varies by event type)
    const parsed = razorpayWebhookSchema.safeParse(payload);
    if (!parsed.success) {
      // Store the event for debugging but don't process it
      await db.insert(webhook_events).values({
        id: `evt_${crypto.randomUUID()}`,
        source: 'razorpay',
        source_event_id: eventId,
        event_type: 'MALFORMED',
        payload,
        is_demo: this.config.DEMO_MODE,
        created_at: new Date(),
      });
      throw new Error(`Invalid webhook payload: ${parsed.error.issues[0]?.message}`);
    }

    // 5. Normalize the event
    const normalized = normalizeRazorpayEvent(payload, eventId);

    // 6. Store the event
    await db.insert(webhook_events).values({
      id: `evt_${crypto.randomUUID()}`,
      source: normalized.source,
      source_event_id: normalized.source_event_id,
      event_type: normalized.event_type,
      payload: normalized.raw_payload,
      is_demo: this.config.DEMO_MODE,
      created_at: new Date(),
    });

    // 7. Dispatch to orchestrator based on event category
    if (isFailureEvent(normalized.event_type)) {
      await this.orchestrator.handleFailedPayment(normalized);
    } else if (isSuccessEvent(normalized.event_type)) {
      await this.orchestrator.handlePaymentSuccess(normalized);
    }
    // Informational events (SUBSCRIPTION_CANCELLED, SUBSCRIPTION_RESUMED, REFUND_PROCESSED)
    // are stored but don't trigger recovery actions. They can be used for future enrichment.
  }
}
