export type PolicyDecisionResult = 'ALLOW' | 'BLOCK' | 'HUMAN_REVIEW';

export interface PolicyDecision {
  id: string;
  recovery_session_id: string;
  action_id: string;
  decision: PolicyDecisionResult;
  rules_evaluated: string[];
  blocking_reasons: string[];
  policy_version: string;
  created_at: Date;
}
