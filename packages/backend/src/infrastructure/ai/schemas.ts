import { z } from 'zod';

export const FailureClassSchema = z.enum(['TECHNICAL','BUSINESS','AUTHENTICATION','ABANDONMENT','RECURRING_PAYMENT_FAILURE','UNKNOWN']);
export const ActionTypeSchema = z.enum(['WAIT','SAFE_RETRY','PAYMENT_LINK','MESSAGE','PTP_WAIT','ESCALATE','HUMAN_REVIEW','STOP']);

export const AIResponseSchema = z.object({
  diagnosis: z.object({
    failure_class: FailureClassSchema,
    confidence: z.number().min(0).max(1),
    reason_codes: z.array(z.string()),
  }),
  recovery: z.object({
    probability: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  }),
  recommendation: z.object({
    action: ActionTypeSchema,
    confidence: z.number().min(0).max(1),
    reason_codes: z.array(z.string()),
  }),
  message: z.object({
    text: z.string().max(500),
    tone: z.enum(['HELPFUL','URGENT','NEUTRAL']),
  }).optional(),
  requires_human_review: z.boolean(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

export const PTPResponseSchema = z.object({
  is_ptp: z.boolean(),
  promised_date: z.string().nullable(),
  promised_amount: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});

export type PTPResponse = z.infer<typeof PTPResponseSchema>;
