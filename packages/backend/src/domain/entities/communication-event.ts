export interface CommunicationEvent {
  id: string;
  recovery_session_id: string;
  customer_id: string;
  channel: 'SIMULATED' | 'EMAIL' | 'SMS';
  template_id?: string;
  message: string;
  provider?: string;
  provider_reference?: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'FAILED';
  sent_at?: Date;
  delivered_at?: Date;
  opened_at?: Date;
  responded_at?: Date;
  created_at: Date;
}
