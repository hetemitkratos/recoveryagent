import type { Customer } from '../../domain/entities/customer.js';
import type { PaymentStatus } from '../../domain/entities/payment.js';

export interface CreatePaymentLinkParams {
  customer: Customer;
  amount: number;
  currency: string;
  recovery_session_id: string;
  description?: string;
}

export interface PaymentLink {
  id: string;
  url: string;
  provider_reference: string;
  expires_at?: Date;
}

export interface PaymentProvider {
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink>;
  retryPayment(paymentId: string): Promise<{ success: boolean; new_payment_id?: string }>;
}

/**
 * Extended payment provider with additional Razorpay-specific operations.
 * The base PaymentProvider interface is the minimum; live adapters may implement this too.
 */
export interface ExtendedPaymentProvider extends PaymentProvider {
  getPaymentDetails?(paymentId: string): Promise<any>;
  cancelPaymentLink?(linkId: string): Promise<boolean>;
  getSubscriptionDetails?(subscriptionId: string): Promise<any>;
}
