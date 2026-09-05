export type ActionType = 'WAIT' | 'SAFE_RETRY' | 'PAYMENT_LINK' | 'MESSAGE' | 'PTP_WAIT' | 'ESCALATE' | 'HUMAN_REVIEW' | 'STOP';
export type ActionStatus = 'PROPOSED' | 'PENDING_POLICY' | 'BLOCKED' | 'SCHEDULED' | 'EXECUTING' | 'EXECUTED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type ActionSource = 'AI' | 'MANUAL' | 'SYSTEM';

export interface RecoveryAction {
  id: string;
  recovery_session_id: string;
  action_type: ActionType;
  reason: string;
  source: ActionSource;
  ai_recommendation_id?: string;
  policy_decision_id?: string;
  status: ActionStatus;
  provider?: string;
  provider_reference?: string;
  idempotency_key: string;
  payload?: Record<string, unknown>;
  scheduled_at?: Date;
  executed_at?: Date;
  completed_at?: Date;
  failure_reason?: string;
  created_at: Date;
}
