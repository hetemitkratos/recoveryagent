import type { ActionType } from '../entities/recovery-action.js';
import type { FailureClass } from '../entities/payment.js';

export const ACTION_MATRIX: Record<FailureClass, ActionType[]> = {
  BUSINESS: ['PAYMENT_LINK', 'MESSAGE', 'SAFE_RETRY', 'PTP_WAIT', 'ESCALATE', 'HUMAN_REVIEW', 'STOP', 'WAIT'],
  TECHNICAL: ['SAFE_RETRY', 'WAIT', 'MESSAGE', 'ESCALATE', 'HUMAN_REVIEW', 'STOP'],
  AUTHENTICATION: ['PAYMENT_LINK', 'MESSAGE', 'PTP_WAIT', 'ESCALATE', 'HUMAN_REVIEW', 'STOP', 'WAIT'],
  ABANDONMENT: ['PAYMENT_LINK', 'MESSAGE', 'ESCALATE', 'HUMAN_REVIEW', 'STOP', 'WAIT'],
  RECURRING_PAYMENT_FAILURE: ['SAFE_RETRY', 'PAYMENT_LINK', 'MESSAGE', 'ESCALATE', 'HUMAN_REVIEW', 'STOP', 'WAIT'],
  UNKNOWN: ['HUMAN_REVIEW', 'ESCALATE', 'STOP', 'WAIT']
};

export function isActionAllowedForFailure(failureClass: FailureClass, action: ActionType): boolean {
  return ACTION_MATRIX[failureClass]?.includes(action) ?? false;
}
