import { desc, eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { audit_events } from '../schema.js';
import type { AuditEvent } from '../../../domain/entities/audit-event.js';
import crypto from 'crypto';

export class AuditRepository {
  async append(event: Omit<AuditEvent, 'hash' | 'previous_hash' | 'timestamp'>): Promise<AuditEvent> {
    const now = new Date();
    
    // Get previous hash
    const lastEvent = await db.select().from(audit_events)
      .orderBy(desc(audit_events.timestamp))
      .limit(1);
    
    const previousHash = lastEvent.length > 0 ? lastEvent[0].hash : '0000000000000000000000000000000000000000000000000000000000000000';
    
    const contentToHash = previousHash + now.toISOString() + JSON.stringify(event.payload);
    const hash = crypto.createHash('sha256').update(contentToHash).digest('hex');

    const result = await db.insert(audit_events).values({
      ...event,
      timestamp: now,
      previous_hash: previousHash,
      hash,
    }).returning();
    
    return result[0] as AuditEvent;
  }

  async findBySession(sessionId: string): Promise<AuditEvent[]> {
    return (await db.select().from(audit_events)
      .where(eq(audit_events.recovery_session_id, sessionId))
      .orderBy(audit_events.timestamp)) as AuditEvent[];
  }

  async findRecent(limit = 50): Promise<AuditEvent[]> {
    return (await db.select().from(audit_events)
      .orderBy(desc(audit_events.timestamp))
      .limit(limit)) as AuditEvent[];
  }
}
