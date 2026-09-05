---
name: testing
description: >-
  Use this skill when writing or reviewing tests for the AI Revenue Recovery
  MVP. Covers unit testing, integration testing, state machine testing,
  webhook idempotency testing, attribution testing, AI fallback testing,
  and policy rule testing using Vitest. Provides patterns for deterministic
  fixtures, mock adapters, and test isolation.
---

# Testing Skill

## Testing Stack

- **Framework:** Vitest (fast, TypeScript-native, compatible with Node 22)
- **HTTP testing:** Fastify's `inject()` for integration tests (no network needed)
- **Assertions:** Vitest built-in `expect`
- **Fixtures:** Deterministic factory functions — no random data in tests

---

## File Organization

```
packages/backend/tests/
├── unit/
│   ├── state-machine/
│   │   ├── transitions.test.ts
│   │   └── guards.test.ts
│   ├── policy/
│   │   └── policy-engine.test.ts
│   ├── diagnosis/
│   │   └── diagnosis-engine.test.ts
│   ├── attribution/
│   │   └── attribution-engine.test.ts
│   └── risk/
│       └── risk-engine.test.ts
├── integration/
│   ├── webhook/
│   │   ├── signature.test.ts
│   │   └── idempotency.test.ts
│   ├── recovery/
│   │   └── orchestrator.test.ts
│   └── api/
│       └── recovery-api.test.ts
└── scenarios/
    ├── hero-a-technical.test.ts
    ├── hero-b-business.test.ts
    ├── hero-c-ptp.test.ts
    ├── hero-d-already-paid.test.ts
    └── hero-e-opt-out.test.ts
```

---

## Fixture Factories (deterministic)

```typescript
// tests/fixtures/index.ts

export function makeCustomer(overrides?: Partial<Customer>): Customer {
  return {
    id: 'cus_test_001',
    external_customer_id: 'ext_001',
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '+919999999999',
    opted_out: false,
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

export function makePayment(overrides?: Partial<Payment>): Payment {
  return {
    id: 'pay_test_001',
    customer_id: 'cus_test_001',
    provider: 'razorpay',
    provider_payment_id: 'rzp_pay_001',
    amount: 12000,   // paise
    currency: 'INR',
    status: 'FAILED',
    failure_code: 'insufficient_funds',
    failure_class: 'BUSINESS',
    attempt_number: 1,
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

export function makeSession(overrides?: Partial<RecoverySession>): RecoverySession {
  return {
    id: 'rec_test_001',
    customer_id: 'cus_test_001',
    payment_id: 'pay_test_001',
    state: 'AT_RISK',
    risk_score: 75,
    recovery_probability: 0.7,
    expected_recoverable_revenue: 8400,
    attempt_count: 0,
    communication_count: 0,
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}
```

---

## State Machine Tests

```typescript
describe('StateMachine', () => {
  describe('valid transitions', () => {
    it('AT_RISK → DIAGNOSING', () => {
      const session = makeSession({ state: 'AT_RISK' });
      const result = stateMachine.transition(session, 'DIAGNOSING', mockEvent);
      expect(result.state).toBe('DIAGNOSING');
    });
    // ... all valid pairs
  });

  describe('invalid transitions', () => {
    it('RECOVERED → OUTREACH must throw', () => {
      const session = makeSession({ state: 'RECOVERED' });
      expect(() => stateMachine.transition(session, 'OUTREACH', mockEvent))
        .toThrow(InvalidTransitionError);
    });

    it('STOPPED → SAFE_RETRY must throw', () => {
      const session = makeSession({ state: 'STOPPED' });
      expect(() => stateMachine.transition(session, 'SAFE_RETRY', mockEvent))
        .toThrow(InvalidTransitionError);
    });
  });

  describe('global guards', () => {
    it('blocks outreach when payment is already paid', async () => {
      const session = makeSession({ state: 'OUTREACH' });
      const paidPayment = makePayment({ status: 'CAPTURED' });
      const result = await stateMachine.evaluateAction(session, 'MESSAGE', { payment: paidPayment });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('PAYMENT_ALREADY_PAID');
    });

    it('blocks all communication for opted-out customer', async () => {
      const customer = makeCustomer({ opted_out: true });
      const result = await stateMachine.evaluateAction(session, 'MESSAGE', { customer });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CUSTOMER_OPTED_OUT');
    });
  });
});
```

---

## Policy Engine Tests

```typescript
describe('PolicyEngine', () => {
  it('RULE-001: blocks any action when payment is already paid', () => {
    const context = makePolicyContext({
      payment: makePayment({ status: 'CAPTURED' }),
      proposedAction: 'PAYMENT_LINK',
    });
    const result = policy.evaluate(context);
    expect(result.decision).toBe('BLOCK');
    expect(result.blockingReasons).toContain('PAYMENT_ALREADY_COMPLETED');
  });

  it('RULE-001 overrides AI confidence=0.99', () => {
    const context = makePolicyContext({
      payment: makePayment({ status: 'CAPTURED' }),
      aiRecommendation: makeAIRec({ confidence: 0.99, action: 'PAYMENT_LINK' }),
    });
    const result = policy.evaluate(context);
    expect(result.decision).toBe('BLOCK');  // payment truth wins
  });

  it('RULE-005: opts-out customer blocks MESSAGE', () => { ... });
  it('RULE-006: retry ceiling blocks SAFE_RETRY', () => { ... });
  it('Kill switch blocks all external actions', () => { ... });
  it('Policy decision is persisted with version', async () => { ... });
});
```

---

## Webhook / Idempotency Tests

```typescript
describe('Webhook Gateway', () => {
  it('accepts valid Razorpay signature', async () => {
    const { rawBody, signature } = makeValidWebhookRequest(secret, payload);
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/razorpay',
      headers: { 'x-razorpay-signature': signature },
      body: rawBody,
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects invalid signature with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/razorpay',
      headers: { 'x-razorpay-signature': 'invalid' },
      body: JSON.stringify(payload),
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 for duplicate event without reprocessing', async () => {
    const { rawBody, signature } = makeValidWebhookRequest(secret, payload);
    await app.inject({ method: 'POST', url: '/webhooks/razorpay',
      headers: { 'x-razorpay-signature': signature }, body: rawBody });
    // Second identical event
    const res = await app.inject({ method: 'POST', url: '/webhooks/razorpay',
      headers: { 'x-razorpay-signature': signature }, body: rawBody });
    expect(res.statusCode).toBe(200);
    // Verify only one recovery session was created
    const sessions = await db.query.recoverySessions.findMany();
    expect(sessions).toHaveLength(1);
  });
});
```

---

## Attribution Tests

```typescript
describe('AttributionEngine', () => {
  it('DIRECT: payment through recovery link', () => {
    const result = attribution.calculate({
      payment: makePayment({ status: 'CAPTURED' }),
      session: makeSession({ state: 'PAYMENT_PENDING' }),
      action: makeAction({ type: 'PAYMENT_LINK', provider_reference: 'link_123' }),
      paymentRoute: 'RECOVERY_LINK',
    });
    expect(result.attribution).toBe('DIRECT');
    expect(result.evidence).toBe('RECOVERY_PAYMENT_LINK');
  });

  it('prevents double-counting: one payment → one outcome', async () => {
    // Create first outcome for payment
    await outcomes.create({ payment_id: 'pay_001', attribution: 'DIRECT', ... });
    // Attempt second outcome for same payment
    await expect(outcomes.create({ payment_id: 'pay_001', ... }))
      .rejects.toThrow(DuplicateOutcomeError);
  });

  it('ORGANIC: payment with no qualifying intervention', () => { ... });
  it('UNKNOWN: insufficient evidence', () => { ... });
});
```

---

## Hero Scenario Tests

```typescript
// hero-b-business.test.ts
describe('Hero Scenario B: Business failure → DIRECT recovery', () => {
  it('completes the full loop', async () => {
    // 1. Simulate payment failure
    await simulator.simulateFailure({ failure_class: 'BUSINESS', amount: 12000 });

    // 2. Verify AT_RISK created
    const session = await sessions.findByPayment(paymentId);
    expect(session.state).toBe('AT_RISK');

    // 3. Run orchestrator
    await orchestrator.process(session.id);
    expect(session.state).toBe('OUTREACH');

    // 4. Simulate payment success through recovery link
    await simulator.simulatePayment({ route: 'RECOVERY_LINK' });

    // 5. Verify RECOVERED + DIRECT attribution
    const outcome = await outcomes.findBySession(session.id);
    expect(outcome.result).toBe('PAYMENT_RECOVERED');
    expect(outcome.attribution).toBe('DIRECT');
    expect(outcome.amount_recovered).toBe(12000);
  });
});

// hero-d-already-paid.test.ts
describe('Hero Scenario D: Already paid race condition', () => {
  it('blocks outreach when payment is already paid', async () => {
    const session = makeSession({ state: 'DIAGNOSING' });
    // Mark payment as paid mid-flow
    await payments.updateStatus(paymentId, 'CAPTURED');

    const result = await orchestrator.processAction(session.id, 'PAYMENT_LINK');
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('PAYMENT_ALREADY_COMPLETED');

    // Verify no outreach was sent
    const comms = await communications.findBySession(session.id);
    expect(comms).toHaveLength(0);

    // Verify audit event written
    const audit = await auditLog.findBySession(session.id);
    expect(audit.some(e => e.event_type === 'ACTION_BLOCKED')).toBe(true);
  });
});
```

---

## Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**'],
      exclude: ['src/infrastructure/**'],  // test through integration tests
    },
  },
});
```

```typescript
// tests/setup.ts
import { beforeEach, afterEach } from 'vitest';
import { resetTestDatabase } from './helpers/db';

beforeEach(async () => {
  await resetTestDatabase();  // fresh DB per test
});
```

---

## What NOT to Do

- Do NOT use random UUIDs/timestamps in test fixtures — use deterministic seeds
- Do NOT test implementation details — test behavior and invariants
- Do NOT make real HTTP calls to Razorpay or Gemini in unit tests
- Do NOT share mutable state between tests — isolate with DB reset
- Do NOT test only HTTP status codes — verify state transitions and side effects
- Do NOT skip tests "because it's a hackathon" — the spec requires them

---

## Minimum Test Coverage Required

Per `AGENTS.md` §18:
- ✓ Webhook: valid sig, invalid sig, duplicate, malformed, delayed
- ✓ Recovery: technical/business/auth/unknown failure, successful recovery
- ✓ Guardrails: already-paid, opt-out, retry ceiling, duplicate session, low confidence, prohibited action, provider failure, AI unavailable
- ✓ Attribution: direct, assisted, organic, unknown, concurrent payment
- ✓ PTP: valid date, ambiguous date, missed promise, payment before promise
