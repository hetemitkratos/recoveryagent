import type { RecoveryState } from '../entities/recovery-session.js';

export const ALLOWED_TRANSITIONS: Record<RecoveryState, RecoveryState[]> = {
  AT_RISK:         ['DIAGNOSING', 'STOPPED', 'RECOVERED'],
  DIAGNOSING:      ['SAFE_RETRY', 'OUTREACH', 'PTP_WAIT', 'HUMAN_REVIEW', 'STOPPED', 'RECOVERED'],
  SAFE_RETRY:      ['PAYMENT_PENDING', 'OUTREACH', 'ESCALATED', 'STOPPED'],
  OUTREACH:        ['PAYMENT_PENDING', 'PTP_WAIT', 'ESCALATED', 'STOPPED'],
  PAYMENT_PENDING: ['RECOVERED', 'OUTREACH', 'ESCALATED', 'STOPPED'],
  PTP_WAIT:        ['RECOVERED', 'OUTREACH', 'ESCALATED', 'STOPPED'],
  HUMAN_REVIEW:    ['OUTREACH', 'SAFE_RETRY', 'ESCALATED', 'STOPPED'],
  ESCALATED:       ['HUMAN_REVIEW', 'RECOVERED', 'STOPPED'],
  RECOVERED:       [],
  STOPPED:         [],
};

export function isValidTransition(from: RecoveryState, to: RecoveryState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
