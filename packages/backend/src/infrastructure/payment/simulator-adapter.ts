import type { PaymentProvider, CreatePaymentLinkParams, PaymentLink } from './payment-provider.js';
import type { PaymentStatus } from '../../domain/entities/payment.js';
import { nanoid } from 'nanoid';

export class SimulatorAdapter implements PaymentProvider {
  // In-memory store for simulated payments
  private payments = new Map<string, PaymentStatus>();

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    return this.payments.get(paymentId) || 'UNKNOWN';
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink> {
    const id = `plink_sim_${nanoid()}`;
    return {
      id,
      url: `https://pay.simulator.test/link/${id}`,
      provider_reference: id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    };
  }

  async retryPayment(paymentId: string): Promise<{ success: boolean; new_payment_id?: string }> {
    // In simulator, we can randomly succeed or fail, or rely on a deterministic check
    // Let's assume it succeeds 50% of the time for the demo, or we can control it via the simulate methods.
    const success = Math.random() > 0.5;
    if (success) {
      this.payments.set(paymentId, 'CAPTURED');
    }
    return { success, new_payment_id: success ? `pay_sim_${nanoid()}` : undefined };
  }

  // Demo control methods
  simulatePaymentSuccess(paymentId: string, route: 'RECOVERY_LINK' | 'DIRECT' | 'OTHER'): void {
    this.payments.set(paymentId, 'CAPTURED');
  }

  simulatePaymentFailure(paymentId: string): void {
    this.payments.set(paymentId, 'FAILED');
  }

  // Extended interface stubs (no-op for simulator)
  async cancelPaymentLink(_linkId: string): Promise<boolean> {
    return true;
  }

  async getSubscriptionDetails(_subscriptionId: string): Promise<any> {
    return { status: 'active' };
  }
}
