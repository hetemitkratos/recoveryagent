import type { RecoveryState } from '../entities/recovery-session.js';
import type { ActionType } from '../entities/recovery-action.js';

export type RecoveryEvent = 
  | { type: 'DIAGNOSIS_COMPLETE' }
  | { type: 'ACTION_ALLOWED'; action: ActionType }
  | { type: 'ACTION_BLOCKED'; reason: string }
  | { type: 'PAYMENT_SUCCESS' }
  | { type: 'PTP_DETECTED' }
  | { type: 'MANUAL_INTERVENTION' }
  | { type: 'FORCE_CLOSE'; reason: string };
