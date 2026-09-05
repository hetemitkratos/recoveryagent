import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { payments } from '../schema.js';
import type { Payment, PaymentStatus } from '../../../domain/entities/payment.js';

export class PaymentRepository {
  async findById(id: string): Promise<Payment | null> {
    const results = await db.select().from(payments).where(eq(payments.id, id));
    return results[0] as Payment || null;
  }

  async findByProviderPaymentId(providerId: string): Promise<Payment | null> {
    const results = await db.select().from(payments).where(eq(payments.provider_payment_id, providerId));
    return results[0] as Payment || null;
  }

  async create(payment: Omit<Payment, 'created_at' | 'updated_at'>): Promise<Payment> {
    const now = new Date();
    const result = await db.insert(payments).values({
      ...payment,
      created_at: now,
      updated_at: now,
    }).returning();
    return result[0] as Payment;
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<Payment> {
    const now = new Date();
    const data: any = { status, updated_at: now };
    if (status === 'CAPTURED') {
      data.paid_at = now;
    }
    const result = await db.update(payments)
      .set(data)
      .where(eq(payments.id, id))
      .returning();
    return result[0] as Payment;
  }
}
