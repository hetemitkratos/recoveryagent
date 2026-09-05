import type { FailureClass } from '../../domain/entities/payment.js';

export const DETERMINISTIC_FAILURE_MAP: Record<string, FailureClass> = {
  'insufficient_funds': 'BUSINESS',
  'limit_exceeded': 'BUSINESS',
  'card_declined': 'BUSINESS',
  'do_not_honor': 'BUSINESS',
  'gateway_timeout': 'TECHNICAL',
  'processor_error': 'TECHNICAL',
  'network_error': 'TECHNICAL',
  'bank_timeout': 'TECHNICAL',
  'authentication_required': 'AUTHENTICATION',
  'invalid_3ds': 'AUTHENTICATION',
  'afa_failed': 'AUTHENTICATION',
  'subscription_pending': 'RECURRING_PAYMENT_FAILURE',
  'subscription_halted': 'RECURRING_PAYMENT_FAILURE',
  'session_timeout': 'ABANDONMENT',
  'checkout_abandoned': 'ABANDONMENT',
};

export function classifyDeterministically(code: string): FailureClass | null {
  return DETERMINISTIC_FAILURE_MAP[code.toLowerCase()] ?? null;
}
