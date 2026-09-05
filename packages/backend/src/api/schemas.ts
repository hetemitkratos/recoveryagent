import { z } from 'zod';

// --- Demo route schemas ---

export const seedBodySchema = z.object({
  seed: z.number().int().min(0).max(2147483647).default(42),
  count: z.number().int().min(1).max(1000).default(100),
});

export const simulateFailureBodySchema = z.object({
  customer_id: z.string().max(100).optional(),
  amount: z.number().int().min(1).max(10000000000).optional(), // max 1Cr in paise
  failure_class: z.enum(['TECHNICAL', 'BUSINESS', 'AUTHENTICATION', 'ABANDONMENT', 'UNKNOWN']).optional(),
  failure_code: z.string().max(100).optional(),
});

export const simulatePaymentBodySchema = z.object({
  payment_id: z.string().min(1).max(200),
  route: z.enum(['RECOVERY_LINK', 'DIRECT', 'OTHER']).default('RECOVERY_LINK'),
});

export const simulatePTPBodySchema = z.object({
  recovery_id: z.string().min(1).max(200),
  promised_date: z.string().datetime().optional(),
  source_text: z.string().max(2000).optional(),
});

export const simulateOptOutBodySchema = z.object({
  recovery_id: z.string().min(1).max(200),
});

export const experimentBodySchema = z.object({
  seed: z.number().int().min(0).max(2147483647).default(42),
  control_size: z.number().int().min(1).max(1000).default(50),
  treatment_size: z.number().int().min(1).max(1000).default(50),
});

// --- Recovery route schemas ---

export const executeActionBodySchema = z.object({
  action_type: z.enum(['WAIT', 'SAFE_RETRY', 'PAYMENT_LINK', 'MESSAGE', 'PTP_WAIT', 'ESCALATE', 'HUMAN_REVIEW', 'STOP']),
});

// --- Pagination schema ---

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
