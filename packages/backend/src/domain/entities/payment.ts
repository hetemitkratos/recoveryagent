export type PaymentStatus = 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'CANCELLED' | 'UNKNOWN';
export type FailureClass = 'TECHNICAL' | 'BUSINESS' | 'AUTHENTICATION' | 'ABANDONMENT' | 'RECURRING_PAYMENT_FAILURE' | 'UNKNOWN';

export interface Payment {
  id: string;
  customer_id: string;
  provider: 'razorpay' | 'simulator';
  provider_payment_id: string;
  provider_order_id?: string;
  amount: number; // paise
  currency: string;
  status: PaymentStatus;
  failure_code?: string;
  failure_description?: string;
  failure_class?: FailureClass;
  attempt_number: number;
  is_demo: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  paid_at?: Date;
}
