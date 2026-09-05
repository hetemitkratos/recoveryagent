---
name: payment-integration
description: >-
  Use this skill when implementing the Razorpay webhook gateway, webhook
  signature verification, idempotent event processing, payment provider
  adapters, or the payment/notification simulator for the AI Revenue Recovery
  MVP. Covers secure secret handling, event normalization, duplicate
  protection, and provider failure handling.
---

# Payment Integration Skill

## Purpose

The Razorpay integration boundary ensures:
- The core recovery engine never depends on raw Razorpay payloads
- Webhooks are authenticated before any processing
- Duplicate events are safely ignored
- Provider failures do not corrupt recovery state

---

## Provider Adapter Pattern

NEVER call Razorpay SDK directly from business logic. Use adapters:

```typescript
interface PaymentProvider {
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink>;
  retryPayment(paymentId: string): Promise<PaymentRetryResult>;
}

interface NotificationProvider {
  sendMessage(params: SendMessageParams): Promise<SendResult>;
  sendEmail(params: SendEmailParams): Promise<SendResult>;
}
```

Provide:
- `RazorpayAdapter` — real Razorpay SDK calls
- `SimulatorAdapter` — deterministic in-process simulator (no external calls)

Select adapter based on config (`RAZORPAY_KEY_ID` set → real; absent → simulator).

---

## Webhook Signature Verification

HMAC-SHA256 against the **raw request body** (NOT re-serialized JSON):

```typescript
import crypto from 'crypto';

function verifyRazorpayWebhook(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
}
```

**Critical:** Register the raw body BEFORE any JSON parsing middleware.
```typescript
// Fastify: use rawBody plugin or addContentTypeParser with raw buffer
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body, done) => { req.rawBody = body; done(null, JSON.parse(body)); }
);
```

HTTP responses:
- Invalid signature → `401 Unauthorized`
- Malformed payload → `400 Bad Request`
- Valid (including duplicate) → `200 OK`

---

## Idempotency Layer

Use `source_event_id` (from Razorpay's `X-Razorpay-Event-Id` header or payload `event.id`) as idempotency key.

```typescript
async function processWebhook(eventId: string, payload: WebhookPayload) {
  // DB unique constraint on source_event_id prevents duplicate processing
  const existing = await db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.sourceEventId, eventId)
  });

  if (existing) {
    logger.info('Duplicate webhook ignored', { eventId });
    return; // idempotent: return 200, no business processing
  }

  await db.insert(webhookEvents).values({
    sourceEventId: eventId,
    receivedAt: new Date(),
    payload,
  });

  // Now process business event
  await processBusinessEvent(payload);
}
```

---

## Event Normalization

Convert raw Razorpay payloads to internal events before any business logic:

```typescript
interface NormalizedPaymentEvent {
  event_type: 'PAYMENT_FAILED' | 'PAYMENT_CAPTURED' | 'SUBSCRIPTION_HALTED' | ...;
  source: 'razorpay';
  source_event_id: string;
  payment_id: string;
  customer_id: string;
  amount: number;           // in paise
  currency: string;
  failure_code?: string;
  failure_description?: string;
  occurred_at: string;      // ISO timestamp
  metadata: Record<string, unknown>;
}

function normalizeRazorpayEvent(raw: RazorpayWebhookPayload): NormalizedPaymentEvent
```

The rest of the system consumes `NormalizedPaymentEvent` — never raw Razorpay objects.

---

## Supported Razorpay Webhook Events (MVP)

```
payment.failed         → PAYMENT_FAILED → start recovery
payment.captured       → PAYMENT_CAPTURED → RECOVERED
subscription.pending   → SUBSCRIPTION_PENDING → start recovery
subscription.halted    → SUBSCRIPTION_HALTED → start recovery
payment_link.paid      → PAYMENT_LINK_PAID → RECOVERED (DIRECT attribution)
```

Map Razorpay payment statuses to canonical statuses:
```
razorpay: "failed"    → internal: FAILED
razorpay: "captured"  → internal: CAPTURED
razorpay: "authorized"→ internal: AUTHORIZED
razorpay: "refunded"  → internal: REFUNDED
```

---

## Secret Handling

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Rules:
- Never commit real secrets (only `.env.example` goes to git)
- Never log secrets or key values
- Never expose secrets in API responses or frontend
- Use `process.env` or a typed config module, never inline strings
- Webhook secret must be read server-side only

---

## Provider Failure Handling

```typescript
async function createPaymentLink(params): Promise<PaymentLink> {
  try {
    const result = await razorpayClient.paymentLink.create(params);
    return mapToPaymentLink(result);
  } catch (err) {
    // Do NOT retry blindly — duplicate links are a real risk
    await auditLog('PAYMENT_LINK_CREATION_FAILED', { error: err.message, params });
    throw new ProviderError('PAYMENT_LINK_FAILED', err);
    // Orchestrator catches this and records failed action — does NOT retry automatically
  }
}
```

Provider failure rules:
- Record the failure in `RecoveryAction.status = 'FAILED'`
- Write an audit event
- Do NOT duplicate the action
- Do NOT blindly retry — use idempotency key check before any retry

---

## Simulator Adapter

The simulator must call through the same interfaces as real Razorpay:

```typescript
class SimulatorAdapter implements PaymentProvider {
  // Uses in-memory/DB state — no external HTTP calls
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    // Read from simulator state table
  }

  async createPaymentLink(params): Promise<PaymentLink> {
    // Create in simulator state, return a fake URL
    return { url: `https://sim.test/pay/${uuid()}`, ... };
  }
}
```

The core engine should not know or care which adapter it's using.

---

## Security Checklist

Before any webhook handler ships:
- [ ] Raw body captured before JSON parse
- [ ] Signature verified with timing-safe comparison
- [ ] `RAZORPAY_WEBHOOK_SECRET` from env, never hardcoded
- [ ] Idempotency key stored before processing
- [ ] Duplicate events return 200 without reprocessing
- [ ] No secrets in logs
- [ ] No provider SDK calls outside the adapter layer

---

## References

- API contract: `docs/API_CONTRACT.md` §13–14
- Architecture: `docs/ARCHITECTURE.md` §5–6
- Idempotency model: `docs/DOMAIN_MODEL.md` §26
