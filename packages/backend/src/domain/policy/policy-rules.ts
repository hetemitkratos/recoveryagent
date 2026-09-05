import type { PolicyDecisionResult } from '../entities/policy-decision.js';
import type { ActionType } from '../entities/recovery-action.js';
import type { RecoverySession } from '../entities/recovery-session.js';
import type { Payment } from '../entities/payment.js';
import type { Customer } from '../entities/customer.js';
import type { Config } from '../../config.js';

export interface PolicyContext {
  session: RecoverySession;
  payment: Payment;
  customer: Customer;
  proposedAction: ActionType;
  aiConfidence?: number;
  config: Config;
}

export interface PolicyRuleResult {
  decision: PolicyDecisionResult | 'PASS';
  ruleId: string;
  reason?: string;
}

export function rule001PaymentState(ctx: PolicyContext): PolicyRuleResult {
  if (ctx.payment.status === 'CAPTURED' || ctx.payment.status === 'AUTHORIZED') {
    return { decision: 'BLOCK', ruleId: 'RULE-001', reason: 'PAYMENT_ALREADY_COMPLETED' };
  }
  return { decision: 'PASS', ruleId: 'RULE-001' };
}

export function rule005OptOut(ctx: PolicyContext): PolicyRuleResult {
  if (ctx.customer.opted_out) {
    return { decision: 'BLOCK', ruleId: 'RULE-005', reason: 'CUSTOMER_OPTED_OUT' };
  }
  return { decision: 'PASS', ruleId: 'RULE-005' };
}

export function rule004LowConfidence(ctx: PolicyContext): PolicyRuleResult {
  const isHighRisk = ctx.proposedAction === 'PAYMENT_LINK' || ctx.proposedAction === 'MESSAGE';
  if (isHighRisk && ctx.aiConfidence !== undefined && ctx.aiConfidence < ctx.config.AI_CONFIDENCE_THRESHOLD) {
    return { decision: 'HUMAN_REVIEW', ruleId: 'RULE-004', reason: 'LOW_CONFIDENCE_HIGH_RISK' };
  }
  return { decision: 'PASS', ruleId: 'RULE-004' };
}

export function rule006RetryCeiling(ctx: PolicyContext): PolicyRuleResult {
  if (ctx.proposedAction === 'SAFE_RETRY' && ctx.session.attempt_count >= ctx.config.MAX_RETRIES) {
    return { decision: 'BLOCK', ruleId: 'RULE-006', reason: 'RETRY_LIMIT_REACHED' };
  }
  return { decision: 'PASS', ruleId: 'RULE-006' };
}

export function rule008UnknownFailure(ctx: PolicyContext): PolicyRuleResult {
  const isHighRisk = ctx.proposedAction === 'PAYMENT_LINK' || ctx.proposedAction === 'SAFE_RETRY';
  if (isHighRisk && ctx.session.diagnosis === 'UNKNOWN') {
    return { decision: 'HUMAN_REVIEW', ruleId: 'RULE-008', reason: 'UNKNOWN_FAILURE_HIGH_RISK_ACTION' };
  }
  return { decision: 'PASS', ruleId: 'RULE-008' };
}

export function ruleKillSwitch(ctx: PolicyContext): PolicyRuleResult {
  if (!ctx.config.RECOVERY_AUTOMATION_ENABLED && ctx.proposedAction !== 'WAIT' && ctx.proposedAction !== 'STOP') {
    return { decision: 'BLOCK', ruleId: 'RULE-KILL-SWITCH', reason: 'RECOVERY_AUTOMATION_DISABLED' };
  }
  return { decision: 'PASS', ruleId: 'RULE-KILL-SWITCH' };
}

export function ruleHighValue(ctx: PolicyContext): PolicyRuleResult {
  if (ctx.payment.amount > ctx.config.HIGH_VALUE_THRESHOLD && ctx.proposedAction === 'PAYMENT_LINK') {
    return { decision: 'HUMAN_REVIEW', ruleId: 'RULE-HIGH-VALUE', reason: 'HIGH_VALUE_TRANSACTION' };
  }
  return { decision: 'PASS', ruleId: 'RULE-HIGH-VALUE' };
}

export function ruleCommunicationCount(ctx: PolicyContext): PolicyRuleResult {
  const isOutreach = ctx.proposedAction === 'MESSAGE' || ctx.proposedAction === 'PAYMENT_LINK';
  if (isOutreach && ctx.session.communication_count >= ctx.config.MAX_COMMUNICATIONS) {
    return { decision: 'BLOCK', ruleId: 'RULE-COMM-COUNT', reason: 'COMMUNICATION_LIMIT_REACHED' };
  }
  return { decision: 'PASS', ruleId: 'RULE-COMM-COUNT' };
}
