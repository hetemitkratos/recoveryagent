import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { recovery_outcomes, recovery_sessions } from '../schema.js';
import type { RecoveryOutcome } from '../../../domain/entities/recovery-outcome.js';

export class OutcomeRepository {
  async create(outcome: RecoveryOutcome): Promise<RecoveryOutcome> {
    const result = await db.insert(recovery_outcomes).values(outcome).returning();
    return result[0] as RecoveryOutcome;
  }

  async findBySession(sessionId: string): Promise<RecoveryOutcome[]> {
    const results = await db.select().from(recovery_outcomes).where(eq(recovery_outcomes.recovery_session_id, sessionId));
    return results as RecoveryOutcome[];
  }

  /**
   * Load prior recovery outcomes for a customer by joining through sessions.
   * Used to build real customer_history for risk and AI context.
   */
  async findByCustomer(customerId: string): Promise<RecoveryOutcome[]> {
    const sessions = await db.select().from(recovery_sessions).where(eq(recovery_sessions.customer_id, customerId));
    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length === 0) return [];
    // Query outcomes for all sessions of this customer
    const allOutcomes: RecoveryOutcome[] = [];
    for (const sid of sessionIds) {
      const results = await db.select().from(recovery_outcomes).where(eq(recovery_outcomes.recovery_session_id, sid));
      allOutcomes.push(...(results as RecoveryOutcome[]));
    }
    return allOutcomes;
  }
}
