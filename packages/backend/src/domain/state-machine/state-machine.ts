import type { RecoverySession, RecoveryState } from '../entities/recovery-session.js';
import type { RecoveryEvent } from './events.js';
import { isValidTransition } from './transitions.js';
import { runAllGuards, type GuardContext, type GuardResult } from './guards.js';
import { TERMINAL_STATES } from '../entities/recovery-session.js';

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid transition from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class GuardViolationError extends Error {
  constructor(reason: string) {
    super(`Guard violation: ${reason}`);
    this.name = 'GuardViolationError';
  }
}

export class StateMachine {
  transition(session: RecoverySession, toState: RecoveryState, event: RecoveryEvent): RecoverySession {
    if (TERMINAL_STATES.has(session.state)) {
      throw new InvalidTransitionError(session.state, toState);
    }
    if (!isValidTransition(session.state, toState)) {
      throw new InvalidTransitionError(session.state, toState);
    }

    return {
      ...session,
      state: toState,
    };
  }

  evaluateAction(session: RecoverySession, action: import('../entities/recovery-action.js').ActionType, ctx: GuardContext): GuardResult {
    ctx.proposedAction = action;
    return runAllGuards(ctx);
  }
}
