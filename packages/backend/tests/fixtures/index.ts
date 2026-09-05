import type { Customer } from '../../src/domain/entities/customer.js';
import type { Payment } from '../../src/domain/entities/payment.js';
import type { RecoverySession } from '../../src/domain/entities/recovery-session.js';
import type { RecoveryAction } from '../../src/domain/entities/recovery-action.js';
import type { RecoveryOutcome } from '../../src/domain/entities/recovery-outcome.js';
import type { PolicyContext } from '../../src/domain/policy/policy-rules.js';
import type { Config } from '../../src/config.js';
import type { AIResponse, PTPResponse } from '../../src/infrastructure/ai/schemas.js';

export function makeCustomer(overrides?: Partial<Customer>): Customer {
  return {
    id: 'cus_test_001',
    external_customer_id: 'ext_test_001',
    name: 'Test Customer',
    email: 'test@example.com',
    phone: '9999999999',
    preferred_channel: 'SIMULATED',
    opted_out: false,
    lifetime_value: 0,
    is_demo: true,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function makePayment(overrides?: Partial<Payment>): Payment {
  return {
    id: 'pay_test_001',
    customer_id: 'cus_test_001',
    provider: 'simulator',
    provider_payment_id: 'sim_pay_001',
    amount: 10000, // 100 INR in paise
    currency: 'INR',
    status: 'FAILED',
    attempt_number: 1,
    is_demo: true,
    metadata: {},
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function makeSession(overrides?: Partial<RecoverySession>): RecoverySession {
  return {
    id: 'ses_test_001',
    customer_id: 'cus_test_001',
    payment_id: 'pay_test_001',
    state: 'AT_RISK',
    risk_score: 50,
    recovery_probability: 0.5,
    expected_recoverable_revenue: 5000,
    attempt_count: 0,
    communication_count: 0,
    is_demo: true,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function makeAction(overrides?: Partial<RecoveryAction>): RecoveryAction {
  return {
    id: 'act_test_001',
    recovery_session_id: 'ses_test_001',
    action_type: 'PAYMENT_LINK',
    reason: 'Test action',
    source: 'AI',
    status: 'SUCCEEDED',
    idempotency_key: 'idem_test_001',
    provider: 'simulator',
    provider_reference: 'link_test_001',
    executed_at: new Date('2026-01-01T01:00:00Z'),
    completed_at: new Date('2026-01-01T01:00:05Z'),
    created_at: new Date('2026-01-01T01:00:00Z'),
    ...overrides,
  };
}

export function makeOutcome(overrides?: Partial<RecoveryOutcome>): RecoveryOutcome {
  return {
    id: 'out_test_001',
    recovery_session_id: 'ses_test_001',
    result: 'PAYMENT_RECOVERED',
    payment_id: 'pay_test_001',
    amount_recovered: 10000,
    currency: 'INR',
    attribution: 'DIRECT',
    attribution_evidence: 'PAYMENT_LINK_CLICKED',
    observed_at: new Date('2026-01-01T02:00:00Z'),
    ...overrides,
  };
}

export function makeConfig(overrides?: Partial<Config>): Config {
  return {
    DATABASE_URL: './data/test.db',
    GEMINI_MODEL: 'gemini-1.5-flash',
    MAX_RETRIES: 3,
    MAX_COMMUNICATIONS: 5,
    MIN_COMMUNICATION_INTERVAL_HOURS: 24,
    AI_CONFIDENCE_THRESHOLD: 0.70,
    PTP_CONFIDENCE_THRESHOLD: 0.80,
    HIGH_VALUE_THRESHOLD: 50000,
    ATTRIBUTION_WINDOW_HOURS: 72,
    RECOVERY_AUTOMATION_ENABLED: true,
    DEMO_MODE: true,
    DEMO_COMPRESS_DELAYS: true,
    DEMO_SEED: 42,
    PORT: 3000,
    FRONTEND_PORT: 5173,
    NODE_ENV: 'development',
    LOG_LEVEL: 'info',
    ...overrides,
  } as Config;
}

export function makeAIResponse(overrides?: Partial<AIResponse>): AIResponse {
  return {
    diagnosis: {
      failure_class: 'BUSINESS',
      confidence: 0.95,
      reason_codes: ['INSUFFICIENT_FUNDS'],
    },
    recovery: {
      probability: 0.75,
      confidence: 0.90,
    },
    recommendation: {
      action: 'PAYMENT_LINK',
      confidence: 0.90,
      reason_codes: ['MOCK_RECOMMENDATION'],
    },
    requires_human_review: false,
    ...overrides,
  };
}

export function makePTPResponse(overrides?: Partial<PTPResponse>): PTPResponse {
  return {
    is_ptp: true,
    promised_date: new Date('2026-01-05T00:00:00Z').toISOString(),
    promised_amount: null,
    confidence: 0.90,
    ...overrides,
  };
}

export function makePolicyContext(overrides?: Partial<PolicyContext> & { config?: Partial<Config> }): PolicyContext {
  const { config: configOverrides, ...rest } = overrides || {};
  return {
    customer: makeCustomer(),
    payment: makePayment(),
    session: makeSession(),
    proposedAction: 'PAYMENT_LINK',
    config: makeConfig(configOverrides),
    ...rest,
  };
}
