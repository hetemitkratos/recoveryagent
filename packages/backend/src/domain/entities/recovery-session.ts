import type { FailureClass } from './payment.js';

export type RecoveryState = 
  | 'AT_RISK' | 'DIAGNOSING' | 'SAFE_RETRY' | 'OUTREACH'
  | 'PAYMENT_PENDING' | 'PTP_WAIT' | 'RECOVERED'
  | 'ESCALATED' | 'STOPPED' | 'HUMAN_REVIEW';

export const TERMINAL_STATES: Set<RecoveryState> = new Set(['RECOVERED', 'STOPPED']);

export interface RecoverySession {
  id: string;
  customer_id: string;
  payment_id?: string;
  subscription_id?: string;
  state: RecoveryState;
  risk_score: number; // 0-100
  recovery_probability: number; // 0.0-1.0
  expected_recoverable_revenue: number; // paise
  diagnosis?: FailureClass;
  diagnosis_confidence?: number;
  current_owner?: string;
  attempt_count: number;
  communication_count: number;
  last_action_at?: Date;
  next_action_at?: Date;
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
  closed_at?: Date;
  closure_reason?: string;
}
