import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../../../src/domain/policy/policy-engine.js';
import { makeCustomer, makePayment, makeSession } from '../../fixtures/index.js';
import type { PolicyContext } from '../../../src/domain/policy/policy-rules.js';

describe('PolicyEngine', () => {
  const engine = new PolicyEngine();
  const baseConfig = {
    RECOVERY_AUTOMATION_ENABLED: true,
    MAX_RETRIES: 3,
    MAX_COMMUNICATIONS: 3,
    HIGH_VALUE_THRESHOLD: 50000,
    AI_CONFIDENCE_THRESHOLD: 0.70
  } as any;

  it('allows SAFE_RETRY under normal conditions', () => {
    const ctx: PolicyContext = {
      customer: makeCustomer(),
      payment: makePayment(),
      session: makeSession({ diagnosis: 'TECHNICAL' }),
      proposedAction: 'SAFE_RETRY',
      config: baseConfig
    };
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('ALLOW');
  });

  it('blocks if customer is opted out', () => {
    const ctx: PolicyContext = {
      customer: makeCustomer({ opted_out: true }),
      payment: makePayment(),
      session: makeSession(),
      proposedAction: 'MESSAGE',
      config: baseConfig
    };
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('BLOCK');
    expect(res.blockingReasons).toContain('CUSTOMER_OPTED_OUT');
  });

  it('blocks if payment is already captured', () => {
    const ctx: PolicyContext = {
      customer: makeCustomer(),
      payment: makePayment({ status: 'CAPTURED' }),
      session: makeSession(),
      proposedAction: 'PAYMENT_LINK',
      config: baseConfig
    };
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('BLOCK');
    expect(res.blockingReasons).toContain('PAYMENT_ALREADY_COMPLETED');
  });

  it('returns HUMAN_REVIEW for unknown failure on high-risk action', () => {
    const ctx: PolicyContext = {
      customer: makeCustomer(),
      payment: makePayment(),
      session: makeSession({ diagnosis: 'UNKNOWN' }),
      proposedAction: 'PAYMENT_LINK',
      config: baseConfig
    };
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('HUMAN_REVIEW');
  });
});
