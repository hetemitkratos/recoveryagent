export type WebhookEventType =
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_AUTHORIZED'
  | 'PAYMENT_LINK_PAID'
  | 'PAYMENT_LINK_EXPIRED'
  | 'PAYMENT_LINK_CANCELLED'
  | 'SUBSCRIPTION_PENDING'
  | 'SUBSCRIPTION_HALTED'
  | 'SUBSCRIPTION_CHARGED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_RESUMED'
  | 'INVOICE_PAID'
  | 'INVOICE_EXPIRED'
  | 'ORDER_PAID'
  | 'REFUND_PROCESSED'
  | 'UNKNOWN';

export interface NormalizedPaymentEvent {
  event_type: WebhookEventType;
  source: 'razorpay' | 'simulator';
  source_event_id: string;
  payment_id?: string;
  customer_id?: string;
  amount?: number;
  currency?: string;
  failure_code?: string;
  failure_description?: string;
  subscription_id?: string;
  order_id?: string;
  invoice_id?: string;
  refund_id?: string;
  payment_link_id?: string;
  method?: string;          // upi, card, netbanking, etc.
  email?: string;
  contact?: string;
  occurred_at: Date;
  raw_payload: Record<string, unknown>;
}

// Map of Razorpay event names to our internal event types
const EVENT_TYPE_MAP: Record<string, WebhookEventType> = {
  'payment.failed':              'PAYMENT_FAILED',
  'payment.captured':            'PAYMENT_CAPTURED',
  'payment.authorized':          'PAYMENT_AUTHORIZED',
  'payment_link.paid':           'PAYMENT_LINK_PAID',
  'payment_link.expired':        'PAYMENT_LINK_EXPIRED',
  'payment_link.cancelled':      'PAYMENT_LINK_CANCELLED',
  'subscription.pending':        'SUBSCRIPTION_PENDING',
  'subscription.halted':         'SUBSCRIPTION_HALTED',
  'subscription.charged':        'SUBSCRIPTION_CHARGED',
  'subscription.cancelled':      'SUBSCRIPTION_CANCELLED',
  'subscription.resumed':        'SUBSCRIPTION_RESUMED',
  'invoice.paid':                'INVOICE_PAID',
  'invoice.expired':             'INVOICE_EXPIRED',
  'order.paid':                  'ORDER_PAID',
  'refund.processed':            'REFUND_PROCESSED',
};

export function normalizeRazorpayEvent(payload: any, eventId: string): NormalizedPaymentEvent {
  const razorpayEvent = payload.event as string | undefined;
  const event_type: WebhookEventType = EVENT_TYPE_MAP[razorpayEvent || ''] || 'UNKNOWN';

  // Extract the primary entity from the webhook payload.
  // Razorpay webhook structure: { event, payload: { payment: { entity }, subscription: { entity }, ... } }
  const paymentEntity = payload.payload?.payment?.entity;
  const paymentLinkEntity = payload.payload?.payment_link?.entity;
  const subscriptionEntity = payload.payload?.subscription?.entity;
  const invoiceEntity = payload.payload?.invoice?.entity;
  const orderEntity = payload.payload?.order?.entity;
  const refundEntity = payload.payload?.refund?.entity;

  // The primary entity depends on the event type
  const primaryEntity =
    paymentEntity || paymentLinkEntity || subscriptionEntity || invoiceEntity || orderEntity || refundEntity || {};

  // Customer ID can be in different places depending on the entity type
  const customer_id =
    paymentEntity?.customer_id ||
    subscriptionEntity?.customer_id ||
    invoiceEntity?.customer_id ||
    orderEntity?.customer_id ||
    primaryEntity?.customer_id;

  // Payment ID can come from different entities
  const payment_id =
    paymentEntity?.id ||
    paymentLinkEntity?.payment_id ||
    (event_type === 'ORDER_PAID' ? orderEntity?.payments?.find((p: any) => p.status === 'captured')?.payment_id : undefined);

  // Subscription ID
  const subscription_id =
    subscriptionEntity?.id ||
    paymentEntity?.subscription_id ||
    invoiceEntity?.subscription_id;

  // Amount (in paise)
  const amount =
    paymentEntity?.amount ||
    paymentLinkEntity?.amount ||
    subscriptionEntity?.amount ||
    invoiceEntity?.amount ||
    orderEntity?.amount ||
    refundEntity?.amount;

  const currency =
    paymentEntity?.currency ||
    paymentLinkEntity?.currency ||
    subscriptionEntity?.currency ||
    invoiceEntity?.currency ||
    orderEntity?.currency ||
    refundEntity?.currency ||
    'INR';

  // Failure details (only present on payment.failed)
  const failure_code = paymentEntity?.error_code || paymentEntity?.error_description?.code;
  const failure_description = paymentEntity?.error_description;

  // Payment method
  const method = paymentEntity?.method;

  // Customer contact info
  const email = paymentEntity?.email || invoiceEntity?.email;
  const contact = paymentEntity?.contact || invoiceEntity?.contact;

  // IDs for other entity types
  const order_id = orderEntity?.id || paymentEntity?.order_id;
  const invoice_id = invoiceEntity?.id;
  const refund_id = refundEntity?.id;
  const payment_link_id = paymentLinkEntity?.id;

  return {
    event_type,
    source: 'razorpay',
    source_event_id: eventId,
    payment_id,
    customer_id,
    amount,
    currency,
    failure_code,
    failure_description,
    subscription_id,
    order_id,
    invoice_id,
    refund_id,
    payment_link_id,
    method,
    email,
    contact,
    occurred_at: new Date((payload.created_at || Math.floor(Date.now() / 1000)) * 1000),
    raw_payload: payload,
  };
}

/**
 * Categorize an event as a failure, success, or informational.
 * Used by the webhook processor to decide dispatch.
 */
export function isFailureEvent(eventType: WebhookEventType): boolean {
  return eventType === 'PAYMENT_FAILED' || eventType === 'SUBSCRIPTION_HALTED' || eventType === 'PAYMENT_LINK_EXPIRED' || eventType === 'PAYMENT_LINK_CANCELLED' || eventType === 'INVOICE_EXPIRED';
}

export function isSuccessEvent(eventType: WebhookEventType): boolean {
  return eventType === 'PAYMENT_CAPTURED' || eventType === 'PAYMENT_LINK_PAID' || eventType === 'PAYMENT_AUTHORIZED' || eventType === 'SUBSCRIPTION_CHARGED' || eventType === 'INVOICE_PAID' || eventType === 'ORDER_PAID';
}
