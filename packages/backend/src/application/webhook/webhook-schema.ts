import { z } from 'zod';

/**
 * Zod schema for validating Razorpay webhook payloads.
 * This validates the envelope structure — the inner entity is loosely typed
 * because Razorpay payloads vary by event type.
 */
export const razorpayWebhookSchema = z.object({
  entity: z.literal('event').optional(),
  event: z.string().min(1),
  id: z.string().min(1),
  created_at: z.number().optional(),
  account_id: z.string().optional(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string().optional(),
        entity: z.literal('payment').optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        status: z.string().optional(),
        error_code: z.string().nullable().optional(),
        error_description: z.string().nullable().optional(),
        customer_id: z.string().nullable().optional(),
        method: z.string().optional(),
        email: z.string().nullable().optional(),
        contact: z.string().nullable().optional(),
        order_id: z.string().nullable().optional(),
        subscription_id: z.string().nullable().optional(),
        attempt_number: z.number().optional(),
      }).passthrough(),
    }).optional(),
    payment_link: z.object({
      entity: z.object({
        id: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        status: z.string().optional(),
        payment_id: z.string().nullable().optional(),
        customer_id: z.string().nullable().optional(),
      }).passthrough(),
    }).optional(),
    subscription: z.object({
      entity: z.object({
        id: z.string().optional(),
        status: z.string().optional(),
        customer_id: z.string().nullable().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
      }).passthrough(),
    }).optional(),
    invoice: z.object({
      entity: z.object({
        id: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        status: z.string().optional(),
        customer_id: z.string().nullable().optional(),
        subscription_id: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        contact: z.string().nullable().optional(),
      }).passthrough(),
    }).optional(),
    order: z.object({
      entity: z.object({
        id: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        status: z.string().optional(),
        customer_id: z.string().nullable().optional(),
        payments: z.array(z.object({
          payment_id: z.string().optional(),
          status: z.string().optional(),
        })).optional(),
      }).passthrough(),
    }).optional(),
    refund: z.object({
      entity: z.object({
        id: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        payment_id: z.string().nullable().optional(),
      }).passthrough(),
    }).optional(),
  }).passthrough(),
}).passthrough();

export type RazorpayWebhookPayload = z.infer<typeof razorpayWebhookSchema>;
