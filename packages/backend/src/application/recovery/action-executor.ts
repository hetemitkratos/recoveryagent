import crypto from 'crypto';
import type { RecoveryAction } from '../../domain/entities/recovery-action.js';
import type { RecoverySession } from '../../domain/entities/recovery-session.js';
import type { Customer } from '../../domain/entities/customer.js';
import type { Payment } from '../../domain/entities/payment.js';
import type { PaymentProvider } from '../../infrastructure/payment/payment-provider.js';
import type { NotificationProvider } from '../../infrastructure/notifications/notification-provider.js';
import { ActionRepository } from '../../infrastructure/db/repositories/action-repo.js';
import { AuditRepository } from '../../infrastructure/db/repositories/audit-repo.js';

export interface ActionResult {
  success: boolean;
  provider_reference?: string;
  error?: string;
}

export class ActionExecutor {
  constructor(
    private paymentProvider: PaymentProvider,
    private notificationProvider: NotificationProvider,
    private actionRepo: ActionRepository,
    private auditRepo: AuditRepository
  ) {}

  async execute(action: RecoveryAction, session: RecoverySession, customer: Customer, payment: Payment): Promise<ActionResult> {
    // 1. Check idempotency key
    const existing = await this.actionRepo.findByIdempotencyKey(action.idempotency_key);
    if (existing && existing.status !== 'PROPOSED' && existing.status !== 'PENDING_POLICY') {
      return { success: false, error: 'Idempotency key collision' };
    }

    await this.actionRepo.updateStatus(action.id, 'EXECUTING');

    let result: ActionResult = { success: false };

    try {
      switch (action.action_type) {
        case 'PAYMENT_LINK':
          const link = await this.paymentProvider.createPaymentLink({
            customer,
            amount: payment.amount,
            currency: payment.currency,
            recovery_session_id: session.id,
          });
          const msgResult = await this.notificationProvider.sendMessage({
            customer,
            message: `Please complete your payment of ${(payment.amount/100).toFixed(2)} here: ${link.url}`,
            recovery_session_id: session.id,
          });
          result = { success: msgResult.success, provider_reference: link.provider_reference };
          break;
        case 'SAFE_RETRY':
          const retryRes = await this.paymentProvider.retryPayment(payment.id);
          result = { success: retryRes.success, provider_reference: retryRes.new_payment_id };
          break;
        case 'MESSAGE':
          const mRes = await this.notificationProvider.sendMessage({
            customer,
            message: action.payload?.message as string || 'Action required on your account.',
            recovery_session_id: session.id,
          });
          result = { success: mRes.success, provider_reference: mRes.provider_reference };
          break;
        case 'PTP_WAIT':
        case 'ESCALATE':
        case 'HUMAN_REVIEW':
        case 'STOP':
        case 'WAIT':
          // Pure state changes, no external calls needed
          result = { success: true };
          break;
        default:
          result = { success: false, error: 'Unsupported action' };
      }

      const endStatus = result.success ? 'SUCCEEDED' : 'FAILED';
      await this.actionRepo.updateStatus(action.id, endStatus, {
        executed_at: new Date(),
        completed_at: new Date(),
        provider_reference: result.provider_reference,
        failure_reason: result.error,
      });

      await this.auditRepo.append({
        id: `aud_${crypto.randomUUID()}`,
        event_type: 'ACTION_EXECUTED',
        recovery_session_id: session.id,
        customer_id: customer.id,
        payment_id: payment.id,
        actor: 'SYSTEM',
        payload: { action_id: action.id, action_type: action.action_type, result },
        is_demo: session.is_demo,
      });

      return result;
    } catch (err: any) {
      await this.actionRepo.updateStatus(action.id, 'FAILED', {
        completed_at: new Date(),
        failure_reason: err.message,
      });
      return { success: false, error: err.message };
    }
  }
}
