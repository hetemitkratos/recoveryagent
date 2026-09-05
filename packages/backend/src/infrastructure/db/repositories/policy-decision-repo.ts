import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { policy_decisions } from '../schema.js';

export interface PolicyDecisionRecord {
  id: string;
  recovery_session_id: string;
  action_id: string;
  decision: string;
  rules_evaluated: Record<string, unknown>[];
  blocking_reasons: string[];
  policy_version: string;
  created_at: Date;
}

export class PolicyDecisionRepository {
  async create(rec: Omit<PolicyDecisionRecord, 'created_at'>): Promise<PolicyDecisionRecord> {
    const now = new Date();
    const result = await db.insert(policy_decisions).values({
      ...rec,
      created_at: now,
    }).returning();
    return result[0] as PolicyDecisionRecord;
  }

  async findBySession(sessionId: string): Promise<PolicyDecisionRecord[]> {
    const rows = await db.select().from(policy_decisions).where(eq(policy_decisions.recovery_session_id, sessionId));
    return rows as PolicyDecisionRecord[];
  }
}
