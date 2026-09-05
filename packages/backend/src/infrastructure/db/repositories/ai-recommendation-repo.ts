import { eq } from 'drizzle-orm';
import { db } from '../connection.js';
import { ai_recommendations } from '../schema.js';

export interface AIRecommendationRecord {
  id: string;
  recovery_session_id: string;
  diagnosis: string;
  diagnosis_confidence: number;
  recovery_probability: number;
  recovery_confidence: number;
  recommended_action: string;
  action_confidence: number;
  reason_codes: string[];
  message_text?: string | null;
  message_tone?: string | null;
  requires_human_review: boolean;
  model_name: string;
  model_version: string;
  prompt_version: string;
  is_fallback: boolean;
  created_at: Date;
}

export class AIRecommendationRepository {
  async create(rec: Omit<AIRecommendationRecord, 'created_at'>): Promise<AIRecommendationRecord> {
    const now = new Date();
    const result = await db.insert(ai_recommendations).values({
      ...rec,
      created_at: now,
    }).returning();
    return result[0] as AIRecommendationRecord;
  }

  async findBySession(sessionId: string): Promise<AIRecommendationRecord[]> {
    const rows = await db.select().from(ai_recommendations).where(eq(ai_recommendations.recovery_session_id, sessionId));
    return rows as AIRecommendationRecord[];
  }
}
