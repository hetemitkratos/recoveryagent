import type { Customer } from '../../domain/entities/customer.js';

export interface SendMessageParams {
  customer: Customer;
  message: string;
  recovery_session_id: string;
  template_id?: string;
}

export interface NotificationProvider {
  sendMessage(params: SendMessageParams): Promise<{ success: boolean; provider_reference: string }>;
}
