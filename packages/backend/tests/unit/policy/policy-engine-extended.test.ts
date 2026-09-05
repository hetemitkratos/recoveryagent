import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../../../src/domain/policy/policy-engine.js';
import { makePolicyContext } from '../../fixtures/index.js';

describe('PolicyEngine Extended Rules', () => {
  const engine = new PolicyEngine();

  it('RULE-001: blocks PAYMENT_LINK when payment is CAPTURED regardless of AI confidence', () => {
    const ctx = makePolicyContext({
      payment: { status: 'CAPTURED' } as any,
      aiConfidence: 0.99,
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('BLOCK');
    expect(res.blockingReasons).toContain('PAYMENT_ALREADY_COMPLETED');
  });

  it('RULE-005: blocks MESSAGE for opted-out customer', () => {
    const ctx = makePolicyContext({
      customer: { opted_out: true } as any,
      proposedAction: 'MESSAGE',
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('BLOCK');
    expect(res.blockingReasons).toContain('CUSTOMER_OPTED_OUT');
  });

  it('RULE-006: blocks SAFE_RETRY when retry ceiling reached', () => {
    const ctx = makePolicyContext({
      session: { attempt_count: 3 } as any,
      proposedAction: 'SAFE_RETRY',
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('BLOCK');
    expect(res.blockingReasons).toContain('RETRY_LIMIT_REACHED');
  });

  it('RULE-COMM-COUNT: blocks PAYMENT_LINK when communication limit reached', () => {
    const ctx = makePolicyContext({
      session: { communication_count: 5 } as any,
      proposedAction: 'PAYMENT_LINK',
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('BLOCK');
    expect(res.blockingReasons).toContain('COMMUNICATION_LIMIT_REACHED');
  });

  it('RULE-KILL-SWITCH: blocks all external actions when automation disabled', () => {
    const ctx = makePolicyContext({
      proposedAction: 'PAYMENT_LINK',
      config: { RECOVERY_AUTOMATION_ENABLED: false } as any,
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('BLOCK');
    expect(res.blockingReasons).toContain('RECOVERY_AUTOMATION_DISABLED');
  });

  it('RULE-KILL-SWITCH: allows WAIT even when automation disabled', () => {
    const ctx = makePolicyContext({
      proposedAction: 'WAIT',
      config: { RECOVERY_AUTOMATION_ENABLED: false } as any,
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('ALLOW');
  });

  it('RULE-HIGH-VALUE: sends PAYMENT_LINK to HUMAN_REVIEW for high-value transactions', () => {
    const ctx = makePolicyContext({
      payment: { amount: 60000 } as any, // above 50000 threshold
      proposedAction: 'PAYMENT_LINK',
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('HUMAN_REVIEW');
    expect(res.blockingReasons).toContain('HIGH_VALUE_TRANSACTION');
  });

  it('RULE-HIGH-VALUE: allows PAYMENT_LINK for normal-value transactions', () => {
    const ctx = makePolicyContext({
      payment: { amount: 10000 } as any, // below threshold
      proposedAction: 'PAYMENT_LINK',
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('ALLOW');
  });

  it('RULE-004: sends to HUMAN_REVIEW when AI confidence below threshold for high-risk action', () => {
    const ctx = makePolicyContext({
      proposedAction: 'PAYMENT_LINK',
      aiConfidence: 0.50, // below 0.70 threshold
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('HUMAN_REVIEW');
    expect(res.blockingReasons).toContain('LOW_CONFIDENCE_HIGH_RISK');
  });

  it('RULE-008: sends to HUMAN_REVIEW for unknown failure with high-risk action', () => {
    const ctx = makePolicyContext({
      session: { diagnosis: 'UNKNOWN' } as any,
      proposedAction: 'PAYMENT_LINK',
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('HUMAN_REVIEW');
    expect(res.blockingReasons).toContain('UNKNOWN_FAILURE_HIGH_RISK_ACTION');
  });

  it('RULE-008: allows SAFE_RETRY for TECHNICAL failure', () => {
    const ctx = makePolicyContext({
      session: { diagnosis: 'TECHNICAL', attempt_count: 0 } as any,
      proposedAction: 'SAFE_RETRY',
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('ALLOW');
  });

  it('records policy version 1.0.0 in all decisions', () => {
    const ctx = makePolicyContext();
    const res = engine.evaluate(ctx);
    expect(res.policyVersion).toBe('1.0.0');
  });

  it('evaluates all rules when ALLOW', () => {
    const ctx = makePolicyContext({
      session: { diagnosis: 'BUSINESS', attempt_count: 0, communication_count: 0 } as any,
      proposedAction: 'PAYMENT_LINK',
      aiConfidence: 0.90,
    });
    const res = engine.evaluate(ctx);
    expect(res.decision).toBe('ALLOW');
    expect(res.rulesEvaluated.length).toBeGreaterThan(0);
  });
});
