export interface AuditEvent {
  id: string;
  event_type: string;
  recovery_session_id?: string;
  customer_id?: string;
  payment_id?: string;
  subscription_id?: string;
  source_event_id?: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  previous_hash: string;
  hash: string;
  is_demo: boolean;
}
