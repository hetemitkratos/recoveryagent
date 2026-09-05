import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../connection.js';
import { recovery_sessions } from '../schema.js';
import type { RecoverySession, RecoveryState } from '../../../domain/entities/recovery-session.js';

export class SessionRepository {
  async findById(id: string): Promise<RecoverySession | null> {
    const results = await db.select().from(recovery_sessions).where(eq(recovery_sessions.id, id));
    return results[0] as RecoverySession || null;
  }

  async findActive(customerId: string, paymentId: string): Promise<RecoverySession | null> {
    const results = await db.select().from(recovery_sessions).where(
      and(
        eq(recovery_sessions.customer_id, customerId),
        eq(recovery_sessions.payment_id, paymentId),
        isNull(recovery_sessions.closed_at)
      )
    );
    return results[0] as RecoverySession || null;
  }

  async create(session: Omit<RecoverySession, 'created_at' | 'updated_at'>): Promise<RecoverySession> {
    const now = new Date();
    const result = await db.insert(recovery_sessions).values({
      ...session,
      created_at: now,
      updated_at: now,
    }).returning();
    return result[0] as RecoverySession;
  }

  async updateState(id: string, state: RecoveryState, data?: Partial<Omit<RecoverySession, 'id' | 'created_at' | 'updated_at' | 'state'>>): Promise<RecoverySession> {
    const now = new Date();
    const result = await db.update(recovery_sessions)
      .set({ state, ...data, updated_at: now })
      .where(eq(recovery_sessions.id, id))
      .returning();
    return result[0] as RecoverySession;
  }

  async close(id: string, reason: string): Promise<RecoverySession> {
    const now = new Date();
    const result = await db.update(recovery_sessions)
      .set({ closed_at: now, closure_reason: reason, updated_at: now })
      .where(eq(recovery_sessions.id, id))
      .returning();
    return result[0] as RecoverySession;
  }

  async findAll(demoOnly = true): Promise<RecoverySession[]> {
    if (demoOnly) {
      return (await db.select().from(recovery_sessions).where(eq(recovery_sessions.is_demo, true))) as RecoverySession[];
    }
    return (await db.select().from(recovery_sessions)) as RecoverySession[];
  }

  /**
   * Find all sessions for a customer (for history-based risk/AI context).
   */
  async findByCustomer(customerId: string): Promise<RecoverySession[]> {
    const results = await db.select().from(recovery_sessions).where(eq(recovery_sessions.customer_id, customerId));
    return results as RecoverySession[];
  }
}
