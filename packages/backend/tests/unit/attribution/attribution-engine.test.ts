import { describe, it, expect } from 'vitest';
import { AttributionEngine } from '../../../src/domain/attribution/attribution-engine.js';
import { makeSession, makePayment, makeAction } from '../../fixtures/index.js';

describe('AttributionEngine', () => {
  const engine = new AttributionEngine();

  it('DIRECT: payment through recovery link', () => {
    const result = engine.calculate({
      session: makeSession({ state: 'PAYMENT_PENDING' }),
      payment: makePayment({ status: 'CAPTURED' }),
      actions: [makeAction({ action_type: 'PAYMENT_LINK', status: 'SUCCEEDED' })],
      payment_route: 'RECOVERY_LINK',
      payment_time: new Date('2026-01-01T02:00:00Z'),
      attribution_window_hours: 72,
    });
    expect(result.attribution).toBe('DIRECT');
    expect(result.evidence).toBe('PAYMENT_LINK_CLICKED');
  });

  it('ASSISTED: qualifying intervention then payment through another route within window', () => {
    const result = engine.calculate({
      session: makeSession({ state: 'OUTREACH' }),
      payment: makePayment({ status: 'CAPTURED' }),
      actions: [makeAction({
        action_type: 'MESSAGE',
        status: 'SUCCEEDED',
        executed_at: new Date('2026-01-01T01:00:00Z'),
      })],
      payment_route: 'OTHER',
      payment_time: new Date('2026-01-01T12:00:00Z'), // 11 hours later, within 72h window
      attribution_window_hours: 72,
    });
    expect(result.attribution).toBe('ASSISTED');
    expect(result.evidence).toBe('INTERVENTION_WITHIN_WINDOW');
  });

  it('ORGANIC: no qualifying intervention', () => {
    const result = engine.calculate({
      session: makeSession({ state: 'AT_RISK' }),
      payment: makePayment({ status: 'CAPTURED' }),
      actions: [],
      payment_route: 'OTHER',
      payment_time: new Date('2026-01-01T02:00:00Z'),
      attribution_window_hours: 72,
    });
    expect(result.attribution).toBe('ORGANIC');
    expect(result.evidence).toBe('NO_QUALIFYING_INTERVENTION');
  });

  it('ORGANIC: intervention exists but failed', () => {
    const result = engine.calculate({
      session: makeSession({ state: 'AT_RISK' }),
      payment: makePayment({ status: 'CAPTURED' }),
      actions: [makeAction({ action_type: 'MESSAGE', status: 'FAILED' })],
      payment_route: 'OTHER',
      payment_time: new Date('2026-01-01T02:00:00Z'),
      attribution_window_hours: 72,
    });
    expect(result.attribution).toBe('ORGANIC');
  });

  it('UNKNOWN: intervention outside attribution window', () => {
    const result = engine.calculate({
      session: makeSession({ state: 'OUTREACH' }),
      payment: makePayment({ status: 'CAPTURED' }),
      actions: [makeAction({
        action_type: 'MESSAGE',
        status: 'SUCCEEDED',
        executed_at: new Date('2026-01-01T00:00:00Z'),
      })],
      payment_route: 'OTHER',
      payment_time: new Date('2026-01-10T00:00:00Z'), // 9 days later, outside 72h window
      attribution_window_hours: 72,
    });
    // Session is OUTREACH (not AT_RISK) and has qualifying intervention but outside window
    expect(result.attribution).toBe('UNKNOWN');
    expect(result.evidence).toBe('INSUFFICIENT_DATA');
  });

  it('concurrent payment: DIRECT when payment through recovery link regardless of timing', () => {
    // Even if payment happens very quickly after intervention, DIRECT if through recovery link
    const result = engine.calculate({
      session: makeSession({ state: 'PAYMENT_PENDING' }),
      payment: makePayment({ status: 'CAPTURED' }),
      actions: [makeAction({
        action_type: 'PAYMENT_LINK',
        status: 'SUCCEEDED',
        executed_at: new Date('2026-01-01T01:00:00Z'),
      })],
      payment_route: 'RECOVERY_LINK',
      payment_time: new Date('2026-01-01T01:00:01Z'), // 1 second later
      attribution_window_hours: 72,
    });
    expect(result.attribution).toBe('DIRECT');
  });
});
