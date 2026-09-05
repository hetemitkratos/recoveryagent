export type SubscriptionStatus = 'ACTIVE' | 'PENDING' | 'PAST_DUE' | 'HALTED' | 'CANCELLED' | 'COMPLETED' | 'UNKNOWN';

export interface Subscription {
  id: string;
  customer_id: string;
  provider: string;
  provider_subscription_id: string;
  plan_id: string;
  amount: number; // paise per cycle
  currency: string;
  status: SubscriptionStatus;
  next_charge_at?: Date;
  failed_attempts: number;
  max_attempts: number;
  retry_ceiling: number;
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
}
