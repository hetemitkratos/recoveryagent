import type { FailureClass } from './payment.js';
import type { ActionType } from './recovery-action.js';

export interface AIRecommendation {
  id: string;
  recovery_session_id: string;
  diagnosis: FailureClass;
  diagnosis_confidence: number;
  recovery_probability: number;
  recovery_confidence: number;
  recommended_action: ActionType;
  action_confidence: number;
  reason_codes: string[];
  message_text?: string;
  message_tone?: 'HELPFUL' | 'URGENT' | 'NEUTRAL';
  requires_human_review: boolean;
  model_name: string;
  model_version: string;
  prompt_version: string;
  is_fallback: boolean;
  created_at: Date;
}
