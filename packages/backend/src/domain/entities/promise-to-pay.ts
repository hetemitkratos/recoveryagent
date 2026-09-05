export type PTPStatus = 'ACTIVE' | 'FULFILLED' | 'MISSED' | 'CANCELLED' | 'AMBIGUOUS';

export interface PromiseToPay {
  id: string;
  recovery_session_id: string;
  customer_id: string;
  promised_date: Date;
  promised_amount?: number | null;
  source: 'TEXT' | 'VOICE' | 'MANUAL';
  source_text: string;
  confidence: number;
  status: PTPStatus;
  created_at: Date;
  updated_at: Date;
  fulfilled_at?: Date;
}
