export type OutcomeResult = 'PAYMENT_RECOVERED' | 'NO_RECOVERY' | 'CUSTOMER_DECLINED' | 'CUSTOMER_OPTED_OUT' | 'PROMISE_TO_PAY' | 'ACTION_FAILED' | 'UNKNOWN';
export type AttributionClass = 'DIRECT' | 'ASSISTED' | 'ORGANIC' | 'UNKNOWN';

export interface RecoveryOutcome {
  id: string;
  recovery_session_id: string;
  action_id?: string;
  result: OutcomeResult;
  payment_id?: string;
  amount_recovered: number; // paise
  currency: string;
  payment_reference?: string;
  attribution: AttributionClass;
  attribution_evidence?: string;
  observed_at: Date;
}
