import type { RecoveryState } from '../entities/recovery-session.js';

export const ALL_STATES: RecoveryState[] = [
  'AT_RISK', 'DIAGNOSING', 'SAFE_RETRY', 'OUTREACH',
  'PAYMENT_PENDING', 'PTP_WAIT', 'RECOVERED',
  'ESCALATED', 'STOPPED', 'HUMAN_REVIEW'
];
