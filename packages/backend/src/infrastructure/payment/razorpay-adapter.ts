import type { PaymentProvider, CreatePaymentLinkParams, PaymentLink } from './payment-provider.js';
import type { PaymentStatus } from '../../domain/entities/payment.js';
import { config } from '../../config.js';
import { db } from '../db/connection.js';
import { payments, subscriptions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const RAZORPAY_BASE = 'https://api.razorpay.com/v1';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

interface RazorpayErrorResponse {
  error: {
    code: string;
    description: string;
    field?: string;
  };
}

export class RazorpayAdapter implements PaymentProvider {
  private getAuthHeaders(): Record<string, string> {
    const auth = Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make a fetch request with retry logic for transient failures.
   * Retries on 5xx and network errors. Does not retry on 4xx.
   */
  private async fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, options);
        // Retry on 5xx (server errors)
        if (res.status >= 500 && attempt < retries) {
          await this.delay(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        return res;
      } catch (err: any) {
        lastError = err;
        if (attempt < retries) {
          await this.delay(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
      }
    }
    throw lastError || new Error('Request failed after retries');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse a Razorpay error response into a readable message.
   */
  private parseError(res: Response): string {
    // Status text is always available
    return `Razorpay API error: ${res.status} ${res.statusText}`;
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const res = await this.fetchWithRetry(`${RAZORPAY_BASE}/payments/${paymentId}`, {
      headers: this.getAuthHeaders(),
    });

    if (!res.ok) {
      if (res.status === 404) return 'UNKNOWN';
      throw new Error(this.parseError(res));
    }

    const data = await res.json() as any;

    switch (data.status) {
      case 'created': return 'CREATED';
      case 'authorized': return 'AUTHORIZED';
      case 'captured': return 'CAPTURED';
      case 'failed': return 'FAILED';
      case 'refunded': return 'REFUNDED';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Fetch full payment details from Razorpay (more fields than getPaymentStatus).
   */
  async getPaymentDetails(paymentId: string): Promise<any> {
    const res = await this.fetchWithRetry(`${RAZORPAY_BASE}/payments/${paymentId}`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(this.parseError(res));
    }
    return res.json();
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLink> {
    const body: Record<string, unknown> = {
      amount: params.amount,
      currency: params.currency,
      accept_partial: false,
      reference_id: params.recovery_session_id.slice(0, 40), // Razorpay limit
      description: (params.description || 'Payment Recovery').slice(0, 255),
      customer: {
        name: params.customer.name.slice(0, 50),
        email: params.customer.email,
        contact: params.customer.phone,
      },
      notify: {
        sms: true,
        email: true,
      },
      reminder_enable: true,
      options: {
        checkout: {
          name: 'Recovery Payment',
        },
      },
      notes: {
        recovery_session_id: params.recovery_session_id,
        source: 'ai_revenue_recovery',
      },
    };

    const res = await this.fetchWithRetry(`${RAZORPAY_BASE}/payment_links`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null) as RazorpayErrorResponse | null;
      const msg = errBody?.error?.description || this.parseError(res);
      throw new Error(`Failed to create payment link: ${msg}`);
    }

    const data = await res.json() as any;

    return {
      id: data.id,
      url: data.short_url,
      provider_reference: data.id,
      expires_at: data.expire_by ? new Date(data.expire_by * 1000) : undefined,
    };
  }

  /**
   * Retry a payment. For subscription/mandate payments, Razorpay supports
   * charging the subscription which creates a new payment attempt.
   * For non-subscription payments without a saved token, retry is not possible
   * via API — the customer must re-initiate. In that case we return failure
   * and the orchestrator will route to OUTREACH (payment link).
   */
  async retryPayment(paymentId: string): Promise<{ success: boolean; new_payment_id?: string }> {
    // 1. Check if this payment belongs to a subscription
    const paymentRecord = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!paymentRecord.length) {
      return { success: false };
    }

    const payment = paymentRecord[0] as any;

    // 2. If linked to a subscription, try to charge the subscription
    if (payment.subscription_id) {
      return this.retrySubscriptionCharge(payment.subscription_id);
    }

    // 3. Check if the payment has a token (card token / mandate)
    try {
      const details = await this.getPaymentDetails(paymentId);
      // If the payment was made via a tokenized method, we can create a new order + capture
      if (details.token?.id || details.method === 'card' && details.card?.id) {
        return await this.createOrderAndCapture(payment, details);
      }
    } catch {
      // If we can't fetch details, we can't retry
    }

    // 4. No retry path available — return failure, orchestrator will route to OUTREACH
    return { success: false };
  }

  /**
   * Charge a subscription via Razorpay's subscription charge endpoint.
   * This attempts to charge the registered mandate/token.
   */
  private async retrySubscriptionCharge(subscriptionId: string): Promise<{ success: boolean; new_payment_id?: string }> {
    try {
      const res = await this.fetchWithRetry(`${RAZORPAY_BASE}/subscriptions/${subscriptionId}/charge`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          amount: 0, // 0 means charge the subscription amount
          currency: 'INR',
          offer_id: null,
          notify: true,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null) as RazorpayErrorResponse | null;
        const msg = errBody?.error?.description || this.parseError(res);
        // Common errors: mandate not active, insufficient funds, etc.
        console.error(`Subscription charge failed for ${subscriptionId}: ${msg}`);
        return { success: false };
      }

      const data = await res.json() as any;
      // The charge response may include a payment ID
      const newPaymentId = data.payment_id || data.id;
      return {
        success: data.status === 'charged' || data.status === 'captured',
        new_payment_id: newPaymentId,
      };
    } catch (err: any) {
      console.error(`Subscription charge error for ${subscriptionId}: ${err.message}`);
      return { success: false };
    }
  }

  /**
   * Create a new order and attempt to capture using a saved token.
   * This is for tokenized card payments where we have a token ID.
   */
  private async createOrderAndCapture(payment: any, paymentDetails: any): Promise<{ success: boolean; new_payment_id?: string }> {
    try {
      // Create a new order for the same amount
      const orderRes = await this.fetchWithRetry(`${RAZORPAY_BASE}/orders`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          amount: payment.amount,
          currency: payment.currency || 'INR',
          receipt: `retry_${payment.id}`.slice(0, 40),
          notes: {
            original_payment_id: payment.id,
            source: 'ai_revenue_recovery_retry',
          },
        }),
      });

      if (!orderRes.ok) {
        return { success: false };
      }

      const order = await orderRes.json() as any;

      // We can't actually capture without the customer re-authenticating
      // (Razorpay doesn't allow server-side capture with just a token ID
      // for non-mandate payments). So we return the order ID and let
      // the orchestrator create a payment link for this order instead.
      // This is a safe fallback — the customer completes the payment.

      // For mandate/token payments that support auto-capture:
      const tokenId = paymentDetails.token?.id;
      if (tokenId) {
        const captureRes = await this.fetchWithRetry(`${RAZORPAY_BASE}/payments`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            amount: payment.amount,
            currency: payment.currency || 'INR',
            order_id: order.id,
            method: paymentDetails.method,
            token: tokenId,
            contact: paymentDetails.contact,
            email: paymentDetails.email,
          }),
        });

        if (captureRes.ok) {
          const captureData = await captureRes.json() as any;
          return {
            success: captureData.status === 'captured' || captureData.status === 'authorized',
            new_payment_id: captureData.id,
          };
        }
      }

      // If we can't auto-capture, return failure — orchestrator will send a payment link
      return { success: false };
    } catch (err: any) {
      console.error(`Order creation/capture error for payment ${payment.id}: ${err.message}`);
      return { success: false };
    }
  }

  /**
   * Cancel a payment link (useful when a session is closed or customer opts out).
   */
  async cancelPaymentLink(linkId: string): Promise<boolean> {
    try {
      const res = await this.fetchWithRetry(`${RAZORPAY_BASE}/payment_links/${linkId}/cancel`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch subscription details from Razorpay.
   */
  async getSubscriptionDetails(subscriptionId: string): Promise<any> {
    const res = await this.fetchWithRetry(`${RAZORPAY_BASE}/subscriptions/${subscriptionId}`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error(this.parseError(res));
    }
    return res.json();
  }
}
