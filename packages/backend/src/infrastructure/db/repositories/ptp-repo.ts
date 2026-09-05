import { eq, and } from 'drizzle-orm';
import { db } from '../connection.js';
import { promises_to_pay } from '../schema.js';
import type { PromiseToPay, PTPStatus } from '../../../domain/entities/promise-to-pay.js';

export class PTPRepository {
  async create(ptp: Omit<PromiseToPay, 'created_at' | 'updated_at'>): Promise<PromiseToPay> {
    const now = new Date();
    const result = await db.insert(promises_to_pay).values({
      ...ptp,
      created_at: now,
      updated_at: now,
    }).returning();
    return result[0] as PromiseToPay;
  }

  async findActiveBySession(sessionId: string): Promise<PromiseToPay | null> {
    const results = await db.select().from(promises_to_pay).where(
      and(
        eq(promises_to_pay.recovery_session_id, sessionId),
        eq(promises_to_pay.status, 'ACTIVE')
      )
    );
    return results[0] as PromiseToPay || null;
  }

  async updateStatus(id: string, status: PTPStatus): Promise<PromiseToPay> {
    const now = new Date();
    const data: any = { status, updated_at: now };
    if (status === 'FULFILLED') {
      data.fulfilled_at = now;
    }
    const result = await db.update(promises_to_pay)
      .set(data)
      .where(eq(promises_to_pay.id, id))
      .returning();
    return result[0] as PromiseToPay;
  }
}
