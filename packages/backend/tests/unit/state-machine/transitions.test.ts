import { describe, it, expect } from 'vitest';
import { StateMachine, InvalidTransitionError } from '../../../src/domain/state-machine/state-machine.js';
import { makeSession } from '../../fixtures/index.js';

describe('StateMachine Transitions', () => {
  const sm = new StateMachine();

  it('allows valid transition AT_RISK -> DIAGNOSING', () => {
    const session = makeSession({ state: 'AT_RISK' });
    const next = sm.transition(session, 'DIAGNOSING', { type: 'DIAGNOSIS_COMPLETE' });
    expect(next.state).toBe('DIAGNOSING');
  });

  it('rejects invalid transition AT_RISK -> ESCALATED', () => {
    const session = makeSession({ state: 'AT_RISK' });
    expect(() => sm.transition(session, 'ESCALATED', { type: 'FORCE_CLOSE', reason: '' }))
      .toThrow(InvalidTransitionError);
  });

  it('prevents any transition from terminal state (RECOVERED)', () => {
    const session = makeSession({ state: 'RECOVERED' });
    expect(() => sm.transition(session, 'OUTREACH', { type: 'MANUAL_INTERVENTION' }))
      .toThrow(InvalidTransitionError);
  });
});
