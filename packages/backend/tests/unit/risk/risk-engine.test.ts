import { describe, it, expect } from 'vitest';
import { RiskEngine } from '../../../src/domain/risk/risk-engine.js';
import { makePayment } from '../../fixtures/index.js';
import type { DiagnosisResult } from '../../../src/domain/diagnosis/diagnosis-engine.js';

function makeDiagnosis(failure_class: DiagnosisResult['failure_class']): DiagnosisResult {
  return { failure_class, confidence: 0.95, reason_codes: ['TEST'], is_deterministic: true };
}

describe('RiskEngine', () => {
  const engine = new RiskEngine();

  it('scores TECHNICAL failure with high recovery probability', () => {
    const result = engine.assess({
      payment: makePayment({ amount: 100000 }),
      diagnosis: makeDiagnosis('TECHNICAL'),
      session_history: { attempt_count: 0, communication_count: 0 },
      customer_history: { success_count: 0, fail_count: 0, prior_recovery_outcomes: [] },
    });
    expect(result.recovery_probability).toBeGreaterThan(0.7);
    expect(result.expected_recoverable_revenue).toBeGreaterThan(0);
    expect(result.risk_score).toBeGreaterThanOrEqual(0);
    expect(result.risk_score).toBeLessThanOrEqual(100);
    expect(result.risk_factors.length).toBeGreaterThan(0);
  });

  it('scores BUSINESS failure with moderate recovery probability', () => {
    const result = engine.assess({
      payment: makePayment({ amount: 100000 }),
      diagnosis: makeDiagnosis('BUSINESS'),
      session_history: { attempt_count: 0, communication_count: 0 },
      customer_history: { success_count: 0, fail_count: 0, prior_recovery_outcomes: [] },
    });
    expect(result.recovery_probability).toBeGreaterThan(0.4);
    expect(result.recovery_probability).toBeLessThan(0.8);
  });

  it('scores ABANDONMENT with lower recovery probability', () => {
    const result = engine.assess({
      payment: makePayment({ amount: 100000 }),
      diagnosis: makeDiagnosis('ABANDONMENT'),
      session_history: { attempt_count: 0, communication_count: 0 },
      customer_history: { success_count: 0, fail_count: 0, prior_recovery_outcomes: [] },
    });
    expect(result.recovery_probability).toBeLessThan(0.5);
  });

  it('blends historical success rate into probability', () => {
    const result = engine.assess({
      payment: makePayment({ amount: 100000 }),
      diagnosis: makeDiagnosis('BUSINESS'),
      session_history: { attempt_count: 0, communication_count: 0 },
      customer_history: { success_count: 8, fail_count: 2, prior_recovery_outcomes: ['PAYMENT_RECOVERED'] },
    });
    // Base 0.6 blended with 0.8 historical = 0.7
    expect(result.recovery_probability).toBeCloseTo(0.7, 1);
  });

  it('calculates expected recoverable revenue from amount × probability × incremental', () => {
    const result = engine.assess({
      payment: makePayment({ amount: 100000 }),
      diagnosis: makeDiagnosis('TECHNICAL'),
      session_history: { attempt_count: 0, communication_count: 0 },
      customer_history: { success_count: 0, fail_count: 0, prior_recovery_outcomes: [] },
    });
    // 100000 × 0.8 × 0.8 = 64000
    expect(result.expected_recoverable_revenue).toBe(64000);
  });

  it('clamps recovery probability to [0.1, 0.95]', () => {
    const result = engine.assess({
      payment: makePayment({ amount: 100000 }),
      diagnosis: makeDiagnosis('UNKNOWN'),
      session_history: { attempt_count: 0, communication_count: 0 },
      customer_history: { success_count: 0, fail_count: 0, prior_recovery_outcomes: [] },
    });
    expect(result.recovery_probability).toBeGreaterThanOrEqual(0.1);
    expect(result.recovery_probability).toBeLessThanOrEqual(0.95);
  });
});
