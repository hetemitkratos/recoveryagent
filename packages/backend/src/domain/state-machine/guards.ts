import type { RecoverySession, RecoveryState } from '../entities/recovery-session.js';
import type { Payment } from '../entities/payment.js';
import type { Customer } from '../entities/customer.js';
import type { ActionType } from '../entities/recovery-action.js';
import { TERMINAL_STATES } from '../entities/recovery-session.js';
import type { Config } from '../../config.js';

export interface GuardContext {
  session: RecoverySession;
  payment?: Payment;
  customer?: Customer;
  proposedAction?: ActionType;
  aiConfidence?: number;
  config: Config;
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  redirectState?: RecoveryState;
}

export function checkTerminalState(ctx: GuardContext): GuardResult {
  if (TERMINAL_STATES.has(ctx.session.state)) {
    return { allowed: false, reason: 'RECOVERY_ALREADY_CLOSED' };
  }
  return { allowed: true };
}

export function checkPaymentState(ctx: GuardContext): GuardResult {
  if (ctx.payment && (ctx.payment.status === 'CAPTURED' || ctx.payment.status === 'AUTHORIZED')) {
    return { allowed: false, reason: 'PAYMENT_ALREADY_COMPLETED', redirectState: 'RECOVERED' };
  }
  return { allowed: true };
}

export function checkOptOut(ctx: GuardContext): GuardResult {
  if (ctx.customer?.opted_out) {
    return { allowed: false, reason: 'CUSTOMER_OPTED_OUT', redirectState: 'STOPPED' };
  }
  return { allowed: true };
}

export function checkRetryLimit(ctx: GuardContext): GuardResult {
  if (ctx.proposedAction === 'SAFE_RETRY' && ctx.session.attempt_count >= ctx.config.MAX_RETRIES) {
    return { allowed: false, reason: 'RETRY_LIMIT_REACHED' };
  }
  return { allowed: true };
}

export function checkCommunicationLimit(ctx: GuardContext): GuardResult {
  const isOutreach = ctx.proposedAction === 'MESSAGE' || ctx.proposedAction === 'PAYMENT_LINK';
  if (isOutreach && ctx.session.communication_count >= ctx.config.MAX_COMMUNICATIONS) {
    return { allowed: false, reason: 'COMMUNICATION_LIMIT_REACHED' };
  }
  return { allowed: true };
}

export function checkAIConfidence(ctx: GuardContext): GuardResult {
  const isHighRisk = ctx.proposedAction === 'PAYMENT_LINK' || ctx.proposedAction === 'MESSAGE';
  if (isHighRisk && ctx.aiConfidence !== undefined && ctx.aiConfidence < ctx.config.AI_CONFIDENCE_THRESHOLD) {
    return { allowed: false, reason: 'LOW_CONFIDENCE_HIGH_RISK', redirectState: 'HUMAN_REVIEW' };
  }
  return { allowed: true };
}

export function runAllGuards(ctx: GuardContext): GuardResult {
  const guards = [
    checkTerminalState,
    checkPaymentState,
    checkOptOut,
    checkRetryLimit,
    checkCommunicationLimit,
    checkAIConfidence
  ];

  for (const guard of guards) {
    const res = guard(ctx);
    if (!res.allowed) {
      return res;
    }
  }

  return { allowed: true };
}
