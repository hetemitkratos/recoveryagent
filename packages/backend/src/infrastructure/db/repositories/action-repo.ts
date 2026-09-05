import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { recovery_actions } from '../schema.js';
import type { RecoveryAction, ActionStatus } from '../../../domain/entities/recovery-action.js';

export class ActionRepository {
  async findByIdempotencyKey(key: string): Promise<RecoveryAction | null> {
    const results = await db.select().from(recovery_actions).where(eq(recovery_actions.idempotency_key, key));
    return results[0] as RecoveryAction || null;
  }

  async create(action: Omit<RecoveryAction, 'created_at'>): Promise<RecoveryAction> {
    const now = new Date();
    const result = await db.insert(recovery_actions).values({
      ...action,
      created_at: now,
    }).returning();
    return result[0] as RecoveryAction;
  }

  async updateStatus(id: string, status: ActionStatus, data?: Partial<Omit<RecoveryAction, 'id' | 'created_at' | 'status'>>): Promise<RecoveryAction> {
    const result = await db.update(recovery_actions)
      .set({ status, ...data })
      .where(eq(recovery_actions.id, id))
      .returning();
    return result[0] as RecoveryAction;
  }

  async findBySession(sessionId: string): Promise<RecoveryAction[]> {
    const results = await db.select().from(recovery_actions).where(eq(recovery_actions.recovery_session_id, sessionId));
    return results as RecoveryAction[];
  }

  async update(id: string, data: Partial<Omit<RecoveryAction, 'id' | 'created_at'>>): Promise<RecoveryAction> {
    const result = await db.update(recovery_actions)
      .set(data)
      .where(eq(recovery_actions.id, id))
      .returning();
    return result[0] as RecoveryAction;
  }
}
