import { describe, it, expect } from 'vitest';
import { DiagnosisEngine } from '../../../src/domain/diagnosis/diagnosis-engine.js';
import { makePayment } from '../../fixtures/index.js';

describe('DiagnosisEngine', () => {
  const engine = new DiagnosisEngine();

  it('diagnoses insufficient_funds as BUSINESS with high confidence', () => {
    const result = engine.diagnose(makePayment({ failure_code: 'insufficient_funds' }));
    expect(result.failure_class).toBe('BUSINESS');
    expect(result.confidence).toBe(0.95);
    expect(result.is_deterministic).toBe(true);
    expect(result.reason_codes).toContain('DETERMINISTIC_RULE');
  });

  it('diagnoses gateway_timeout as TECHNICAL', () => {
    const result = engine.diagnose(makePayment({ failure_code: 'gateway_timeout' }));
    expect(result.failure_class).toBe('TECHNICAL');
    expect(result.is_deterministic).toBe(true);
  });

  it('diagnoses authentication_required as AUTHENTICATION', () => {
    const result = engine.diagnose(makePayment({ failure_code: 'authentication_required' }));
    expect(result.failure_class).toBe('AUTHENTICATION');
    expect(result.is_deterministic).toBe(true);
  });

  it('diagnoses session_timeout as ABANDONMENT', () => {
    const result = engine.diagnose(makePayment({ failure_code: 'session_timeout' }));
    expect(result.failure_class).toBe('ABANDONMENT');
    expect(result.is_deterministic).toBe(true);
  });

  it('diagnoses subscription_pending as RECURRING_PAYMENT_FAILURE', () => {
    const result = engine.diagnose(makePayment({ failure_code: 'subscription_pending' }));
    expect(result.failure_class).toBe('RECURRING_PAYMENT_FAILURE');
    expect(result.is_deterministic).toBe(true);
  });

  it('diagnoses unknown error code as UNKNOWN with lower confidence', () => {
    const result = engine.diagnose(makePayment({ failure_code: 'some_new_bank_error' }));
    expect(result.failure_class).toBe('UNKNOWN');
    expect(result.confidence).toBe(0.5);
    expect(result.is_deterministic).toBe(false);
    expect(result.reason_codes).toContain('NO_MATCHING_RULE');
  });

  it('diagnoses missing failure_code as UNKNOWN', () => {
    const result = engine.diagnose(makePayment({ failure_code: undefined }));
    expect(result.failure_class).toBe('UNKNOWN');
    expect(result.is_deterministic).toBe(false);
  });

  it('handles case-insensitive failure codes', () => {
    const result = engine.diagnose(makePayment({ failure_code: 'INSUFFICIENT_FUNDS' }));
    expect(result.failure_class).toBe('BUSINESS');
    expect(result.is_deterministic).toBe(true);
  });
});
