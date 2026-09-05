export interface Customer {
  id: string;
  external_customer_id: string;
  name: string;
  email: string;
  phone: string;
  preferred_channel: 'EMAIL' | 'SMS' | 'SIMULATED';
  opted_out: boolean;
  lifetime_value: number; // paise
  is_demo: boolean;
  created_at: Date;
  updated_at: Date;
}
